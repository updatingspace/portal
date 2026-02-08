import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Label, Text } from '@gravity-ui/uikit';

import { usePollTemplates } from '../../../../features/voting';
import { VISIBILITY_META } from '../../../../features/voting/utils/pollMeta';
import { useRouteBase } from '@/shared/hooks/useRouteBase';
import { logger } from '../../../../utils/logger';
import {
  VotingEmptyState,
  VotingErrorState,
  VotingLoadingState,
  VotingPageLayout,
} from '../../ui';

export const PollTemplatesPage: React.FC = () => {
  const routeBase = useRouteBase();
  const { data: templates = [], isLoading, isError, error, refetch } = usePollTemplates();

  useEffect(() => {
    logger.info('Voting v2 page loaded', {
      area: 'voting',
      event: 'voting_v2.page_loaded',
      data: {
        page: 'templates',
        templates: templates.length,
      },
    });
  }, [templates.length]);

  if (isLoading) {
    return <VotingLoadingState text="Загружаем шаблоны…" />;
  }

  if (isError) {
    return (
      <VotingErrorState
        title="Не удалось загрузить шаблоны"
        message={error instanceof Error ? error.message : 'Проверьте соединение и попробуйте снова.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <VotingPageLayout
      title="Шаблоны опросов"
      description="Быстрый старт для регулярных голосований."
      actions={
        <Link to={`${routeBase}/voting/create`}>
          <Button view="action">Создать опрос</Button>
        </Link>
      }
    >
      {templates.length === 0 ? (
        <VotingEmptyState
          title="Шаблонов пока нет"
          message="Создайте первый опрос вручную или дождитесь добавления шаблонов."
          action={
            <Link to={`${routeBase}/voting/create`}>
              <Button view="action">Создать опрос</Button>
            </Link>
          }
        />
      ) : (
        <div className="voting-v2__grid voting-v2__grid--3">
          {templates.map((template) => {
            const visibilityMeta = VISIBILITY_META[template.visibility];
            return (
              <Card key={template.slug} className="voting-v2__card">
                <div className="voting-v2__grid">
                  <div className="voting-v2__pills">
                    <Label theme={visibilityMeta.theme} size="xs">
                      {visibilityMeta.label}
                    </Label>
                    <Label theme="utility" size="xs">
                      {template.questions?.length ?? 0} вопросов
                    </Label>
                  </div>

                  <Text variant="subheader-2" className="voting-v2__section-title">{template.title}</Text>
                  <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
                    {template.description}
                  </Text>

                  <Link to={`${routeBase}/voting/create`} state={{ template: template.slug }}>
                    <Button view="action">Использовать шаблон</Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </VotingPageLayout>
  );
};
