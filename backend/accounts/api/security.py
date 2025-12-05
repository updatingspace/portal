from __future__ import annotations

from ninja.security.base import AuthBase

from allauth.headless.internal.sessionkit import (
    authenticate_by_x_session_token,
)
from allauth.account.internal.flows.login import (
    AUTHENTICATION_METHODS_SESSION_KEY,
    record_authentication,
)


class SessionTokenAuth(AuthBase):
    """
    Custom X-Session-Token auth that also wires the underlying Django session
    onto the request so downstream allauth flows (reauth/MFA) can read
    authentication records.
    """

    openapi_type = "apiKey"

    def __call__(self, request):
        token = request.headers.get("X-Session-Token")
        if not token:
            return None
        user_session = authenticate_by_x_session_token(token)
        if not user_session:
            return None
        user, session = user_session
        # Attach session and user so forms and flows relying on request.user/session work
        try:
            request._session = session
            request.session = session
        except Exception:
            request._session = session
        request.user = user
        # If this session has no authentication record yet (e.g., created via X-Session-Token),
        # seed one so allauth reauth checks consider it fresh.
        if not session.get(AUTHENTICATION_METHODS_SESSION_KEY):
            record_authentication(request, method="session")
        return user


session_token_auth = SessionTokenAuth()
