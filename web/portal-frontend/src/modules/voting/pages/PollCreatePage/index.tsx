import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Label, Text } from '@gravity-ui/uikit';

import { PollForm } from '../../../../features/voting/components/PollForm';
import { useCreatePoll, usePollTemplates } from '../../../../features/voting';
import { toaster } from '../../../../toaster';
import { notifyApiError } from '../../../../utils/apiErrorHandling';
import { useRouteBase } from '@/shared/hooks/useRouteBase';
import { logger } from '../../../../utils/logger';
import type {
  PollCreatePayload,
  PollTemplate,
  PollUpdatePayload,
  ResultsVisibility,
} from '../../../../features/voting/types';
import { VotingLoadingState, VotingPageLayout } from '../../ui';

const creationSteps = [
  {
    title: '1. Выбор старта',
    detail: 'Шаблон или пустой опрос.',
  },
  {
    title: '2. Настройка правил',
    detail: 'Видимость, расписание, правила публикации результатов.',
  },
  {
    title: '3. Подготовка вопросов',
    detail: 'После создания перейдите к настройке вопросов и участников.',
  },
];

const featureHighlights = [
  {
    title: 'Шаблоны под игровые события',
    description: 'Готовые сценарии для наград, турниров и быстрых опросов.',
  },
  {
    title: 'Контроль результатов',
    description: 'Настройте, когда участники смогут увидеть итоги.',
  },
  {
    title: 'Роли внутри опроса',
    description: 'Назначайте модераторов и наблюдателей прямо в интерфейсе.',
  },
];

