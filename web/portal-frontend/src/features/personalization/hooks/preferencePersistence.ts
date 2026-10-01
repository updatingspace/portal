import type { QueryClient } from '@tanstack/react-query';
import { resetPreferences, updatePreferences } from '../api/personalizationApi';
import type { PreferencesUpdatePayload, UserPreferences } from '../types';

export const PREFERENCES_KEY = ['preferences'];

function mergeChanges(
  a: PreferencesUpdatePayload,
  b: PreferencesUpdatePayload,
): PreferencesUpdatePayload {
  return {
    ...(a.appearance || b.appearance
      ? { appearance: { ...a.appearance, ...b.appearance } }
      : {}),
    ...(a.localization || b.localization
      ? { localization: { ...a.localization, ...b.localization } }
      : {}),
    ...(a.notifications || b.notifications
      ? { notifications: { ...a.notifications, ...b.notifications } }
      : {}),
    ...(a.privacy || b.privacy
      ? { privacy: { ...a.privacy, ...b.privacy } }
      : {}),
  };
}

function applyChanges(
  data: UserPreferences,
  changes: PreferencesUpdatePayload,
): UserPreferences {
  return {
    ...data,
    appearance: { ...data.appearance, ...changes.appearance },
    localization: { ...data.localization, ...changes.localization },
    notifications: { ...data.notifications, ...changes.notifications },
    privacy: { ...data.privacy, ...changes.privacy },
  };
}

/** One writer per private QueryClient: survives page navigation, never a tenant/account change. */
class PreferencePersistence {
  private pending: PreferencesUpdatePayload = {};
  private active: PreferencesUpdatePayload = {};
  private flight: Promise<void> | null = null;
  private disposed = false;
  private listeners = new Set<() => void>();
  private waiters: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private state = {
    isSaving: false,
    isResetting: false,
    error: null as Error | null,
  };

  constructor(private client: QueryClient) {
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (
        event.type !== 'removed' ||
        event.query.queryKey.length !== 1 ||
        event.query.queryKey[0] !== 'preferences'
      )
        return;
      // PrivateQueryScope clears this cache on logout, tenant or permission changes.
      this.disposed = true;
      this.pending = {};
      this.settle(new Error('Preference context changed'));
      unsubscribe();
      controllers.delete(client);
    });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.state;

  private notify(patch: Partial<typeof this.state>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private settle(error?: Error) {
    this.waiters
      .splice(0)
      .forEach((waiter) => (error ? waiter.reject(error) : waiter.resolve()));
  }

  // A refetch or an older write response must not erase a more recent selection.
  overlay = (data: UserPreferences) =>
    applyChanges(data, mergeChanges(this.active, this.pending));

  save = (changes: PreferencesUpdatePayload): Promise<void> => {
    if (this.disposed || this.state.isResetting)
      return Promise.reject(new Error('Preference context unavailable'));
    void this.client.cancelQueries({ queryKey: PREFERENCES_KEY, exact: true });
    this.pending = mergeChanges(this.pending, changes);
    const current = this.client.getQueryData<UserPreferences>(PREFERENCES_KEY);
    if (current)
      this.client.setQueryData(PREFERENCES_KEY, applyChanges(current, changes));
    const saved = new Promise<void>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
    this.start();
    return saved;
  };

  retry = (): Promise<void> => this.save({});

  private start() {
    if (this.flight || this.disposed) return;
    this.notify({ isSaving: true, error: null });
    this.flight = this.drain().finally(() => {
      this.flight = null;
      if (!this.disposed) {
        this.notify({ isSaving: false });
        // A consumer can enqueue from the previous save's promise continuation.
        if (
          !this.state.error &&
          !this.state.isResetting &&
          Object.keys(this.pending).length
        )
          this.start();
      }
    });
  }

  private async drain() {
    while (!this.disposed && Object.keys(this.pending).length) {
      this.active = this.pending;
      this.pending = {};
      try {
        const confirmed = await updatePreferences(this.active);
        if (this.disposed) return;
        void this.client.cancelQueries({
          queryKey: PREFERENCES_KEY,
          exact: true,
        });
        this.active = {};
        this.client.setQueryData(PREFERENCES_KEY, this.overlay(confirmed));
      } catch (error) {
        if (this.disposed) return;
        this.pending = mergeChanges(this.active, this.pending);
        this.active = {};
        const failure =
          error instanceof Error
            ? error
            : new Error('Unable to save preferences');
        this.notify({ error: failure });
        this.settle(failure);
        return; // Retain the local choice; retry only on user action.
      }
    }
    this.settle();
  }

  reset = async (): Promise<void> => {
    if (this.disposed || this.state.isResetting)
      throw new Error('Preference context unavailable');
    this.notify({ isResetting: true });
    try {
      await this.flight;
      if (this.disposed) return;
      const confirmed = await resetPreferences();
      if (this.disposed) return;
      void this.client.cancelQueries({
        queryKey: PREFERENCES_KEY,
        exact: true,
      });
      this.pending = {};
      this.active = {};
      this.client.setQueryData(PREFERENCES_KEY, confirmed);
      this.notify({ error: null });
    } finally {
      if (!this.disposed) this.notify({ isResetting: false });
    }
  };
}

const controllers = new WeakMap<QueryClient, PreferencePersistence>();

export function getPreferencePersistence(
  client: QueryClient,
): PreferencePersistence {
  let controller = controllers.get(client);
  if (!controller) {
    controller = new PreferencePersistence(client);
    controllers.set(client, controller);
  }
  return controller;
}
