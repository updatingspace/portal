import React, { useMemo } from 'react';
import { useMatches } from 'react-router-dom';

import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';

type RouteTitleResolver = (params: Record<string, string | undefined>) => string | null | undefined;

type RouteTitleHandle = {
  title?: string | RouteTitleResolver;
};

type RouteMatch = {
  handle?: RouteTitleHandle;
  params: Record<string, string | undefined>;
};

const resolveRouteTitle = (matches: RouteMatch[]): string | null => {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const title = match?.handle?.title;

    if (typeof title === 'function') {
      const resolved = title(match.params);
      if (typeof resolved === 'string' && resolved.trim()) {
        return resolved.trim();
      }
      continue;
    }

    if (typeof title === 'string' && title.trim()) {
      return title.trim();
    }
  }

  return null;
};

export const RouteDocumentTitle: React.FC = () => {
  const matches = useMatches() as RouteMatch[];

  const pageTitle = useMemo(() => resolveRouteTitle(matches), [matches]);

  useDocumentTitle(pageTitle);

  return null;
};
