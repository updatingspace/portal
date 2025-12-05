from django.contrib.auth import get_user_model
from django.db import transaction
from ninja import Body, File, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile

from accounts.api.security import session_token_auth
from accounts.services.emailing import EmailService
from accounts.services.mfa import MfaService
from accounts.services.passkeys import PasskeyService
from accounts.services.profile import ProfileService
from accounts.services.sessions import SessionService
from accounts.transport.schemas import (
    AuthenticatorsOut,
    ChangeEmailIn,
    EmailStatusOut,
    ErrorOut,
    MfaStatusOut,
    OkOut,
    PasskeyBeginIn,
    PasskeyBeginOut,
    PasskeyCompleteIn,
    PasskeyCompleteOut,
    PasskeyDeleteIn,
    PasskeyRenameIn,
    ProfileUpdateIn,
    RecoveryCodesOut,
    RevokeOut,
    RevokeSessionsIn,
    SessionsOut,
    TotpBeginOut,
    TotpConfirmIn,
    TotpConfirmOut,
)

User = get_user_model()
account_router = Router(tags=["Account"], auth=[session_token_auth])
REQUIRED_BODY = Body(...)
REQUIRED_FILE = File(...)


def _require_authenticated_user(request) -> User:
    user = getattr(request, "auth", None)
    if not user or not getattr(user, "is_authenticated", False):
        raise HttpError(401, "Not authenticated")
    # Make sure downstream allauth flows see the authenticated user
    request.user = user
    return user


@account_router.patch(
    "/profile",
    response={200: OkOut, 401: ErrorOut},
    summary="Update profile fields",
    operation_id="account_update_profile",
)
@transaction.atomic
def account_update_profile(request, payload: ProfileUpdateIn = REQUIRED_BODY):
    user = _require_authenticated_user(request)
    ProfileService.update_name(user, first=payload.first_name, last=payload.last_name)
    return OkOut(ok=True, message="Профиль обновлён")


@account_router.post(
    "/avatar",
    response={200: OkOut, 401: ErrorOut},
    summary="Upload/replace user avatar",
    operation_id="account_upload_avatar",
)
def upload_avatar(request, avatar: UploadedFile = REQUIRED_FILE):
    user = _require_authenticated_user(request)
    SessionService.assert_session_allowed(request)
    SessionService.touch(request, user)
    updated = ProfileService.save_avatar(user, avatar)
    if updated:
        return OkOut(ok=True, message="Аватар обновлён")
    return OkOut(ok=True, message="Поле avatar отсутствует в модели пользователя")


@account_router.get(
    "/email",
    response={200: EmailStatusOut, 401: ErrorOut},
    summary="Get primary email & verification state",
    operation_id="account_email_status",
)
def account_email_status(request):
    user = _require_authenticated_user(request)
    return EmailService.status(user)


@account_router.post(
    "/email/change",
    response={200: OkOut, 400: ErrorOut, 401: ErrorOut},
    summary="Request email change (sends confirmation)",
    operation_id="account_change_email",
)
@transaction.atomic
def account_change_email(request, payload: ChangeEmailIn = REQUIRED_BODY):
    user = _require_authenticated_user(request)
    EmailService.request_change(request, user, new_email=payload.new_email)
    return OkOut(ok=True, message="Проверьте почту, чтобы подтвердить новый адрес")


@account_router.post(
    "/email/resend",
    response={200: OkOut, 401: ErrorOut},
    summary="Resend email confirmation",
    operation_id="account_resend_email",
)
def account_resend_email_verification(request):
    user = _require_authenticated_user(request)
    EmailService.resend_confirmation(request, user)
    return OkOut(ok=True, message="Письмо с подтверждением отправлено")


@account_router.get(
    "/sessions",
    response={200: SessionsOut, 401: ErrorOut},
    summary="List current user sessions",
    operation_id="account_list_sessions",
)
def list_sessions(request):
    user = _require_authenticated_user(request)
    SessionService.assert_session_allowed(request)
    SessionService.touch(request, user)
    return SessionsOut(sessions=SessionService.list(request, user))


@account_router.post(
    "/sessions/bulk",
    response={200: RevokeOut, 401: ErrorOut},
    summary="Revoke sessions in bulk",
    operation_id="account_revoke_sessions_bulk",
)
def revoke_sessions_bulk(request, payload: RevokeSessionsIn = REQUIRED_BODY):
    _require_authenticated_user(request)
    return SessionService.revoke_bulk(request, payload)


@account_router.post(
    "/sessions/_bulk",
    response={200: RevokeOut, 401: ErrorOut},
    summary="Revoke sessions in bulk (compat)",
    operation_id="account_revoke_sessions_bulk_compat",
)
def revoke_sessions_bulk_compat(request, payload: RevokeSessionsIn = REQUIRED_BODY):
    _require_authenticated_user(request)
    return SessionService.revoke_bulk(request, payload)


@account_router.delete(
    "/sessions/{sid}",
    response={200: RevokeOut, 401: ErrorOut, 404: ErrorOut},
    summary="Revoke single session",
    operation_id="account_revoke_session",
)
def revoke_session(request, sid: str, reason: str | None = None):
    _require_authenticated_user(request)
    return SessionService.revoke_single(request, sid=sid, reason=reason)


