import { ApiError, apiBaseUrl, request, isApiError } from '../api/client';
export { ApiError } from '../api/client';
import {
  clearSessionToken,
  getSessionToken,
  setSessionToken,
} from '../api/sessionToken';

export type AccountProfile = {
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  has_2fa: boolean;
  oauth_providers: string[];
  email_verified: boolean;
  is_staff: boolean;
  is_superuser: boolean;
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

const toApiUrl = (path: string) =>
  `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;

const statusToKind = (status: number) => {
  if (status === 401) return 'unauthorized' as const;
  if (status === 403) return 'forbidden' as const;
  if (status === 404) return 'not_found' as const;
  if (status >= 500) return 'server' as const;
  return 'unknown' as const;
};

const parseErrorMessage = async (response: Response) => {
  try {
    const data = await response.clone().json();
    if (typeof data?.detail === 'string') return data.detail;
    if (typeof data?.message === 'string') return data.message;
  } catch {
    /* ignore */
  }
  return null;
};

async function fetchJsonWithHeaders(
  path: string,
  init: RequestInit,
  { includeSessionToken = false }: { includeSessionToken?: boolean } = {},
): Promise<{ data: any; response: Response }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  const sessionToken = includeSessionToken ? getSessionToken() : null;
  if (sessionToken) {
    headers['X-Session-Token'] = sessionToken;
  }
  const response = await fetch(toApiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const messageFromBody = await parseErrorMessage(response);
    const message =
      messageFromBody ?? `Запрос завершился с ошибкой (${response.status})`;
    throw new ApiError(message, {
      status: response.status,
      kind: statusToKind(response.status),
    });
  }
  const data = response.status === 204 ? null : await response.json();
  return { data, response };
}

export async function headlessLogin(
  email: string,
  password: string,
  mfa_code?: string,
  recovery_code?: string,
): Promise<{ token: string; meta?: unknown }> {
  const { data, response } = await fetchJsonWithHeaders(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password, mfa_code, recovery_code }),
    },
    { includeSessionToken: false },
  );
  const token =
    response.headers.get('X-Session-Token') ||
    data?.meta?.session_token ||
    data?.session_token ||
    '';
  if (token) {
    setSessionToken(token);
  }
  return { token, meta: data?.meta ?? data };
}

export async function headlessSignup(
  username: string,
  email: string | null,
  password: string,
): Promise<{ token: string; meta?: unknown }> {
  const { data, response } = await fetchJsonWithHeaders(
    '/auth/signup',
    {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    },
    { includeSessionToken: false },
  );
  const token =
    response.headers.get('X-Session-Token') ||
    data?.meta?.session_token ||
    data?.session_token ||
    '';
  if (token) {
    setSessionToken(token);
  }
  return { token, meta: data?.meta ?? data };
}

export async function me(): Promise<AccountProfile> {
  try {
    return await request<AccountProfile>('/auth/me');
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthorized') {
      clearSessionToken();
    }
    throw error;
  }
}

export async function updateProfile(body: {
  first_name?: string;
  last_name?: string;
}): Promise<OkOut> {
  return request('/auth/profile', { method: 'PATCH', body });
}

export async function uploadAvatar(file: File): Promise<OkOut> {
  const form = new FormData();
  form.append('avatar', file);
  const headers: Record<string, string> = {};
  const token = getSessionToken();
  if (token) headers['X-Session-Token'] = token;
  const response = await fetch(toApiUrl('/auth/avatar'), {
    method: 'POST',
    body: form,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const message =
      (await parseErrorMessage(response)) ??
      `Запрос завершился с ошибкой (${response.status})`;
    throw new ApiError(message, {
      status: response.status,
      kind: statusToKind(response.status),
    });
  }
  return response.json();
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
  const data = await request<{ sessions: SessionRow[] }>('/auth/sessions');
  return Array.isArray((data as any)?.sessions) ? data.sessions : [];
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
}) {
  return headlessLogin(payload.email, payload.password, payload.mfa_code, payload.recovery_code);
}

export async function doSignupAndLogin(payload: {
  username: string;
  email: string;
  password: string;
}) {
  return headlessSignup(payload.username, payload.email, payload.password);
}

export async function beginPasskeyLogin(): Promise<{ request_options: any }> {
  return request('/auth/passkeys/login/begin', { method: 'POST' });
}

export async function completePasskeyLogin(credential: any): Promise<void> {
  const res = await request<{ meta: { session_token: string } }>('/auth/passkeys/login/complete', {
    method: 'POST',
    body: { credential },
  });
  if (res?.meta?.session_token) {
    setSessionToken(res.meta.session_token);
  }
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
  clearSessionToken();
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
export async function passkeysBegin(passwordless = false): Promise<{ creation_options: any }> {
  return request('/auth/passkeys/begin', { method: 'POST', body: { passwordless } });
}

export async function passkeysComplete(payload: {
  name: string;
  credential: any;
  passwordless?: boolean;
}): Promise<{ ok: boolean; authenticator?: any; recovery_codes?: string[] | null }> {
  return request('/auth/passkeys/complete', {
    method: 'POST',
    body: {
      name: payload.name,
      credential: payload.credential,
      passwordless: payload.passwordless ?? false,
    },
  });
}

export async function listAuthenticators(): Promise<any[]> {
  const data = await request<{ authenticators: any[] }>('/auth/passkeys');
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
