---
sidebar_position: 1
title: Обзор Frontend
description: Архитектура и стек фронтенда
---

# Frontend Overview

Платформа имеет два фронтенд-приложения:

| App | Path | Description |
|-----|------|-------------|
| Portal Frontend | `web/portal-frontend` | Основное приложение (голосования, события, активность) |
| ID Frontend | `web/id-frontend` | Identity Provider UI (login, signup, MFA) |

## Стек

- **React 19+** — UI библиотека
- **Vite 7** — сборщик
- **TypeScript** — типизация
- **Gravity UI** — дизайн-система (Yandex)
- **Bootstrap 5** — сетка и утилиты
- **React Router v7** — роутинг

## Архитектура

```
src/
├── app/                  # App setup
│   ├── providers.tsx     # Провайдеры (QueryClient, etc.)
│   └── routes.tsx        # Маршруты
│
├── api/                  # API клиенты
│   └── client.ts         # Fetch wrapper
│
├── contexts/             # React Contexts
│   ├── TenantContext.ts
│   └── UserContext.ts
│
├── features/             # Feature modules
│   ├── voting/
│   ├── events/
│   └── feed/
│
├── components/           # Shared components
│   ├── ui/
│   └── layout/
│
├── hooks/                # Custom hooks
│   ├── useApi.ts
│   └── useTenant.ts
│
├── pages/                # Page components
│   ├── Home.tsx
│   ├── VotingPage.tsx
│   └── EventsPage.tsx
│
├── types/                # TypeScript types
│   └── api.ts
│
└── utils/                # Utilities
    └── date.ts
```

## Feature Module Structure

```
features/voting/
├── api/                  # API calls
│   └── votingApi.ts
├── components/           # Feature components
│   ├── PollCard.tsx
│   ├── NominationList.tsx
│   └── VoteButton.tsx
├── hooks/                # Feature hooks
│   └── usePoll.ts
├── types/                # Feature types
│   └── poll.ts
└── index.ts              # Public exports
```

## API Client

```typescript
// api/client.ts

const BASE_URL = "/api/bff";

export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include", // HttpOnly cookies
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(error);
  }

  return response.json();
}

// Usage
const polls = await apiClient<Poll[]>("/voting/polls");
```

## Routing

```typescript
// app/routes.tsx

export const routes = [
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "voting", element: <VotingPage /> },
      { path: "voting/:pollId", element: <PollDetailPage /> },
      { path: "events", element: <EventsPage /> },
      { path: "events/:eventId", element: <EventDetailPage /> },
      { path: "feed", element: <FeedPage /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
];
```

## Auth Flow

```typescript
// contexts/UserContext.tsx

interface User {
  id: string;
  email: string;
  name: string;
}

interface UserContextValue {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check session on mount
    apiClient<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = () => {
    // Redirect to BFF login
    window.location.href = "/api/bff/auth/login";
  };

  const logout = async () => {
    await apiClient("/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}
```

## Tenant Context

```typescript
// contexts/TenantContext.tsx

interface Tenant {
  id: string;
  slug: string;
  name: string;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    // Tenant определяется по subdomain
    const slug = window.location.hostname.split(".")[0];
    
    apiClient<Tenant>(`/tenants/${slug}`)
      .then(setTenant)
      .catch(console.error);
  }, []);

  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}
```

## Testing

```typescript
// Vitest + React Testing Library

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PollCard } from "./PollCard";

describe("PollCard", () => {
  it("renders poll title", () => {
    const poll = { id: "1", title: "Best Game 2025", status: "active" };
    
    render(<PollCard poll={poll} />);
    
    expect(screen.getByText("Best Game 2025")).toBeInTheDocument();
  });
});
```

## Environment Variables

```env
# .env.local
VITE_API_BASE_URL=/api/bff
VITE_SENTRY_DSN=https://...
```

```typescript
// Access in code
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```
