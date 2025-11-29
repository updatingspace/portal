from __future__ import annotations

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth import logout as django_logout
from django.core.exceptions import ValidationError
from ninja import Router
from ninja.errors import HttpError

from allauth.account import app_settings as allauth_settings
from allauth.account.utils import perform_login

from .schemas import (
    AuthResponseSchema,
    LoginRequestSchema,
    ProfileResponseSchema,
    RegisterRequestSchema,
    SessionSchema,
)
from .services import (
    create_local_user,
    ensure_session_key,
    get_current_session_schema,
    list_user_sessions,
    revoke_session_for_user,
    serialize_user,
    touch_session_metadata,
)

User = get_user_model()
router = Router(tags=["auth"])


def _auth_guard(request):
    if not request.user.is_authenticated:
        raise HttpError(401, "Требуется авторизация")


def _auth_response(request, user) -> AuthResponseSchema:
    touch_session_metadata(request)
    return AuthResponseSchema(user=serialize_user(user), session=get_current_session_schema(request))


@router.post("/register", response=AuthResponseSchema)
def register(request, payload: RegisterRequestSchema):
    if payload.password != payload.password_confirm:
        raise HttpError(400, "Пароли не совпадают")

    try:
        user = create_local_user(payload.username, payload.email, payload.password)
    except ValidationError as exc:
        message = "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc)
        raise HttpError(400, message)

    perform_login(request, user, email_verification=allauth_settings.EMAIL_VERIFICATION)
    return _auth_response(request, user)


@router.post("/login", response=AuthResponseSchema)
def login(request, payload: LoginRequestSchema):
    user = authenticate(request, username=payload.login, password=payload.password)

    if not user:
        try:
            existing = User.objects.get(email__iexact=payload.login)
        except User.DoesNotExist:
            existing = None

        if existing:
            user = authenticate(
                request,
                username=getattr(existing, "username"),
                password=payload.password,
            )

    if not user:
        raise HttpError(401, "Неверный логин или пароль")

    if not user.is_active:
        raise HttpError(403, "Аккаунт отключен")

    perform_login(request, user, email_verification=allauth_settings.EMAIL_VERIFICATION)
    return _auth_response(request, user)


@router.post("/logout", response={204: None})
def logout(request):
    if request.user.is_authenticated:
        django_logout(request)
    return 204, None


@router.get("/me", response=ProfileResponseSchema)
def profile(request):
    _auth_guard(request)
    touch_session_metadata(request)
    current_key = ensure_session_key(request)

    return ProfileResponseSchema(
        user=serialize_user(request.user),
        sessions=list_user_sessions(request.user, current_session_key=current_key),
    )


@router.get("/sessions", response=list[SessionSchema])
def sessions(request):
    _auth_guard(request)
    current_key = ensure_session_key(request)
    return list_user_sessions(request.user, current_session_key=current_key)


@router.delete("/sessions/{session_key}", response={204: None})
def drop_session(request, session_key: str):
    _auth_guard(request)

    if not revoke_session_for_user(session_key, request.user):
        raise HttpError(404, "Сессия не найдена или уже завершена")

    if request.session.session_key == session_key:
        django_logout(request)

    return 204, None


@router.post("/sessions/revoke_all", response={204: None})
def drop_all_sessions(request):
    _auth_guard(request)

    current_key = request.session.session_key
    for session in list_user_sessions(request.user):
        if session.session_key != current_key:
            revoke_session_for_user(session.session_key, request.user)

    return 204, None
