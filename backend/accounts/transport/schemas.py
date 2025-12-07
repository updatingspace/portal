from __future__ import annotations

from datetime import datetime

from ninja import Schema


# ---------- Generic ----------
class FieldErrorItem(Schema):
    message: str
    code: str | None = None


class ErrorOut(Schema):
    # Machine-readable error code, e.g. INVALID_CREDENTIALS
    code: str
    # Human-readable message for UI display
    message: str
    # Optional structured payload for debugging or validation details
    details: dict | None = None
    # Optional structured validation payload (e.g., Django form errors)
    errors: dict[str, list[FieldErrorItem]] | None = None
    # Convenience: first message per field (flat)
    fields: dict[str, str] | None = None
    # Legacy fields kept for backward compatibility with older clients
    detail: str | None = None
    status: int | None = None


class OkOut(Schema):
    ok: bool
    message: str | None = None


class AvatarOut(Schema):
    ok: bool
    message: str | None = None
    avatar_url: str | None = None
    avatar_source: str | None = None
    avatar_gravatar_enabled: bool | None = None


# ---------- Profile / Email ----------
class ProfileUpdateIn(Schema):
    first_name: str | None = None
    last_name: str | None = None


class EmailStatusOut(Schema):
    email: str | None = None
    verified: bool = False


class ChangeEmailIn(Schema):
    new_email: str


# ---------- Sessions ----------
class SessionRowOut(Schema):
    id: str | None
    user_agent: str | None
    ip: str | None
    created: datetime | None
    last_seen: datetime | None
    expires: datetime | None
    current: bool
    revoked: bool
    revoked_reason: str | None
    revoked_at: datetime | None


class SessionsOut(Schema):
    sessions: list[SessionRowOut]


class RevokeSessionsIn(Schema):
    ids: list[str] | None = None
    all_except_current: bool = False
    reason: str | None = None


class RevokeOut(Schema):
    ok: bool
    # bulk
    reason: str | None = None
    current: str | None = None
    revoked_ids: list[str] | None = None
    skipped_ids: list[str] | None = None
    count: int | None = None
    # single
    id: str | None = None
    revoked_reason: str | None = None
    revoked_at: str | None = None


# ---------- Auth / JWT ----------
class TokenPairOut(Schema):
    access: str
    refresh: str


class TokenRefreshIn(Schema):
    refresh: str


class TokenRefreshOut(Schema):
    refresh: str
    access: str | None = None


class ChangePasswordIn(Schema):
    current_password: str
    new_password: str


class ProfileOut(Schema):
    username: str
    email: str
    has_2fa: bool
    oauth_providers: list[str]
    is_staff: bool = False
    is_superuser: bool = False
    first_name: str | None = None
    last_name: str | None = None
    avatar_url: str | None = None
    avatar_source: str | None = None
    avatar_gravatar_enabled: bool | None = None
    email_verified: bool = False


# ---------- Headless (session token) ----------
class SessionMetaOut(Schema):
    session_token: str


class LoginOut(Schema):
    meta: SessionMetaOut
    user: ProfileOut | None = None
    access_token: str | None = None
    refresh_token: str | None = None


class LoginIn(Schema):
    email: str
    password: str
    mfa_code: str | None = None
    recovery_code: str | None = None
    form_token: str | None = None


class SignupIn(Schema):
    username: str
    email: str | None = None
    password: str
    form_token: str | None = None


class CurrentUserOut(Schema):
    user: ProfileOut | None


class FormTokenOut(Schema):
    form_token: str
    expires_in: int


# ---------- OAuth linking ----------
class ProvidersOut(Schema):
    providers: list[dict]


class OAuthLinkOut(Schema):
    authorize_url: str
    method: str


# ---------- Passkeys / WebAuthn ----------
class AuthenticatorOut(Schema):
    id: str
    name: str | None = None
    type: str = "webauthn"
    created_at: int | None = None
    last_used_at: int | None = None
    is_passwordless: bool = True


class AuthenticatorsOut(Schema):
    authenticators: list[AuthenticatorOut]


class PasskeyBeginIn(Schema):
    passwordless: bool = False


class PasskeyBeginOut(Schema):
    creation_options: dict


class PasskeyCompleteIn(Schema):
    name: str | None = None
    credential: dict
    passwordless: bool = False


class PasskeyRenameIn(Schema):
    authenticator_id: str
    new_name: str


class PasskeyDeleteIn(Schema):
    ids: list[str]


class PasskeyCompleteOut(Schema):
    ok: bool
    authenticator: AuthenticatorOut | None = None
    recovery_codes: list[str] | None = None


# ---------- Passkey login ----------
class PasskeyLoginBeginOut(Schema):
    request_options: dict


class PasskeyLoginCompleteIn(Schema):
    credential: dict


class PasskeyLoginOut(Schema):
    meta: SessionMetaOut


# ---------- MFA / TOTP ----------
class MfaStatusOut(Schema):
    has_totp: bool
    has_webauthn: bool
    has_recovery_codes: bool
    recovery_codes_left: int


class TotpBeginOut(Schema):
    secret: str
    otpauth_url: str
    svg: str
    svg_data_uri: str


class TotpConfirmIn(Schema):
    code: str


class TotpConfirmOut(Schema):
    ok: bool
    recovery_codes: list[str] | None = None


class RecoveryCodesOut(Schema):
    recovery_codes: list[str]


for _m in (
    FieldErrorItem,
    ErrorOut,
    OkOut,
    ProfileUpdateIn,
    EmailStatusOut,
    ChangeEmailIn,
    SessionRowOut,
    SessionsOut,
    RevokeSessionsIn,
    RevokeOut,
    TokenPairOut,
    TokenRefreshIn,
    TokenRefreshOut,
    ChangePasswordIn,
    ProfileOut,
    SessionMetaOut,
    LoginOut,
    LoginIn,
    SignupIn,
    ProvidersOut,
    OAuthLinkOut,
    AuthenticatorOut,
    AuthenticatorsOut,
    PasskeyBeginIn,
    PasskeyBeginOut,
    PasskeyCompleteIn,
    PasskeyDeleteIn,
    PasskeyRenameIn,
    MfaStatusOut,
    TotpBeginOut,
    TotpConfirmIn,
    TotpConfirmOut,
    CurrentUserOut,
    FormTokenOut,
):
    try:
        _m.model_rebuild()
    except Exception:
        pass
