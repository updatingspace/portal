import {
  ApiError,
  request,
  requestResult,
} from '../api/client';
export { ApiError } from '../api/client';

export type AccountProfile = {
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  avatar_source?: string | null;
  avatar_gravatar_enabled?: boolean | null;
  has_2fa: boolean;
  oauth_providers: string[];
  email_verified: boolean;
  is_staff: boolean;
  is_superuser: boolean;
};

export type UpdspaceIdUser = {
  user_id: string;
  username?: string | null;
  display_name?: string | null;
  email?: string | null;
  email_verified?: boolean;
  status?: string | null;
  system_admin?: boolean | null;
  created_at?: string | null;
};

export type UpdspaceIdMembership = {
  tenant_id?: string | null;
  tenant_slug?: string | null;
  status?: string | null;
  base_role?: string | null;
};

export type SessionMe = {
  user: { id: string; master_flags: Record<string, unknown> };
  tenant?: { id: string; slug: string } | null;
  feature_flags?: Record<string, boolean>;
  portal_profile?: unknown;
  id_defaults?: {
    theme?: 'light' | 'dark' | 'auto' | null;
  } | null;
  id_profile?: {
    user?: UpdspaceIdUser | null;
    memberships?: UpdspaceIdMembership[] | null;
  } | null;
  tenant_membership?: UpdspaceIdMembership | null;
  id_frontend_base_url?: string | null;
  request_id?: string | null;
};

export type SessionRow = {
  id: string | null;
  user_agent?: string | null;
  ip?: string | null;
  created?: string | null;
  last_seen?: string | null;
  expires?: string | null;
  current: boolean;
  revoked: boolean;
  revoked_reason?: string | null;
  revoked_at?: string | null;
};

type OkOut = { ok: boolean; message?: string | null };
export type AvatarResponse = {
  ok: boolean;
  message?: string | null;
  avatar_url?: string | null;
  avatar_source?: string | null;
  avatar_gravatar_enabled?: boolean | null;
};

const statusToKind = (status: number) => {
  if (status === 401) return 'unauthorized' as const;
  if (status === 403) return 'forbidden' as const;
  if (status === 404) return 'not_found' as const;
  if (status >= 500) return 'server' as const;
  return 'unknown' as const;
};

type AuthResponseMeta = {
  meta?: unknown | null;
};

export type HeadlessLoginResult =
  | { ok: true; meta?: unknown; user?: AccountProfile | null }
  | { ok: false; code?: string; message?: string; retryAfterSeconds?: number };

