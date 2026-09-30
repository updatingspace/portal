import type { ReactNode } from 'react';
import { Button } from '@gravity-ui/uikit';
import { Link, useNavigate } from 'react-router-dom';
import { useRouteBase } from '../../../../../shared/hooks/useRouteBase';
import {
  PageLayout,
  PageState,
  InlineError,
  useUITranslation,
} from '../../../../../shared/ui/portal/PortalUI';
import { MediaFallback } from '../../../../../shared/ui/portal/MediaFallback';
import '../../profile-hub.css';

type ListPageLayoutProps = {
  title: string;
  isLoading?: boolean;
  isError?: boolean;
  emptyText: string;
  items: {
    id: string;
    title: string;
    subtitle?: string;
    meta?: string;
    href?: string;
    image?: string | null;
  }[];
  onRetry?: () => void;
  leadSlot?: ReactNode;
  footer?: ReactNode;
};
export function ListPageLayout({
  title,
  isLoading,
  isError,
  emptyText,
  items,
  onRetry,
  leadSlot,
  footer,
}: ListPageLayoutProps) {
  const base = useRouteBase();
  const navigate = useNavigate();
  const t = useUITranslation();
  return (
    <PageLayout
      title={title}
      actions={
        <Button
          size="xl"
          view="flat"
          onClick={() => navigate(`${base}/profile`)}
        >
          {t('К профилю', 'Back to profile')}
        </Button>
      }
    >
      {leadSlot}
      {isError && (
        <InlineError onRetry={onRetry}>
          {t('Не удалось загрузить список.', 'Unable to load this list.')}
        </InlineError>
      )}
      {isLoading && !items.length ? (
        <PageState
          kind="loading"
          title={t('Загружаем список', 'Loading list')}
        />
      ) : !isError && !items.length ? (
        <PageState kind="empty" title={emptyText} />
      ) : (
        <div className="profile-entity-list">
          {items.map((item) => (
            <article key={item.id} className="profile-entity-list__item">
              <MediaFallback src={item.image} alt={item.title} />
              <div>
                <h2>
                  {item.href ? (
                    <Link to={item.href}>
                      {item.title}
                      <span aria-hidden="true"> →</span>
                    </Link>
                  ) : (
                    item.title
                  )}
                </h2>
                {item.subtitle && <p>{item.subtitle}</p>}
                {item.meta && <span>{item.meta}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
      {footer}
    </PageLayout>
  );
}
