import { request } from './client';

export type SessionInfo = {
  sessionKey: string;
  isCurrent: boolean;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: string;
  lastSeenAt?: string;
  expiresAt: string;
};

export type UserInfo = {
  id: number;
  username: string;
  email?: string | null;
  telegramId?: number | null;
  telegramUsername?: string | null;
  telegramLinked: boolean;
  isStaff?: boolean;
  isSuperuser?: boolean;
};

export type AuthResponse = {
  user: UserInfo;
  session: SessionInfo;
};

export type ProfileResponse = {
  user: UserInfo;
  sessions: SessionInfo[];
};

type ApiSession = {
  session_key: string;
  is_current: boolean;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string | null;
  last_seen_at?: string | null;
  expires_at: string;
};

type ApiUser = {
  id: number;
  username: string;
  email?: string | null;
  telegram_id?: number | null;
  telegramId?: number | null;
  telegram_username?: string | null;
  telegramUsername?: string | null;
  telegram_linked?: boolean;
  telegramLinked?: boolean;
  is_staff?: boolean;
  isStaff?: boolean;
  is_superuser?: boolean;
  isSuperuser?: boolean;
};

const mapSession = (session: ApiSession): SessionInfo => ({
  sessionKey: session.session_key,
  isCurrent: session.is_current,
  ipAddress: session.ip_address ?? undefined,
  userAgent: session.user_agent ?? undefined,
  createdAt: session.created_at ?? undefined,
  lastSeenAt: session.last_seen_at ?? undefined,
  expiresAt: session.expires_at,
});

const mapUser = (user: ApiUser): UserInfo => ({
  id: user.id,
  username: user.username,
  email: user.email,
  telegramId: user.telegram_id ?? user.telegramId ?? null,
  telegramUsername: user.telegram_username ?? user.telegramUsername ?? null,
  telegramLinked: Boolean(user.telegram_linked ?? user.telegramLinked ?? false),
  isStaff: user.is_staff ?? user.isStaff ?? false,
  isSuperuser: user.is_superuser ?? user.isSuperuser ?? false,
});

export async function registerUser(payload: {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
}): Promise<AuthResponse> {
  const data = await request<{ user: ApiUser; session: ApiSession }>('/auth/register', {
    method: 'POST',
    body: {
      username: payload.username,
      email: payload.email,
      password: payload.password,
      password_confirm: payload.passwordConfirm,
    },
  });

  return {
    user: mapUser(data.user),
    session: mapSession(data.session),
  };
}

export async function loginUser(payload: {
  login: string;
  password: string;
}): Promise<AuthResponse> {
  const data = await request<{ user: ApiUser; session: ApiSession }>('/auth/login', {
    method: 'POST',
    body: {
      login: payload.login,
      password: payload.password,
    },
  });

  return {
    user: mapUser(data.user),
    session: mapSession(data.session),
  };
}

export async function logoutUser(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

export async function fetchProfile(): Promise<ProfileResponse> {
  const data = await request<{ user: ApiUser; sessions: ApiSession[] }>('/auth/me');
  return { user: mapUser(data.user), sessions: data.sessions.map(mapSession) };
}

export async function revokeSession(sessionKey: string): Promise<void> {
  await request(`/auth/sessions/${sessionKey}`, { method: 'DELETE' });
}

export async function revokeOtherSessions(): Promise<void> {
  await request('/auth/sessions/revoke_all', { method: 'POST' });
}

export type TelegramAuthPayload = {
  id: number;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
  authDate: number;
  hash: string;
};

export async function authWithTelegram(payload: TelegramAuthPayload): Promise<AuthResponse> {
  const data = await request<{ user: ApiUser; session: ApiSession }>('/auth/telegram', {
    method: 'POST',
    body: {
      id: payload.id,
      first_name: payload.firstName,
      last_name: payload.lastName,
      username: payload.username,
      photo_url: payload.photoUrl,
      auth_date: payload.authDate,
      hash: payload.hash,
    },
  });

  return {
    user: mapUser(data.user),
    session: mapSession(data.session),
  };
}

export async function deleteAccount(): Promise<void> {
  await request('/auth/me', { method: 'DELETE' });
}
