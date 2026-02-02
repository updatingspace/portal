from __future__ import annotations

from ninja.security.base import AuthBase

from portal.context import require_portal_context


class BffContextAuth(AuthBase):
    openapi_type = "apiKey"

    def __call__(self, request):
        ctx = require_portal_context(request)
        request.portal_context = ctx
        request.auth = ctx
        return ctx


bff_context_auth = BffContextAuth()
