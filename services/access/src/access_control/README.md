# Access Control Service (RBAC)

This module implements tenant-isolated RBAC with scoped role bindings and policy overrides.

## Entities

- `Permission(key, description, service)`
- `Role(id, tenant_id?, service, name, is_system_template)`
- `RolePermission(role_id, permission_key)`
- `RoleBinding(id, tenant_id, user_id, scope_type, scope_id, role_id)`
- `PolicyOverride(id, tenant_id, user_id, action: deny|allow, permission_key?, reason, expires_at?)`

Supported `scope_type` values: `GLOBAL | TENANT | COMMUNITY | TEAM | SERVICE`.

## MVP permission keys

Seeded via migration [migrations/0002_seed_mvp_permissions.py](migrations/0002_seed_mvp_permissions.py).

- `portal.roles.read`
- `portal.roles.write`
- `portal.role_bindings.write`
- `portal.permissions.read`
- `voting.vote.cast`
- `voting.votings.admin`
- `voting.nominations.admin`
- `voting.results.read`
- `events.event.create`
- `events.event.manage`
- `activity.feed.read`

## Effective permission algorithm

Inputs: `(tenant_id, user_id, permission_key, scope_type, scope_id, master_flags, overrides, role_bindings)`.

Precedence (highest → lowest):

1. **Master flags** (from UpdSpaceID)
   - `suspended` or `banned` => deny all
   - `system_admin` => allow all (audit/log)
2. **PolicyOverride**
   - `deny` beats `allow`
   - `permission_key = null` applies to **all** permissions
3. **RBAC**
   - permissions are union of all permissions granted by effective roles

### Pseudocode

```text
function check(tenant_id, user_id, permission_key, scope_type, scope_id, master_flags):
  if permission_key not in PermissionCatalog:
     return DENY(reason=UNKNOWN_PERMISSION)

  if master_flags.suspended or master_flags.banned:
     return DENY(reason=MASTER_SUSPENDED)

  if master_flags.system_admin:
     audit("system_admin allow", ...)
     return ALLOW(reason=MASTER_SYSTEM_ADMIN)

  overrides = active_overrides(tenant_id, user_id)

  if exists overrides where action=deny and (permission_key is null OR permission_key == requested):
     return DENY(reason=POLICY_DENY)

  if exists overrides where action=allow and (permission_key is null OR permission_key == requested):
     return ALLOW(reason=POLICY_ALLOW)

  bindings = RoleBinding where tenant_id, user_id and role.service == permission.service

  effective_roles = []
  for b in bindings:
     if b.scope_type == GLOBAL: include
     if b.scope_type == TENANT and b.scope_id == tenant_id: include
     if b.scope_type == scope_type and b.scope_id == scope_id: include

  effective_permissions = union(RolePermission for effective_roles)

  if requested in effective_permissions:
     return ALLOW(reason=RBAC_ALLOW)
  else:
     return DENY(reason=RBAC_DENY)
```

## API

Routes are mounted under the main Ninja API as `/api/v1/...`:

- `POST /api/v1/check`
- `GET /api/v1/roles?service=...`
- `POST /api/v1/roles` (admin)
- `POST /api/v1/role-bindings` (admin)
- `DELETE /api/v1/role-bindings/{id}` (admin)
- `GET /api/v1/permissions?service=...`

### Tenant admin surface

Tenant admins interact with `/api/v1/access/admin/...` routes. These routes reuse the existing RBAC data but drive a buffered UI that never demands system-admin credentials.

| Route | Purpose | Required permission |
| --- | --- | --- |
| `GET /roles` | List tenant-owned roles (plus system templates) with optional `service`/name filters | `portal.roles.read` |
| `POST /roles` | Create a tenant role and attach a permission set | `portal.roles.write` |
| `PATCH /roles/{role_id}` | Rename, re-scope, or change permissions for a tenant role | `portal.roles.write` |
| `DELETE /roles/{role_id}` | Delete an unused tenant role | `portal.roles.write` |
| `GET /role-bindings/search` | Search bindings by role name ("Moderator", "System Moderator", etc.) and optional scope filters | `portal.roles.read` |
| `POST /role-bindings` | Grant a role to a user in a particular scope | `portal.role_bindings.write` |
| `DELETE /role-bindings/{binding_id}` | Revoke a role assignment | `portal.role_bindings.write` |
| `GET /events` | Read the latest tenant-admin audit events | `portal.roles.read` |

Search matches substrings of the role name so common titles such as “System Moderator,” “Topic Moderator,” and “Moderator” can be discovered with a single query. The `/events` route is backed by the `TenantAdminAuditEvent` model, which tracks `tenant_id`, `performed_by`, `action`, `target_type`, `target_id`, `metadata`, and `created_at` whenever a tenant admin creates/updates/deletes roles or bindings.
The tenant admin surface uses the `portal.roles.read`, `portal.roles.write`, and `portal.role_bindings.write` permissions instead of requiring `master_flags.system_admin`.

### Internal headers

Access-control endpoints are designed for BFF→service calls:

- `X-Request-Id` (required)
- `X-Tenant-Id`, `X-Tenant-Slug` (required)
- `X-User-Id` (required)
- `X-Master-Flags` (optional JSON)
- `X-Updspace-Timestamp`, `X-Updspace-Signature` (required for internal signature)

Admin endpoints require `master_flags.system_admin == true`.
