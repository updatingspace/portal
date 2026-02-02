import { request } from './client';

// Types

export interface UserProfile {
    id: string;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    language?: string | null;
    timezone?: string | null;
}

export interface UpdateProfilePayload {
    first_name?: string;
    last_name?: string;
    display_name?: string;
    language?: string;
    timezone?: string;
}

export interface Session {
    id: string;
    ip: string | null;
    user_agent: string | null;
    created_at: string;
    last_used_at: string | null;
    is_current: boolean;
}

export interface Passkey {
    id: string;
    name: string;
    type: string;
    created_at: number;
    last_used_at: number | null;
    is_passwordless: boolean;
}

export interface MfaStatus {
    totp_enabled: boolean;
    webauthn_enabled: boolean;
    recovery_codes_available: number;
    authenticators: Passkey[];
}

// API Methods

export async function fetchProfile(): Promise<UserProfile> {
    return request<UserProfile>('/account/profile');
}

export async function updateProfile(data: UpdateProfilePayload): Promise<UserProfile> {
    return request<UserProfile>('/account/profile', {
        method: 'PATCH',
        body: data,
    });
}

export async function fetchSessions(): Promise<Session[]> {
    return request<Session[]>('/account/sessions');
}

export async function revokeSession(sessionId: string): Promise<void> {
    return request<void>(`/account/sessions/${sessionId}`, {
        method: 'DELETE',
    });
}

export async function fetchMfaStatus(): Promise<MfaStatus> {
    return request<MfaStatus>('/account/mfa/status');
}

export async function fetchPasskeys(): Promise<Passkey[]> {
    return request<Passkey[]>('/account/passkeys');
}
