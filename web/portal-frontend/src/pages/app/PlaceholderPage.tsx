import { Button } from '@gravity-ui/uikit';
import { useRouteBase } from '../../shared/hooks/useRouteBase';
import { PageState, useUITranslation } from '../../shared/ui/portal/PortalUI';
export function PlaceholderPage({title, description}: {title: string; description?: string}) {
  const t = useUITranslation();
  const base = useRouteBase();
  return <PageState kind="unavailable" title={t('Функция пока недоступна', 'This feature is not available yet')} description={description ?? `${title}. ${t('Мы добавим этот раздел после подключения всех необходимых возможностей.', 'This section will become available once its supporting features are ready.')}`} action={<Button href={base}>{t('В обзор', 'Overview')}</Button>} />;
}
