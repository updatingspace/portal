import { useEffect, useMemo, type ReactNode } from 'react';
import { hashKey, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';

/** Old requests can only settle in their old client. No placeholder crosses a scope. */
export function PrivateQueryScope({children}: {children: ReactNode}) {
  const {user} = useAuth();
  const scope = `${user?.id ?? 'guest'}:${user?.tenant?.id ?? 'account'}:${user?.isSuperuser ?? false}:${[...(user?.capabilities ?? [])].sort().join(',')}`;
  const client = useMemo(() => new QueryClient({defaultOptions: {
    queries: {queryKeyHashFn: (key) => hashKey([scope, ...key]), staleTime: 30_000, retry: (count, error) => count < 1 && ![401, 403, 404, 409].includes((error as {status?: number}).status ?? 0)},
    mutations: {retry: false},
  }}), [scope]);
  useEffect(() => () => {void client.cancelQueries(); client.clear();}, [client]);
  return <QueryClientProvider key={scope} client={client}>{children}</QueryClientProvider>;
}
