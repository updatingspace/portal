---
title: Records of Processing Activities
description: GDPR Article 30 style record of processing for UpdSpace Portal
---

# Records of Processing Activities

Ниже приведён рабочий RoPA для UpdSpace Portal.

## Controller details

- Controller: **Mihhail Matvejev**
- Country: **Estonia**
- Contact: **privacy@updspace.com**
- Postal address: **[УКАЗАТЬ СЛУЖЕБНЫЙ ПОЧТОВЫЙ АДРЕС ПЕРЕД ПУБЛИКАЦИЕЙ]**

## Processing activities

| Activity | Data subjects | Data categories | Purpose | Legal basis | Recipients / processors | Transfer note | Retention |
|---|---|---|---|---|---|---|---|
| Account approval and onboarding | applicants, users | email, username, status, membership/admin decisions | grant access to service | contract / steps at request | ID layer, infra providers | see transfer policy | while account lifecycle requires |
| Authentication and sessions | users | session IDs, IP, device/browser metadata, passkey/MFA state, security logs | secure login and session continuity | contract + legitimate interests | BFF, hosting providers | may involve RF-hosted infra | active session + security retention |
| Profiles and community participation | users, admins | profile fields, memberships, roles, posts, comments, reactions | operate communities and teams | contract + legitimate interests | tenant admins within scope | tenant-scoped disclosure | until deletion or anonymization |
| Events | users | event content, RSVP, attendance | organize community events | contract + legitimate interests | tenant admins, attendees as designed by feature | tenant-scoped disclosure | event lifecycle + DSAR rules |
| Voting | users | polls, nominations, votes, invites | community voting features | contract + legitimate interests | tenant admins and authorized viewers | tenant-scoped disclosure | poll lifecycle + DSAR rules |
| Gamification | users | achievement data, grants, issuer/recipient refs | recognition and community features | contract + legitimate interests | tenant admins and authorized viewers | tenant-scoped disclosure | feature lifecycle + DSAR rules |
| External account linking | users choosing to link accounts | external account refs, connector settings, derived activity | optional integrations | consent | linked service APIs, hosting providers | separate transfer assessment needed where applicable | until unlink / deletion |
| Security monitoring and audit | users, admins | audit logs, request IDs, IP/device/security events | prevent abuse, investigate incidents, maintain accountability | legitimate interests + legal obligation | hosting/security providers, authorities if required | case-by-case | per retention schedule |
| Rights requests and compliance | users, applicants, complainants | request correspondence, identity-verification evidence, decision logs | comply with privacy rights and legal duties | legal obligation | authorities, counsel if needed | case-by-case | compliance retention |

## Technical and organizational measures

- tenant-scoped access control;
- centralized RBAC and master flags;
- signed service-to-service calls;
- cookie-based auth without browser token storage;
- audit logging and retention policies;
- encryption/redaction for selected sensitive activity fields;
- DSAR export/erase orchestration;
- incident response procedure.

## Review cadence

Этот документ должен обновляться:

- при запуске нового процессинга;
- при подключении нового провайдера;
- при запуске новой юрисдикции/региона;
- не реже одного раза в год.
