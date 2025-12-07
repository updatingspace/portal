import { vi } from 'vitest';

import type { Game } from '../../types/games';
import type { AccountProfile } from '../../services/api';
import { ApiError } from '../../api/client';
import {
  createAdminVotingDetail,
  createAdminVotingList,
  createAdminStats,
  createGames,
  createNominationDetail,
  createNominationList,
  createSuperuserProfile,
  createVoteResult,
  createVotingCatalog,
  createVotingImportPayload,
  createVotingImportPreview,
  createVotingImportResult,
} from '../fixtures';

export const votingsApiMock = {
  fetchVotingCatalog: vi.fn(async () => createVotingCatalog()),
  exportVoting: vi.fn(async () => createVotingImportPayload()),
  previewVotingImport: vi.fn(async () => createVotingImportPreview()),
  importVoting: vi.fn(async () => createVotingImportResult()),
  deleteVoting: vi.fn(async () => undefined),
};

export const nominationsApiMock = {
  fetchNominations: vi.fn(async () => createNominationList()),
  fetchNomination: vi.fn(async () => createNominationDetail()),
  voteForOption: vi.fn(async () => createVoteResult()),
};

export const serviceApiMock = {
  ApiError,
  headlessLogin: vi.fn(async () => ({ ok: true as const, token: 'token' })),
  headlessSignup: vi.fn(async () => ({ ok: true as const, token: 'token' })),
  me: vi.fn(async () => createSuperuserProfile()),
  updateProfile: vi.fn(async () => ({ ok: true })),
  uploadAvatar: vi.fn(async () => ({
    ok: true,
    avatar_url: 'https://example.com/avatar.png',
    avatar_source: 'upload',
    avatar_gravatar_enabled: false,
  })),
  deleteAvatar: vi.fn(async () => ({
    ok: true,
    avatar_url: null,
    avatar_source: 'none',
    avatar_gravatar_enabled: false,
  })),
  getEmailStatus: vi.fn(async () => ({ email: 'root@example.com', verified: true })),
  changeEmail: vi.fn(async () => ({ ok: true })),
  resendEmailVerification: vi.fn(async () => ({ ok: true })),
  changePassword: vi.fn(async () => ({ ok: true })),
  listSessionsHeadless: vi.fn(async () => []),
  revokeSessionHeadless: vi.fn(async (id: string | null) => ({ ok: true, id, revoked_reason: null })),
  bulkRevokeSessionsHeadless: vi.fn(async () => ({ ok: true, revoked_ids: [] as string[] })),
  doLogin: vi.fn(async () => ({ ok: true as const, token: 'token' })),
  doSignupAndLogin: vi.fn(async () => ({ ok: true as const, token: 'token' })),
  beginPasskeyLogin: vi.fn(async () => ({ request_options: {} })),
  completePasskeyLogin: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
  getOAuthProviders: vi.fn(async () => [{ id: 'github', name: 'GitHub' }]),
  getOAuthLink: vi.fn(async (providerId: string, next: string) => ({
    url: `/oauth/${providerId}?next=${encodeURIComponent(next)}`,
    method: 'GET',
  })),
  fetchMfaStatus: vi.fn(async () => ({
    has_totp: true,
    has_webauthn: false,
    has_recovery_codes: true,
    recovery_codes_left: 5,
  })),
  beginTotp: vi.fn(async () => ({
    secret: 'secret',
    otpauth_url: 'otpauth://totp',
    svg: '<svg></svg>',
    svg_data_uri: 'data:image/svg+xml;base64,',
  })),
  confirmTotp: vi.fn(async () => ({ ok: true, recovery_codes: ['111111', '222222'] })),
  disableTotp: vi.fn(async () => undefined),
  regenerateRecoveryCodes: vi.fn(async () => ['333333', '444444']),
  passkeysBegin: vi.fn(async () => ({ creation_options: {} as PublicKeyCredentialCreationOptions })),
  passkeysComplete: vi.fn(async () => ({ ok: true, authenticator: undefined, recovery_codes: [] })),
  listAuthenticators: vi.fn(async () => []),
  deleteWebAuthnAuthenticators: vi.fn(async () => undefined),
  renameWebAuthnAuthenticator: vi.fn(async () => undefined),
};

export const adminVotingsApiMock = {
  fetchAdminVotings: vi.fn(async () => createAdminVotingList()),
  fetchAdminVoting: vi.fn(async () => createAdminVotingDetail()),
  fetchAdminStats: vi.fn(async () => createAdminStats()),
  updateAdminVotingMeta: vi.fn(async (_id: string, payload: Record<string, unknown>) => ({
    ...createAdminVotingDetail(),
    ...payload,
  })),
};

export const gamesApiMock = {
  fetchGames: vi.fn(async () => createGames()),
  createGame: vi.fn(async (payload: Partial<Game>) => ({
    id: 'game-new',
    title: payload.title ?? 'Новая игра',
    genre: payload.genre ?? null,
    studio: payload.studio ?? null,
    releaseYear: payload.releaseYear ?? null,
    description: payload.description ?? null,
    imageUrl: payload.imageUrl ?? null,
  })),
  updateGame: vi.fn(async (id: string, payload: Partial<Game>) => ({
    ...createGames()[0],
    ...payload,
    id,
  })),
};

