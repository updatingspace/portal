---
sidebar_position: 4
title: Testing
description: Руководство по тестированию
---

# Testing Guide

Руководство по написанию и запуску тестов.

## Backend Testing

### Stack

- **pytest** — test framework
- **pytest-django** — Django integration
- **pytest-asyncio** — async support
- **factory_boy** — fixtures
- **httpx** — API testing

### Структура тестов

```
services/id/src/accounts/
├── tests/
│   ├── __init__.py
│   ├── conftest.py        # Fixtures
│   ├── test_models.py     # Unit tests
│   ├── test_api.py        # API tests
│   ├── test_services.py   # Service layer tests
│   └── factories.py       # Factory definitions
```

### Fixtures (conftest.py)

```python
import pytest
from django.test import Client
from accounts.models import User, Tenant

@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="test@example.com",
        password="password123"
    )

@pytest.fixture
def tenant(db):
    return Tenant.objects.create(
        slug="test",
        name="Test Tenant"
    )

@pytest.fixture
def authenticated_client(client, user):
    client.force_login(user)
    return client

@pytest.fixture
def api_client():
    from ninja.testing import TestClient
    from app.api import api
    return TestClient(api)
```

### Factory Boy

```python
# factories.py
import factory
from accounts.models import User, Tenant

class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
    
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    is_active = True

class TenantFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Tenant
    
    slug = factory.Sequence(lambda n: f"tenant-{n}")
    name = factory.Faker("company")
```

### Model Tests

```python
# test_models.py
import pytest
from accounts.models import User

@pytest.mark.django_db
class TestUser:
    def test_create_user(self):
        user = User.objects.create_user(
            email="test@example.com",
            password="password123"
        )
        assert user.email == "test@example.com"
        assert user.check_password("password123")
    
    def test_email_normalized(self):
        user = User.objects.create_user(
            email="Test@EXAMPLE.com",
            password="password123"
        )
        assert user.email == "test@example.com"
```

### API Tests

```python
# test_api.py
import pytest
from ninja.testing import TestClient
from app.api import api

@pytest.fixture
def client():
    return TestClient(api)

@pytest.mark.django_db
class TestAuthAPI:
    def test_login_success(self, client, user):
        response = client.post("/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        assert "session" in response.cookies
    
    def test_login_invalid_password(self, client, user):
        response = client.post("/auth/login", json={
            "email": "test@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
    
    def test_me_authenticated(self, client, user):
        client.cookies["session"] = create_session(user)
        response = client.get("/auth/me")
        assert response.status_code == 200
        assert response.json()["email"] == user.email
```

### Service Tests

```python
# test_services.py
import pytest
from unittest.mock import Mock, patch
from accounts.services import AuthService

@pytest.mark.django_db
class TestAuthService:
    def test_authenticate_user(self, user):
        service = AuthService()
        result = service.authenticate("test@example.com", "password123")
        assert result == user
    
    def test_authenticate_invalid(self):
        service = AuthService()
        result = service.authenticate("test@example.com", "wrong")
        assert result is None
    
    @patch("accounts.services.send_email")
    def test_send_magic_link(self, mock_send, user):
        service = AuthService()
        service.send_magic_link("test@example.com")
        mock_send.assert_called_once()
```

### Запуск тестов

```bash
# Все тесты
pytest

# Конкретный файл
pytest src/accounts/tests/test_api.py

# Конкретный тест
pytest src/accounts/tests/test_api.py::TestAuthAPI::test_login_success

# С coverage
pytest --cov=. --cov-report=html

# Verbose
pytest -v

# Показать print statements
pytest -s
```

---

## Frontend Testing

### Stack

- **Vitest** — test framework
- **React Testing Library** — component testing
- **MSW** — API mocking
- **Playwright** — E2E testing

### Unit Tests

```typescript
// features/voting/components/PollCard.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PollCard } from "./PollCard";

describe("PollCard", () => {
  it("renders poll title", () => {
    const poll = {
      id: "1",
      title: "Best Game 2025",
      status: "active",
    };
    
    render(<PollCard poll={poll} />);
    
    expect(screen.getByText("Best Game 2025")).toBeInTheDocument();
  });
  
  it("shows active badge for active polls", () => {
    const poll = {
      id: "1",
      title: "Best Game 2025",
      status: "active",
    };
    
    render(<PollCard poll={poll} />);
    
    expect(screen.getByText("active")).toHaveClass("badge-success");
  });
});
```

### Hook Tests

```typescript
// features/voting/hooks/usePoll.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { usePoll } from "./usePoll";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe("usePoll", () => {
  it("fetches poll by id", async () => {
    const { result } = renderHook(() => usePoll("123"), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    
    expect(result.current.data.id).toBe("123");
  });
});
```

### API Mocking with MSW

```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/bff/voting/polls", () => {
    return HttpResponse.json([
      { id: "1", title: "Poll 1", status: "active" },
      { id: "2", title: "Poll 2", status: "closed" },
    ]);
  }),
  
  http.post("/api/bff/voting/votes", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      vote_id: "new-vote-id",
      created_at: new Date().toISOString(),
    });
  }),
];
```

```typescript
// test/setup.ts
import { setupServer } from "msw/node";
import { handlers } from "./mocks/handlers";

export const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### E2E Tests (Playwright)

```typescript
// e2e/voting.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Voting", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/voting");
  });
  
  test("displays list of polls", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Голосования" })).toBeVisible();
    await expect(page.getByTestId("poll-card")).toHaveCount(2);
  });
  
  test("can vote in a poll", async ({ page }) => {
    await page.click('[data-testid="poll-card"]:first-child');
    await page.click('[data-testid="option-1"]');
    await page.click('button:has-text("Проголосовать")');
    
    await expect(page.getByText("Голос принят!")).toBeVisible();
  });
});
```

### Запуск тестов

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

---

## Integration Tests

### API Integration

```python
# tests/integration/test_voting_flow.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_complete_voting_flow():
    async with AsyncClient(base_url="http://localhost:8080") as client:
        # 1. Login
        login_response = await client.post("/api/bff/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        
        # 2. Get polls
        polls_response = await client.get("/api/bff/voting/polls")
        assert polls_response.status_code == 200
        polls = polls_response.json()
        
        # 3. Vote
        vote_response = await client.post("/api/bff/voting/votes", json={
            "poll_id": polls[0]["id"],
            "nomination_id": polls[0]["nominations"][0]["id"],
            "option_id": polls[0]["nominations"][0]["options"][0]["id"],
        })
        assert vote_response.status_code == 201
```

---

## Test Coverage

### Backend

```bash
pytest --cov=. --cov-report=html --cov-fail-under=70
```

### Frontend

```bash
npm run test:coverage
```

Отчёты генерируются в `htmlcov/` и `coverage/`.

---

## CI/CD Tests

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      
      - name: Install dependencies
        run: |
          pip install -e "services/id[dev]"
      
      - name: Run tests
        run: pytest services/id --cov --cov-fail-under=70

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      
      - name: Install dependencies
        run: npm ci
        working-directory: web/portal-frontend
      
      - name: Run tests
        run: npm run test:coverage
        working-directory: web/portal-frontend
```