@account_router.get(
    "/passkeys",
    response={200: AuthenticatorsOut, 401: ErrorOut},
    summary="List WebAuthn authenticators (passkeys)",
    operation_id="passkeys_list",
)
def list_passkeys(request):
    user = _require_authenticated_user(request)
    return PasskeyService.list_authenticators(user)


@account_router.post(
    "/passkeys/begin",
    response={200: PasskeyBeginOut, 401: ErrorOut},
    summary="Begin WebAuthn registration ceremony",
    operation_id="passkeys_begin",
)
def passkeys_begin(request, payload: PasskeyBeginIn = REQUIRED_BODY):
    user = _require_authenticated_user(request)
    options = PasskeyService.begin_registration(
        request, user, passwordless=payload.passwordless
    )
    return PasskeyBeginOut(creation_options=options)


@account_router.post(
    "/passkeys/delete",
    response={200: OkOut, 401: ErrorOut},
    summary="Delete WebAuthn authenticators",
    operation_id="passkeys_delete",
)
def delete_passkeys(request, payload: PasskeyDeleteIn = REQUIRED_BODY):
    user = _require_authenticated_user(request)
    count = PasskeyService.delete(request, user, payload.ids)
    return OkOut(ok=True, message=f"Удалено {count} Passkey")


@account_router.post(
    "/passkeys/rename",
    response={200: OkOut, 401: ErrorOut},
    summary="Rename WebAuthn authenticator",
    operation_id="passkeys_rename",
)
def rename_passkey(request, payload: PasskeyRenameIn = REQUIRED_BODY):
    _require_authenticated_user(request)
    PasskeyService.rename(
        request,
        authenticator_id=payload.authenticator_id,
        new_name=payload.new_name,
    )
    return OkOut(ok=True, message="Название обновлено")


@account_router.post(
    "/passkeys/complete",
    response={200: PasskeyCompleteOut, 401: ErrorOut, 400: ErrorOut},
    summary="Complete WebAuthn registration",
    operation_id="passkeys_complete",
)
def passkeys_complete(request, payload: PasskeyCompleteIn = REQUIRED_BODY):
    _require_authenticated_user(request)
    name = payload.name or "Passkey"
    auth, rc = PasskeyService.complete_registration(
        request, name=name, credential=payload.credential
    )
    rc_codes = None
    if rc and rc.type == rc.Type.RECOVERY_CODES:
        from allauth.mfa.recovery_codes.internal.auth import RecoveryCodes

        rc_codes = RecoveryCodes(rc).get_unused_codes()
    auth_out = {
        "id": str(auth.id),
        "name": auth.data.get("name"),
        "type": "webauthn",
        "created_at": int(auth.created_at.timestamp()),
        "last_used_at": (
            int(auth.last_used_at.timestamp()) if auth.last_used_at else None
        ),
        "is_passwordless": bool(
            auth.data.get("credential", {})
            .get("clientExtensionResults", {})
            .get("credProps", {})
            .get("rk")
        ),
    }
    return PasskeyCompleteOut(ok=True, authenticator=auth_out, recovery_codes=rc_codes)


@account_router.get(
    "/mfa/status",
    response={200: MfaStatusOut, 401: ErrorOut},
    summary="MFA status (TOTP/WebAuthn/recovery)",
    operation_id="mfa_status",
)
def mfa_status(request):
    user = _require_authenticated_user(request)
    return MfaService.status(user)


@account_router.post(
    "/mfa/totp/begin",
    response={200: TotpBeginOut, 401: ErrorOut},
    summary="Start TOTP setup (returns QR + secret)",
    operation_id="mfa_totp_begin",
)
def mfa_totp_begin(request):
    _require_authenticated_user(request)
    return MfaService.totp_begin(request)


@account_router.post(
    "/mfa/totp/confirm",
    response={200: TotpConfirmOut, 400: ErrorOut, 401: ErrorOut},
    summary="Confirm TOTP code and activate",
    operation_id="mfa_totp_confirm",
)
def mfa_totp_confirm(request, payload: TotpConfirmIn = REQUIRED_BODY):
    _require_authenticated_user(request)
    rc = MfaService.totp_confirm(request, payload.code)
    return TotpConfirmOut(ok=True, recovery_codes=rc)


@account_router.post(
    "/mfa/totp/disable",
    response={200: OkOut, 400: ErrorOut, 401: ErrorOut, 404: ErrorOut},
    summary="Disable TOTP",
    operation_id="mfa_totp_disable",
)
def mfa_totp_disable(request):
    _require_authenticated_user(request)
    MfaService.totp_disable(request)
    return OkOut(ok=True, message="TOTP отключена")


@account_router.post(
    "/mfa/recovery/regenerate",
    response={200: RecoveryCodesOut, 401: ErrorOut, 404: ErrorOut},
    summary="Regenerate recovery codes",
    operation_id="mfa_recovery_regenerate",
)
def mfa_recovery_regenerate(request):
    _require_authenticated_user(request)
    codes = MfaService.regenerate_recovery_codes(request)
    return RecoveryCodesOut(recovery_codes=codes)