export const resetAllApiMocks = () => {
  votingsApiMock.fetchVotingCatalog.mockReset().mockResolvedValue(createVotingCatalog());
  votingsApiMock.exportVoting.mockReset().mockResolvedValue(createVotingImportPayload());
  votingsApiMock.previewVotingImport.mockReset().mockResolvedValue(createVotingImportPreview());
  votingsApiMock.importVoting.mockReset().mockResolvedValue(createVotingImportResult());
  votingsApiMock.deleteVoting.mockReset().mockResolvedValue(undefined);

  nominationsApiMock.fetchNominations.mockReset().mockResolvedValue(createNominationList());
  nominationsApiMock.fetchNomination.mockReset().mockResolvedValue(createNominationDetail());
  nominationsApiMock.voteForOption.mockReset().mockResolvedValue(createVoteResult());

  const superuserProfile: AccountProfile = createSuperuserProfile();
  serviceApiMock.headlessLogin.mockReset().mockResolvedValue({ ok: true, token: 'token' });
  serviceApiMock.headlessSignup.mockReset().mockResolvedValue({ ok: true, token: 'token' });
  serviceApiMock.me.mockReset().mockResolvedValue(superuserProfile);
  serviceApiMock.updateProfile.mockReset().mockResolvedValue({ ok: true });
  serviceApiMock.uploadAvatar.mockReset().mockResolvedValue({
    ok: true,
    avatar_url: superuserProfile.avatar_url,
    avatar_source: 'upload',
    avatar_gravatar_enabled: false,
  });
  serviceApiMock.deleteAvatar.mockReset().mockResolvedValue({
    ok: true,
    avatar_url: null,
    avatar_source: 'none',
    avatar_gravatar_enabled: false,
  });
  serviceApiMock.getEmailStatus.mockReset().mockResolvedValue({ email: superuserProfile.email, verified: true });
  serviceApiMock.changeEmail.mockReset().mockResolvedValue({ ok: true });
  serviceApiMock.resendEmailVerification.mockReset().mockResolvedValue({ ok: true });
  serviceApiMock.changePassword.mockReset().mockResolvedValue({ ok: true });
  serviceApiMock.listSessionsHeadless.mockReset().mockResolvedValue([]);
  serviceApiMock.revokeSessionHeadless.mockReset().mockResolvedValue({ ok: true, id: null, revoked_reason: null });
  serviceApiMock.bulkRevokeSessionsHeadless.mockReset().mockResolvedValue({ ok: true, revoked_ids: [] });
  serviceApiMock.doLogin.mockReset().mockResolvedValue({ ok: true, token: 'token' });
  serviceApiMock.doSignupAndLogin.mockReset().mockResolvedValue({ ok: true, token: 'token' });
  serviceApiMock.beginPasskeyLogin.mockReset().mockResolvedValue({ request_options: {} });
  serviceApiMock.completePasskeyLogin.mockReset().mockResolvedValue(undefined);
  serviceApiMock.logout.mockReset().mockResolvedValue(undefined);
  serviceApiMock.getOAuthProviders.mockReset().mockResolvedValue([{ id: 'github', name: 'GitHub' }]);
  serviceApiMock.getOAuthLink.mockReset().mockResolvedValue({
    url: '/oauth/github?next=/',
    method: 'GET',
  });
  serviceApiMock.fetchMfaStatus.mockReset().mockResolvedValue({
    has_totp: true,
    has_webauthn: false,
    has_recovery_codes: true,
    recovery_codes_left: 5,
  });
  serviceApiMock.beginTotp.mockReset().mockResolvedValue({
    secret: 'secret',
    otpauth_url: 'otpauth://totp',
    svg: '<svg></svg>',
    svg_data_uri: 'data:image/svg+xml;base64,',
  });
  serviceApiMock.confirmTotp.mockReset().mockResolvedValue({ ok: true, recovery_codes: ['111111', '222222'] });
  serviceApiMock.disableTotp.mockReset().mockResolvedValue(undefined);
  serviceApiMock.regenerateRecoveryCodes.mockReset().mockResolvedValue(['333333', '444444']);
  serviceApiMock.passkeysBegin.mockReset().mockResolvedValue({ creation_options: {} as PublicKeyCredentialCreationOptions });
  serviceApiMock.passkeysComplete.mockReset().mockResolvedValue({ ok: true, authenticator: undefined, recovery_codes: [] });
  serviceApiMock.listAuthenticators.mockReset().mockResolvedValue([]);
  serviceApiMock.deleteWebAuthnAuthenticators.mockReset().mockResolvedValue(undefined);
  serviceApiMock.renameWebAuthnAuthenticator.mockReset().mockResolvedValue(undefined);

  adminVotingsApiMock.fetchAdminVotings.mockReset().mockResolvedValue(createAdminVotingList());
  adminVotingsApiMock.fetchAdminVoting.mockReset().mockResolvedValue(createAdminVotingDetail());
  adminVotingsApiMock.fetchAdminStats.mockReset().mockResolvedValue(createAdminStats());
  adminVotingsApiMock.updateAdminVotingMeta
    .mockReset()
    .mockImplementation(async (_id: string, payload: Record<string, unknown>) => ({
      ...createAdminVotingDetail(),
      ...payload,
    }));

  const games: Game[] = createGames();
  gamesApiMock.fetchGames.mockReset().mockResolvedValue(games);
  gamesApiMock.createGame.mockReset().mockImplementation(async (payload: Partial<Game>) => ({
    id: 'game-new',
    title: payload.title ?? 'Новая игра',
    genre: payload.genre ?? null,
    studio: payload.studio ?? null,
    releaseYear: payload.releaseYear ?? null,
    description: payload.description ?? null,
    imageUrl: payload.imageUrl ?? null,
  }));
  gamesApiMock.updateGame.mockReset().mockImplementation(async (id: string, payload: Partial<Game>) => ({
    ...games[0],
    ...payload,
    id,
  }));
};

resetAllApiMocks();
