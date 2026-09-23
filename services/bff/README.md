# BFF Service

Backend For Frontend service. Handles session management, request proxying, and tenant resolution.

## Configuration

See `.env.example`

The pinned YDB backend requires compatibility adapters for UTC datetime reads,
JSON values, nullable/foreign-key writes and transactional updates. A real local
YDB auth/session regression runs in CI, including callback replay, expiration,
tenant isolation and revocation. Run `python scripts/check_ydb_auth_runtime.py`
after `migrate_ydb` with the local YDB environment from `.github/workflows/ci.yml`.
The check refuses non-local databases.

OIDC callback uses the `user_id` UUID claim for the internal Portal identity.
A UUID-shaped `sub` is never a substitute for a linked internal identity.
Subjects without an explicit internal UUID are rejected with `INVALID_USERINFO`
and no session; they must be linked to an UpdSpace identity in ID.

## Run

### Local Dev
```bash
make dev
```

### Docker
```bash
docker build -t bff .
docker run -p 8080:8080 --env-file .env bff
```
