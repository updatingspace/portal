import { Button } from '@gravity-ui/uikit';
import type { ReactNode } from 'react';
import { env } from '../../shared/config/env';
import { useRouteBase } from '../../shared/hooks/useRouteBase';
import { PageState, useUITranslation } from '../../shared/ui/portal/PortalUI';
export function FeatureGate({children}: {children: ReactNode}) {
  const base = useRouteBase();
  const t = useUITranslation();
  return env.votingUiV2 ? children : <PageState kind="unavailable" title={t('Раздел сейчас недоступен', 'This feature is unavailable')} description={t('Голосования временно выключены для этого портала.', 'Polls are currently disabled on this portal.')} action={<Button href={base}>{t('В обзор', 'Overview')}</Button>} />;
}
