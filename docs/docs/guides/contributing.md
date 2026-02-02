---
sidebar_position: 5
title: Contributing
description: Как вносить изменения в проект
---

# Contributing Guide

Руководство по внесению изменений в проект UpdSpace.

## Git Workflow

### Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready код |
| `develop` | Integration branch |
| `feature/*` | Новые фичи |
| `fix/*` | Исправления багов |
| `refactor/*` | Рефакторинг |

### Naming

```bash
feature/voting-multiple-options
fix/bff-session-timeout
refactor/access-caching
```

### Commit Messages

Используем [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat` — новая функциональность
- `fix` — исправление бага
- `docs` — документация
- `style` — форматирование
- `refactor` — рефакторинг
- `test` — тесты
- `chore` — настройка, зависимости

Examples:
```bash
feat(voting): add multiple votes per nomination
fix(bff): handle session expiration gracefully
docs(api): add authentication examples
test(access): add permission check tests
```

---

## Pull Request Process

### 1. Создание PR

```bash
# Создать ветку
git checkout -b feature/my-feature

# Внести изменения
git add .
git commit -m "feat(service): description"

# Push
git push origin feature/my-feature
```

### 2. PR Template

```markdown
## Description
Brief description of changes.

## Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have added tests
- [ ] I have updated documentation
- [ ] All tests pass
```

### 3. Code Review

- Minimum 1 approval required
- CI must pass
- No merge conflicts

### 4. Merge

- Squash and merge preferred
- Delete branch after merge

---

## Code Style

### Python

```bash
# Форматирование
ruff format services/

# Линтер
ruff check services/

# Type checking
mypy services/id/src
```

`.ruff.toml`:
```toml
line-length = 88
target-version = "py312"

[lint]
select = ["E", "F", "I", "N", "W", "UP"]
```

### TypeScript

```bash
# Линтер
npm run lint

# Форматирование
npm run format
```

ESLint config в `eslint.config.js`.

---

## Testing Requirements

### Backend

```python
# Минимальное покрытие: 70%

# Запуск тестов
pytest

# С coverage
pytest --cov=app --cov-report=html
```

Test structure:
```
services/id/src/accounts/tests/
├── __init__.py
├── test_models.py
├── test_api.py
├── test_services.py
└── conftest.py  # fixtures
```

### Frontend

```typescript
// Unit tests
npm run test

// E2E tests
npm run test:e2e

// Coverage
npm run test:coverage
```

---

## Adding a New Service

### 1. Создать структуру

```bash
mkdir -p services/myservice/src/myservice
```

### 2. Создать pyproject.toml

```toml
[project]
name = "myservice"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "django>=5.0",
    "django-ninja>=1.0",
    "psycopg[binary]>=3.1",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-django>=4.5",
    "ruff>=0.5",
]
```

### 3. Создать Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install -e .

COPY src/ src/

CMD ["python", "src/manage.py", "runserver", "0.0.0.0:800X"]
```

### 4. Добавить в docker-compose.dev.yml

```yaml
myservice:
  build:
    context: ../../services/myservice
  ports:
    - "800X:800X"
  environment:
    - DATABASE_URL=postgres://postgres:postgres@postgres:5432/myservice
  volumes:
    - ../../services/myservice/src:/app/src
  depends_on:
    - postgres
```

### 5. Настроить BFF routing

```python
# services/bff/src/bff/routing.py

SERVICE_ROUTES = {
    # ...
    "myservice": "http://myservice:800X",
}
```

### 6. Добавить permissions в Access

```python
# services/access/src/access_control/permissions_mvp.py

PERMISSIONS.extend([
    Permission("myservice.resource.read", "Read myservice resources"),
    Permission("myservice.resource.create", "Create myservice resources"),
])
```

---

## Database Migrations

### Правила

1. **Одна миграция — одно изменение**
2. **Backwards compatible** — не ломать существующие данные
3. **Data migrations отдельно** — не смешивать схему и данные

### Пример data migration

```python
# 0002_populate_default_roles.py

from django.db import migrations

def create_default_roles(apps, schema_editor):
    Role = apps.get_model("access_control", "Role")
    Role.objects.create(name="member", description="Basic member")

def reverse(apps, schema_editor):
    Role = apps.get_model("access_control", "Role")
    Role.objects.filter(name="member").delete()

class Migration(migrations.Migration):
    dependencies = [
        ("access_control", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_default_roles, reverse),
    ]
```

---

## Documentation

### Когда обновлять

- Новая фича → обновить docs
- Изменение API → обновить API reference
- Новый сервис → добавить в architecture

### Формат

- Markdown файлы в `documentation/docs/`
- Mermaid для диаграмм
- Примеры кода с подсветкой

---

## Release Process

### Versioning

Используем [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH`
- Breaking change → major
- New feature → minor
- Bug fix → patch

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Version bumped
- [ ] Tagged in git
- [ ] Deployed to staging
- [ ] Smoke tests passed
- [ ] Deployed to production
