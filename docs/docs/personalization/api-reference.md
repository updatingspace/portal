# Personalization API Reference

## Base

- Prefix: `/api/v1/personalization`
- Auth: via BFF signed headers (`X-User-Id`, `X-Tenant-Id`)

## Preferences

- `GET /preferences` — read current user preferences.
- `PUT /preferences` — partial update.
- `GET /preferences/defaults` — default preference model.
- `POST /preferences/reset` — reset to defaults.
- `appearance.theme_source` supports `portal | id`.
- `localization.timezone` remains portal-local in v1 and drives shared formatting on the frontend.

## Homepage Modals

- `GET /homepage-modals?language=en|ru` — active modals for current user.
- `GET /admin/homepage-modals` — list with filters.
- `GET /admin/homepage-modals/{id}` — details.
- `POST /admin/homepage-modals` — create.
- `PUT /admin/homepage-modals/{id}` — update (increments version).
- `DELETE /admin/homepage-modals/{id}?hard=false` — soft/hard delete.
- `POST /admin/homepage-modals/{id}/restore` — restore.
- `POST /admin/homepage-modals/bulk` — activate/deactivate/delete/restore.
- `GET /admin/homepage-modals/{id}/preview?language=en|ru` — preview with localization.

## Content Widgets

- `GET /admin/content-widgets`
- `POST /admin/content-widgets`
- `PUT /admin/content-widgets/{id}`
- `DELETE /admin/content-widgets/{id}?hard=false`

## Analytics

- `POST /analytics/track`
  - body: `{ modal_id, event_type: view|click|dismiss, session_id, metadata }`
- `GET /admin/analytics/modals?days=30`
- `GET /admin/analytics/report?days=30`

## Dashboards

- `GET /admin/dashboards/layouts?include_deleted=false`
- `POST /admin/dashboards/layouts`
- `PUT /admin/dashboards/layouts/{layoutId}`
- `DELETE /admin/dashboards/layouts/{layoutId}?hard=false`
- `GET /admin/dashboards/layouts/{layoutId}/widgets?include_deleted=false`
- `POST /admin/dashboards/layouts/{layoutId}/widgets`
- `PUT /admin/dashboards/widgets/{widgetId}`
- `DELETE /admin/dashboards/widgets/{widgetId}?hard=false`

Notes:

- `layout_config` is a versioned JSON document with breakpoint metadata.
- creating a widget for an already known `widget_key` restores the soft-deleted row instead of inserting a duplicate.

RBAC keys:

- `personalization.content.manage`
- `personalization.dashboards.customize`
