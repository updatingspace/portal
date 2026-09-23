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

Proxy requests and OIDC token/userinfo calls reuse a bounded HTTP connection pool within each worker process
(100 connections, at most 20 idle connections retained for 30 seconds). Each
request still gets its own HTTPX client, so upstream cookies and per-user headers
are never shared between callers. Streaming responses release their connection
when consumed or closed; timeouts remain request-specific. The pool is created
lazily, reset after a worker fork and closed on process exit. It sends no keepalive
requests and does not provision or keep serverless instances warm.

When an HTTP(S)/ALL proxy is configured in the environment, the existing HTTPX
client behavior is retained so proxy routing and `NO_PROXY` remain effective.
Default TLS certificate verification remains enabled.

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
