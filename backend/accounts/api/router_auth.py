from ninja import Body, Router

from accounts.api.security import session_token_auth
from accounts.services.auth import AuthService
from accounts.transport.schemas import (
    ChangePasswordIn,
    ErrorOut,
    OkOut,
    ProfileOut,
    TokenPairOut,
    TokenRefreshIn,
    TokenRefreshOut,
)

auth_router = Router(tags=["Auth"])
REQUIRED_BODY = Body(...)


@auth_router.post(
    "/jwt/from_session",
    auth=[session_token_auth],
    response={200: TokenPairOut, 401: ErrorOut},
    summary="Issue JWT pair bound to current session",
    operation_id="auth_jwt_from_session",
)
def jwt_from_session(request):
    return AuthService.issue_pair_for_session(request, request.auth)


@auth_router.post(
    "/logout",
    auth=[session_token_auth],
    response={200: OkOut},
    summary="Logout current session",
    operation_id="auth_logout",
)
def logout_current(request):
    AuthService.logout_current(request)
    return OkOut(ok=True, message="logged out")


@auth_router.get(
    "/me",
    auth=[session_token_auth],
    response={200: ProfileOut, 401: ErrorOut},
    summary="Get current user profile",
    operation_id="auth_me",
)
def me(request):
    return AuthService.profile(request.auth)


@auth_router.post(
    "/change_password",
    auth=[session_token_auth],
    response={200: OkOut, 400: ErrorOut, 401: ErrorOut},
    summary="Change password (requires current password)",
    operation_id="auth_change_password",
)
def change_password(request, payload: ChangePasswordIn = REQUIRED_BODY):
    AuthService.change_password(
        request.auth, payload.current_password, payload.new_password
    )
    return OkOut(ok=True, message="password changed")


@auth_router.post(
    "/refresh",
    response={200: TokenRefreshOut, 401: ErrorOut},
    summary="Refresh JWT pair",
    operation_id="auth_refresh",
)
def refresh_pair(request, payload: TokenRefreshIn = REQUIRED_BODY):
    return AuthService.refresh_pair(payload)