const extractRetryAfterSeconds = (details: unknown): number | undefined => {
  if (!details || typeof details !== 'object') return undefined;
  const retry = (details as { retry_after_seconds?: unknown }).retry_after_seconds;
  if (typeof retry === 'number') return retry;
  if (typeof retry === 'string' && retry.trim()) {
    const parsed = Number(retry);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

export async function fetchFormToken(
  purpose: 'login' | 'register',
): Promise<{ token: string; expiresIn: number }> {
  const data = await request<{ form_token: string; expires_in: number }>(
    `/auth/form_token?purpose=${purpose}`,
  );
  return { token: data.form_token, expiresIn: data.expires_in };
}

export async function headlessLogin(
  email: string,
  password: string,
  mfa_code?: string,
  recovery_code?: string,
  form_token?: string,
): Promise<HeadlessLoginResult> {
  const res = await requestResult<AuthResponseMeta & { user?: AccountProfile | null }>(
    '/auth/login',
    {
      method: 'POST',
      body: { email, password, mfa_code, recovery_code, form_token },
      skipAuthClear: true,
      treatAsBusiness: ['LOGIN_RATE_LIMITED', 'INVALID_FORM_TOKEN', 'VALIDATION_ERROR'],
    },
  );
  if (!res.ok) {
    return {
      ok: false,
      code: res.error.code,
      message: res.error.message,
      retryAfterSeconds: extractRetryAfterSeconds(res.error.details),
    };
  }
  return {
    ok: true,
    meta: res.data?.meta ?? res.data,
    user: (res.data as { user?: AccountProfile | null } | null | undefined)?.user ?? null,
  };
}

export async function headlessSignup(
  username: string,
  email: string | null,
  password: string,
  form_token?: string,
): Promise<HeadlessLoginResult> {
  const res = await requestResult<AuthResponseMeta & { user?: AccountProfile | null }>(
    '/auth/signup',
    {
      method: 'POST',
      body: { username, email, password, form_token },
      skipAuthClear: true,
      treatAsBusiness: [
        'REGISTER_RATE_LIMITED',
        'INVALID_FORM_TOKEN',
        'EMAIL_ALREADY_EXISTS',
        'VALIDATION_ERROR',
      ],
    },
  );
  if (!res.ok) {
    return {
      ok: false,
      code: res.error.code,
      message: res.error.message,
      retryAfterSeconds: extractRetryAfterSeconds(res.error.details),
    };
  }
  return {
    ok: true,
    meta: res.data?.meta ?? res.data,
    user: (res.data as { user?: AccountProfile | null } | null | undefined)?.user ?? null,
  };
}

export async function me(): Promise<AccountProfile | null> {
  const res = await requestResult<{ user: AccountProfile | null }>('/auth/me', {
    skipAuthClear: true,
  });
  if (!res.ok) {
    if (res.status === 401 && res.error.code === 'INVALID_OR_EXPIRED_TOKEN') {
      return null;
    }
    throw new ApiError(res.error.message ?? 'Не удалось получить профиль', {
      status: res.status,
      kind: 'unauthorized',
      details: res.error.details,
    });
  }
  return res.data?.user ?? null;
}

export async function sessionMe(): Promise<SessionMe> {
  return request<SessionMe>('/session/me', { skipAuthClear: true });
}

export async function updateProfile(body: {
  first_name?: string;
  last_name?: string;
}): Promise<OkOut> {
  return request('/auth/profile', { method: 'PATCH', body });
}

export async function uploadAvatar(file: File): Promise<AvatarResponse> {
  const form = new FormData();
  form.append('avatar', file);
  return request('/auth/avatar', {
    method: 'POST',
    body: form,
  });
}

export async function deleteAvatar(): Promise<AvatarResponse> {
  return request('/auth/avatar', { method: 'DELETE' });
}

export async function getEmailStatus(): Promise<{ email: string; verified: boolean }> {
  return request('/auth/email');
}

export async function changeEmail(newEmail: string): Promise<OkOut> {
  return request('/auth/email/change', {
    method: 'POST',
    body: { new_email: newEmail },
  });
}

export async function resendEmailVerification(): Promise<OkOut> {
  return request('/auth/email/resend', { method: 'POST' });
}

export async function changePassword(payload: {
  current_password: string;
  new_password: string;
}): Promise<OkOut> {
  return request('/auth/change_password', { method: 'POST', body: payload });
}

export async function listSessionsHeadless(): Promise<SessionRow[]> {
  const data = await request<{ sessions?: SessionRow[] | null }>('/auth/sessions');
  return Array.isArray(data.sessions) ? data.sessions : [];
}

export async function revokeSessionHeadless(
  id: string,
  reason: string | null = null,
): Promise<{ ok: boolean; id?: string; revoked_reason?: string | null }> {
  const qs = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  return request(`/auth/sessions/${id}${qs}`, {
    method: 'DELETE',
  });
}

export async function bulkRevokeSessionsHeadless(): Promise<{
  ok: boolean;
  revoked_ids?: string[];
}> {
  return request('/auth/sessions/bulk', {
    method: 'POST',
    body: { all_except_current: true, reason: 'bulk_except_current' },
  });
}

export async function doLogin(payload: {
  email: string;
  password: string;
  mfa_code?: string;
  recovery_code?: string;
  form_token?: string;
}) {
  return headlessLogin(
    payload.email,
    payload.password,
    payload.mfa_code,
    payload.recovery_code,
    payload.form_token,
  );
}

export async function doSignupAndLogin(payload: {
  username: string;
  email: string;
  password: string;
  form_token?: string;
}) {
  return headlessSignup(
    payload.username,
    payload.email,
    payload.password,
    payload.form_token,
  );
}

export async function beginPasskeyLogin(): Promise<{ request_options: PublicKeyRequestOptions }> {
  return request('/auth/passkeys/login/begin', { method: 'POST' });
}

export async function completePasskeyLogin(credential: WebAuthnAssertion): Promise<void> {
  const res = await requestResult<AuthResponseMeta>(
    '/auth/passkeys/login/complete',
    {
      method: 'POST',
      body: { credential },
      skipAuthClear: true,
    },
  );
  if (!res.ok) {
    throw new ApiError(res.error.message ?? 'Не удалось войти по Passkey', {
      status: res.status,
      kind: statusToKind(res.status),
      details: res.error.details,
      code: res.error.code,
    });
  }
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

// ----- OAuth linking -----
export async function getOAuthProviders(): Promise<{ id: string; name: string }[]> {
  const data = await request<{ providers: { id: string; name: string }[] }>(
    '/auth/oauth/providers',
  );
  return data.providers ?? [];
}

export async function getOAuthLink(
  providerId: string,
  nextPath: string,
): Promise<{ url: string; method: string }> {
  const data = await request<{ authorize_url: string; method: string }>(
    `/auth/oauth/link/${providerId}?next=${encodeURIComponent(nextPath)}`,
  );
  return { url: data.authorize_url, method: data.method };
}

// ----- MFA / TOTP -----
export type MfaStatus = {
  has_totp: boolean;
  has_webauthn: boolean;
  has_recovery_codes: boolean;
  recovery_codes_left: number;
};

export async function fetchMfaStatus(): Promise<MfaStatus> {
  return request('/auth/mfa/status');
}

export type TotpBegin = {
  secret: string;
  otpauth_url: string;
  svg: string;
  svg_data_uri: string;
};

export async function beginTotp(): Promise<TotpBegin> {
  return request('/auth/mfa/totp/begin', { method: 'POST' });
}

export async function confirmTotp(code: string): Promise<{ ok: boolean; recovery_codes?: string[] | null }> {
  return request('/auth/mfa/totp/confirm', { method: 'POST', body: { code } });
}

export async function disableTotp(): Promise<void> {
  await request('/auth/mfa/totp/disable', { method: 'POST' });
}

export async function regenerateRecoveryCodes(): Promise<string[]> {
  const data = await request<{ recovery_codes: string[] }>('/auth/mfa/recovery/regenerate', {
    method: 'POST',
  });
  return data.recovery_codes ?? [];
}

// ----- Passkeys / WebAuthn -----
type PublicKeyRequestOptions = PublicKeyCredentialRequestOptions | { publicKey: PublicKeyCredentialRequestOptions };
type PublicKeyCreationOptions =
  | PublicKeyCredentialCreationOptions
  | { publicKey: PublicKeyCredentialCreationOptions };

export type WebAuthnAssertion = {
  id: string;
  rawId?: string;
  type: string;
  response: {
    clientDataJSON?: string;
    authenticatorData?: string;
    signature?: string;
    userHandle?: string | null;
  };
};

export type WebAuthnAttestation = {
  id?: string;
  rawId?: string;
  type?: string;
  clientExtensionResults?: Record<string, unknown>;
  response?: Record<string, unknown>;
};

export type AuthenticatorSummary = {
  id: string;
  type: string;
  name?: string | null;
  is_passwordless?: boolean;
  created_at?: number;
  last_used_at?: number | null;
};

export async function passkeysBegin(passwordless = false): Promise<{ creation_options: PublicKeyCreationOptions }> {
  return request('/auth/passkeys/begin', { method: 'POST', body: { passwordless } });
}

export async function passkeysComplete(payload: {
  name: string;
  credential: WebAuthnAttestation;
  passwordless?: boolean;
}): Promise<{ ok: boolean; authenticator?: AuthenticatorSummary; recovery_codes?: string[] | null }> {
  return request('/auth/passkeys/complete', {
    method: 'POST',
    body: {
      name: payload.name,
      credential: payload.credential,
      passwordless: payload.passwordless ?? false,
    },
  });
}

export async function listAuthenticators(): Promise<AuthenticatorSummary[]> {
  const data = await request<{ authenticators: AuthenticatorSummary[] }>('/auth/passkeys');
  return data.authenticators ?? [];
}

export async function deleteWebAuthnAuthenticators(_ids: string[]): Promise<void> {
  await request('/auth/passkeys/delete', { method: 'POST', body: { ids: _ids } });
}

export async function renameWebAuthnAuthenticator(_id: string, _name: string): Promise<void> {
  await request('/auth/passkeys/rename', {
    method: 'POST',
    body: { authenticator_id: _id, new_name: _name },
  });
}
