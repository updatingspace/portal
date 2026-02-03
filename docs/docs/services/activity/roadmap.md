---
sidebar_position: 4
title: Roadmap
description: Планы развития Activity сервиса
---

# Activity Service Roadmap

## Реализовано (v1.0)

### Core Feed (✅ Production)

- [x] Activity Feed с фильтрацией по типам и датам
- [x] Feed V2 с курсорной пагинацией
- [x] Unread count с кешированием
- [x] Tenant isolation
- [x] Webhook deduplication

### RBAC Integration (✅ Production)

- [x] Интеграция с Access сервисом
- [x] Permission checks на всех endpoints
- [x] HMAC authentication для internal calls

### Outbox Pattern (✅ Production)

- [x] Модель Outbox с retry logic
- [x] Background processor (`process_outbox` command)
- [x] Event types: feed.updated, account.linked, sync.completed

### Steam Connector (✅ MVP)

- [x] Реальный Steam Web API клиент
- [x] Player summary, owned games
- [x] Recent games, achievements
- [x] Error handling с retry

### Minecraft Connector (✅ MVP)

- [x] Webhook ingest
- [x] HMAC signature verification
- [x] Event normalization

### Infrastructure (✅ Production)

- [x] Health checks (liveness/readiness/metrics)
- [x] JSON structured logging
- [x] Long-poll real-time endpoint
- [x] i18n support (EN/RU)
- [x] Redis-ready caching layer

---

## Planned (v1.1 - Q2 2026)

### Discord Connector

- [ ] OAuth2 flow для привязки аккаунта
- [ ] Presence sync (игровая активность)
- [ ] Server events через webhook

```python
class DiscordConnector:
    def describe(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(
            can_sync=True,
            can_webhook=True,
            requires_auth=True,
            rate_limits={"requests_per_minute": 50}
        )
    
    async def sync(self, account_link: AccountLink) -> List[dict]:
        # Get presence, activities
        ...
```

### Feed Improvements

- [ ] Feed aggregation (group similar events)
- [ ] @mentions notifications
- [ ] Rich previews для links
- [ ] Feed search (full-text)

### Performance

- [ ] Redis caching для hot paths
- [ ] Database read replicas
- [ ] Connection pooling optimization
- [ ] Batch processing для sync jobs

### Monitoring

- [ ] Prometheus metrics export
- [ ] Grafana dashboards
- [ ] Alerting rules
- [ ] SLI/SLO tracking

---

## Planned (v1.2 - Q3 2026)

### Advanced Connectors

- [ ] Twitch connector (streams, clips)
- [ ] YouTube Gaming connector
- [ ] TruckersMP connector
- [ ] Generic webhook connector

### Feed Personalization

- [ ] ML-based feed ranking
- [ ] User preferences learning
- [ ] A/B testing framework

### Scale & Reliability

- [ ] Event sourcing migration
- [ ] Multi-region support
- [ ] Disaster recovery

---

## Technical Debt

### High Priority

| Item | Description | Effort |
|------|-------------|--------|
| RawEvent cleanup | Remove unused RawEvent model | S |
| API versioning | Deprecate v1 feed endpoint | M |
| Test coverage | Increase to 80%+ | M |

### Medium Priority

| Item | Description | Effort |
|------|-------------|--------|
| OpenAPI spec | Auto-generate from schemas | S |
| Rate limiting | Per-user rate limits | M |
| Compression | Response compression | S |

### Low Priority

| Item | Description | Effort |
|------|-------------|--------|
| GraphQL API | Alternative to REST | L |
| WebSocket | Alternative to long-poll | M |
| gRPC | Internal service communication | L |

---

## Migration Notes

### From v1.0 to v1.1

1. **Feed V2 endpoint** становится основным
2. Legacy `/feed` endpoint deprecated
3. New environment variables:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `REDIS_URL`

### Database Migrations

```bash
# v1.1 migrations
python manage.py migrate activity 0004_discord_support
python manage.py migrate activity 0005_feed_aggregation
```

---

## Contributing

### Adding a New Connector

1. Создать файл в `activity/connectors/{name}.py`
2. Implement `Connector` protocol
3. Register в `CONNECTORS` dict
4. Add tests в `tests/test_connectors.py`
5. Update documentation

### Testing Requirements

- Unit tests для всей бизнес-логики
- Integration tests для API endpoints
- Mock external APIs в тестах
- Minimum 70% coverage для new code

---

## Changelog

### v1.0.0 (2026-01-15)

**Added:**
- Feed V2 with cursor pagination
- RBAC integration
- Outbox pattern for reliable events
- Steam connector (full implementation)
- Long-poll real-time endpoint
- Health checks
- JSON structured logging
- i18n support (EN/RU)

**Changed:**
- ActivityEvent model optimizations
- Improved error handling

**Fixed:**
- Tenant isolation in all queries
- Webhook deduplication
