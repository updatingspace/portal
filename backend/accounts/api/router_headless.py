from ninja import Body, Router
from ninja.responses import Response

from accounts.services.headless import HeadlessService
from accounts.services.passkeys import PasskeyService
from accounts.transport.schemas import (
    ErrorOut,
    LoginIn,
    LoginOut,
    PasskeyLoginBeginOut,
    PasskeyLoginCompleteIn,
    PasskeyLoginOut,
    SignupIn,
)

headless_router = Router(tags=["Auth"])
REQUIRED_BODY = Body(...)


@headless_router.post(
    "/login",
    response={200: LoginOut, 400: ErrorOut},
    summary="Headless login, issues X-Session-Token",
    operation_id="headless_login",
)
def login(request, payload: LoginIn = REQUIRED_BODY):
    st = HeadlessService.login(
        request,
        payload.email,
        payload.password,
        mfa_code=getattr(payload, "mfa_code", None),
        recovery_code=getattr(payload, "recovery_code", None),
    )
    body = {"meta": {"session_token": st}}
    return Response(body, headers={"X-Session-Token": st, "Cache-Control": "no-store"})


@headless_router.post(
    "/signup",
    response={200: LoginOut, 400: ErrorOut},
    summary="Headless signup + login, issues X-Session-Token",
    operation_id="headless_signup",
)
def signup(request, payload: SignupIn = REQUIRED_BODY):
    st = HeadlessService.signup(
        request, payload.username, payload.email, payload.password
    )
    return Response(
        {"meta": {"session_token": st}},
        headers={"X-Session-Token": st, "Cache-Control": "no-store"},
    )


@headless_router.post(
    "/passkeys/login/begin",
    response={200: PasskeyLoginBeginOut},
    summary="Begin passkey authentication",
    operation_id="headless_passkey_login_begin",
)
def passkey_login_begin(request):
    opts = PasskeyService.begin_login(request)
    return PasskeyLoginBeginOut(request_options=opts)


@headless_router.post(
    "/passkeys/login/complete",
    response={200: PasskeyLoginOut, 400: ErrorOut},
    summary="Complete passkey authentication",
    operation_id="headless_passkey_login_complete",
)
def passkey_login_complete(request, payload: PasskeyLoginCompleteIn = REQUIRED_BODY):
    user, _ = PasskeyService.complete_login(request, payload.credential)
    st = HeadlessService.issue_session_token(request)
    return Response(
        {"meta": {"session_token": st}},
        headers={"X-Session-Token": st, "Cache-Control": "no-store"},
    )