export const PollCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const routeBase = useRouteBase();
  const location = useLocation();
  const { data: templates = [], isLoading: templatesLoading } = usePollTemplates();
  const createPollMutation = useCreatePoll();
  const [selectedTemplate, setSelectedTemplate] = useState<PollTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);

  const templateCount = templates.length;
  const featuredTemplates = useMemo(() => templates.slice(0, 3), [templates]);

  useEffect(() => {
    const templateSlug = (location.state as { template?: string } | null | undefined)?.template;
    if (!templateSlug || templates.length === 0) return;

    const template = templates.find((item) => item.slug === templateSlug) ?? null;
    if (!template) return;

    // Sync route-selected template into local wizard state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTemplate(template);
    setShowForm(true);
  }, [location.state, templates]);

  useEffect(() => {
    logger.info('Voting v2 page loaded', {
      area: 'voting',
      event: 'voting_v2.page_loaded',
      data: {
        page: 'create',
        templates: templates.length,
      },
    });
  }, [templates.length]);

  const templateDefaults = useMemo(() => {
    if (!selectedTemplate) return null;
    const rawAllowRevoting = (selectedTemplate.settings as { allow_revoting?: unknown }).allow_revoting;
    const rawResultsVisibility = (selectedTemplate.settings as { results_visibility?: unknown }).results_visibility;

    const allow_revoting = typeof rawAllowRevoting === 'boolean' ? rawAllowRevoting : undefined;
    const results_visibility: ResultsVisibility | undefined =
      rawResultsVisibility === 'always' || rawResultsVisibility === 'after_closed' || rawResultsVisibility === 'admins_only'
        ? rawResultsVisibility
        : undefined;

    return {
      allow_revoting,
      results_visibility,
    };
  }, [selectedTemplate]);

  const handleCreatePoll = (data: PollCreatePayload | PollUpdatePayload) => {
    if (!('title' in data) || typeof data.title !== 'string') {
      toaster.add({
        name: 'poll-create-error',
        title: 'Некорректные данные',
        theme: 'danger',
      });
      return;
    }

    createPollMutation.mutate(data as PollCreatePayload, {
      onSuccess: (poll) => {
        logger.info('Voting v2 poll created', {
          area: 'voting',
          event: 'voting_v2.poll_created',
          data: {
            pollId: poll.id,
            template: selectedTemplate?.slug ?? null,
          },
        });
        toaster.add({
          name: 'poll-created',
          title: 'Опрос создан',
          theme: 'success',
        });
        navigate(`${routeBase}/voting/${poll.id}/manage`, { state: { tab: 'questions' } });
      },
      onError: (error) => {
        notifyApiError(error, 'Не удалось создать опрос');
      },
    });
  };

  const handleTemplateSelect = (template: PollTemplate) => {
    setSelectedTemplate(template);
    setShowForm(true);
  };

  const handleBlankPoll = () => {
    setSelectedTemplate(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedTemplate(null);
  };

  if (templatesLoading) {
    return <VotingLoadingState text="Загружаем шаблоны опросов…" />;
  }

  if (showForm) {
    return (
      <VotingPageLayout
        title={selectedTemplate ? `Создание по шаблону «${selectedTemplate.title}»` : 'Новый опрос'}
        description="Настройте параметры и создайте опрос. Вопросы можно будет добавить сразу после сохранения."
        actions={
          <Button view="outlined" onClick={handleCancel}>
            Назад к выбору старта
          </Button>
        }
      >
        <div className="voting-v2__split">
          <Card className="voting-v2__card">
            <PollForm
              initialData={
                selectedTemplate
                  ? {
                      visibility: selectedTemplate.visibility,
                      allow_revoting: templateDefaults?.allow_revoting,
                      results_visibility: templateDefaults?.results_visibility,
                      template: selectedTemplate.slug,
                    }
                  : { visibility: 'public' }
              }
              templates={[]}
              onSubmit={handleCreatePoll}
              onCancel={handleCancel}
              isSubmitting={createPollMutation.isPending}
              submitLabel="Создать опрос"
            />
          </Card>

          <div className="voting-v2__grid">
            <Card className="voting-v2__card voting-v2__card--soft">
              <Text variant="subheader-2" className="voting-v2__section-title">Шаблон</Text>
              <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
                {selectedTemplate
                  ? selectedTemplate.description
                  : 'Шаблон не выбран. Можно выбрать позже.'}
              </Text>
              {selectedTemplate ? (
                <div className="voting-v2__meta-grid" style={{ marginTop: 10 }}>
                  <div>
                    <strong>Видимость:</strong> {selectedTemplate.visibility}
                  </div>
                  <div>
                    <strong>Вопросов:</strong> {selectedTemplate.questions?.length ?? 0}
                  </div>
                  <div>
                    <strong>ID:</strong> {selectedTemplate.slug}
                  </div>
                </div>
              ) : null}
            </Card>

            <Card className="voting-v2__card">
              <Text variant="subheader-2" className="voting-v2__section-title">Что дальше</Text>
              <ul className="voting-v2__list voting-v2__small voting-v2__muted">
                <li>Добавьте вопросы и варианты ответа</li>
                <li>Пригласите участников для приватных опросов</li>
                <li>Опубликуйте опрос, когда всё готово</li>
              </ul>
            </Card>
          </div>
        </div>
      </VotingPageLayout>
    );
  }

  return (
    <VotingPageLayout
      title="Создание опроса"
      description="Запустите голосование за несколько минут — выберите шаблон или начните с нуля."
    >
      <Card className="voting-v2__card voting-v2__card--soft">
        <Text variant="subheader-2" className="voting-v2__section-title">Как это работает</Text>
        <div className="voting-v2__grid" style={{ marginTop: 12 }}>
          {creationSteps.map((step) => (
            <div key={step.title} className="voting-v2__stats-item">
              <div className="voting-v2__stats-value">{step.title}</div>
              <div className="voting-v2__stats-label">{step.detail}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="voting-v2__grid voting-v2__grid--2">
        <Card className="voting-v2__card">
          <Text variant="subheader-2" className="voting-v2__section-title">Пустой опрос</Text>
          <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
            Полный контроль над настройками, видимостью и вопросами.
          </Text>
          <div className="voting-form__actions">
            <Button view="action" onClick={handleBlankPoll}>
              Начать с нуля
            </Button>
          </div>
        </Card>

        <Card className="voting-v2__card">
          <Text variant="subheader-2" className="voting-v2__section-title">Шаблоны</Text>
          <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
            {templateCount ? `${templateCount} готовых сценария` : 'Шаблоны пока не настроены.'}
          </Text>
          <div className="voting-form__actions">
            <Button view="outlined" onClick={() => templates[0] && handleTemplateSelect(templates[0])} disabled={!templateCount}>
              Выбрать шаблон
            </Button>
          </div>
        </Card>
      </div>

      <div className="voting-v2__grid voting-v2__grid--3">
        {featureHighlights.map((highlight) => (
          <Card key={highlight.title} className="voting-v2__card">
            <Text variant="subheader-2" className="voting-v2__section-title">{highlight.title}</Text>
            <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
              {highlight.description}
            </Text>
          </Card>
        ))}
      </div>

      {featuredTemplates.length > 0 ? (
        <>
          <div className="voting-v2__toolbar">
            <Text variant="subheader-2" className="voting-v2__section-title">Популярные шаблоны</Text>
            <Text variant="caption-2" color="secondary">Всего {templateCount}</Text>
          </div>
          <div className="voting-v2__grid voting-v2__grid--3">
            {featuredTemplates.map((template) => (
              <Card
                key={template.slug}
                className="voting-v2__card"
              >
                <Text variant="subheader-2" className="voting-v2__section-title">{template.title}</Text>
                <Text variant="body-2" color="secondary" className="voting-v2__section-subtitle">
                  {template.description}
                </Text>
                <div className="voting-v2__pills" style={{ marginTop: 8 }}>
                  <Label size="xs" theme="info">{template.visibility}</Label>
                  <Label size="xs" theme="utility">{template.questions?.length ?? 0} вопросов</Label>
                </div>
                <div className="voting-form__actions">
                  <Button view="normal" onClick={() => handleTemplateSelect(template)}>
                    Использовать шаблон
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </VotingPageLayout>
  );
};
