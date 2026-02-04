---
sidebar_position: 2
title: Модели Gamification
description: Основные модели сервиса ачивок
---

# Модели

## AchievementCategory

```python
class AchievementCategory(models.Model):
    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_index=True)
    slug = models.SlugField(max_length=64)
    name_i18n = models.JSONField(default=dict)
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
```

## Achievement

```python
class Achievement(models.Model):
    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_index=True)
    name_i18n = models.JSONField(default=dict)
    description = models.TextField()
    category = models.ForeignKey(AchievementCategory, on_delete=models.PROTECT)
    status = models.CharField(max_length=16)  # draft/published/hidden/active
    images = models.JSONField(default=dict)
    created_by = models.UUIDField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
```

## AchievementGrant

```python
class AchievementGrant(models.Model):
    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_index=True)
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)
    recipient_id = models.UUIDField(db_index=True)
    issuer_id = models.UUIDField(db_index=True)
    reason = models.TextField()
    visibility = models.CharField(max_length=16)  # public/private
    created_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True)
    revoked_by = models.UUIDField(null=True)
```

## OutboxMessage

```python
class OutboxMessage(models.Model):
    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_index=True)
    event_type = models.CharField(max_length=128)
    payload = models.JSONField(default=dict)
    occurred_at = models.DateTimeField()
    published_at = models.DateTimeField(null=True)
```
