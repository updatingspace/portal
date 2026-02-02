---
sidebar_position: 2
title: Roadmap
description: План развития платформы
---

# Roadmap

План развития платформы UpdSpace.

## Q1 2026 (Текущий)

### 🎯 Focus: MVP Stabilization

- [ ] **Access Control** — Доработка scope hierarchy
- [ ] **Voting** — Поддержка multiple votes в nomination
- [ ] **Events** — Recurring events (iCal-like)
- [ ] **Activity** — Реальная интеграция Steam API
- [ ] **Portal** — Завершение Communities UI

### Infrastructure

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] E2E тесты (Playwright)
- [ ] API documentation (OpenAPI)

---

## Q2 2026

### 🎯 Focus: Production Ready

- [ ] **Kubernetes** — Production deployment
- [ ] **Monitoring** — Prometheus + Grafana
- [ ] **Logging** — Centralized logging (ELK/Loki)
- [ ] **Security audit** — Penetration testing

### Features

- [ ] **Discord connector** — Activity integration
- [ ] **PKCE** — OAuth security improvement
- [ ] **PWA** — Portal offline support
- [ ] **Push notifications** — Browser push

---

## Q3 2026

### 🎯 Focus: Scale & Features

- [ ] **Horizontal scaling** — Multi-instance services
- [ ] **CDN** — Static assets
- [ ] **Database optimization** — Read replicas

### Features

- [ ] **Tournaments** — Competitive events
- [ ] **Leaderboards** — Gamification
- [ ] **Achievements** — Platform badges
- [ ] **Mobile app** — React Native

---

## Q4 2026

### 🎯 Focus: Ecosystem

- [ ] **Public API** — Third-party integrations
- [ ] **Webhooks** — Outgoing webhooks
- [ ] **Marketplace** — Community plugins
- [ ] **Analytics** — Usage dashboards

---

## Backlog

### High Priority

| Feature | Service | Notes |
|---------|---------|-------|
| PKCE for OAuth | UpdSpaceID | Security |
| Rate limiting | BFF | DDoS protection |
| Audit logs | All | Compliance |
| E2E tests | - | Quality |

### Medium Priority

| Feature | Service | Notes |
|---------|---------|-------|
| Backup MFA methods | UpdSpaceID | UX |
| File uploads | Portal | Media |
| Comments | Portal | Engagement |
| Notifications | Activity | Engagement |

### Low Priority

| Feature | Service | Notes |
|---------|---------|-------|
| Dark/Light theme sync | Frontend | UX |
| Export data | Portal | GDPR |
| Multi-language | All | i18n |
| Mobile push | - | Engagement |

---

## Completed (v0.1)

### ✅ Core Infrastructure

- [x] Multi-tenant architecture
- [x] BFF pattern implementation
- [x] RBAC system
- [x] Session management

### ✅ UpdSpaceID

- [x] Email/password auth
- [x] Magic Link auth
- [x] MFA (TOTP)
- [x] Passkeys (WebAuthn)
- [x] OAuth/OIDC provider
- [x] Application management
- [x] Tenant management

### ✅ Portal

- [x] Communities MVP
- [x] Teams MVP
- [x] Posts MVP
- [x] Profiles

### ✅ Voting

- [x] Polls CRUD
- [x] Voting mechanism
- [x] Results display
- [x] Legacy migration

### ✅ Events

- [x] Events CRUD
- [x] RSVP system
- [x] Calendar view

### ✅ Activity

- [x] Feed display
- [x] Games catalog
- [x] Minecraft connector

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| v0.1-alpha | Jan 2026 | Initial MVP, core services |
| v0.2 | Q1 2026 | Stabilization, full Activity |
| v1.0 | Q2 2026 | Production release |
