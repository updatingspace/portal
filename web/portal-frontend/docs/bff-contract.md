# Frontend ↔ BFF contract (portal-frontend)

All browser traffic must be same-origin and go through BFF under `/api/v1/*`.

## Auth / Session

- `GET /api/v1/session/me`
  - 200: returns session payload (user, tenant, optional capabilities/feature flags)
    - `user`: `{ id, master_flags }`
    - `tenant`: `{ id, slug }`
    - `portal_profile`: cached profile fields (may be null)
    - `id_profile`: snapshot from UpdSpaceID `/me` including `user` and `memberships`
    - `tenant_membership`: membership for current tenant (derived from `id_profile.memberships`)
    - `id_frontend_base_url`: base URL for UpdSpaceID UI (frontend builds `/account` link)
    - `request_id`: for troubleshooting
  - 401: not authenticated

- `POST /api/v1/logout`
  - 200/204: clears session cookie (HttpOnly)

- `GET /api/v1/auth/login?next=/app` (or configured via `VITE_LOGIN_PATH`)
  - Starts auth flow (BFF handles redirects to UpdSpaceID)

## Error envelope

Frontend expects an error payload compatible with:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message",
    "details": {},
    "request_id": "req_..."
  }
}
```

`request_id` must be present either in the envelope or as a top-level `request_id`.
Frontend displays it in toast messages for support.
