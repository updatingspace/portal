import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Loader, Text } from '@gravity-ui/uikit';
import { PollForm } from '../../../../features/voting/components/PollForm';
import { useCreatePoll, usePollTemplates } from '../../../../features/voting';
import { toaster } from '../../../../toaster';
import { notifyApiError } from '../../../../utils/apiErrorHandling';
import type { PollCreatePayload, PollTemplate, PollUpdatePayload, ResultsVisibility } from '../../../../features/voting/types';

const creationSteps = [
  {
    title: 'Выберите старт',
    detail: 'Возьмите шаблон или начните с пустого опроса.',
  },
  {
    title: 'Настройте параметры',
    detail: 'Определите видимость, расписание и правила результатов.',
  },
  {
    title: 'Добавьте вопросы',
    detail: 'Создайте вопросы и варианты ответов перед публикацией.',
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

    setSelectedTemplate(template);
    setShowForm(true);
  }, [location.state, templates]);

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
        toaster.add({
          name: 'poll-created',
          title: 'Опрос создан',
          theme: 'success',
        });
        navigate(`/app/voting/${poll.id}/manage`, { state: { tab: 'questions' } });
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
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center">
        <Loader size="l" />
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50">
        <div className="bg-white border-b border-slate-200">
          <div className="container max-w-6xl mx-auto px-4 py-6">
            <Text variant="header-1" className="text-slate-900">
              {selectedTemplate ? `Создание по шаблону «${selectedTemplate.title}»` : 'Новый опрос'}
            </Text>
            <Text variant="body-2" color="secondary" className="mt-1">
              Настройте параметры и создайте опрос. Вопросы можно будет добавить сразу после сохранения.
            </Text>
          </div>
        </div>

        <div className="container max-w-6xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[1.6fr,1fr]">
          <Card className="p-6">
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

          <div className="space-y-4">
            <Card className="p-5 border border-dashed border-slate-200">
              <Text variant="subheader-2">Шаблон</Text>
              <Text variant="body-2" color="secondary" className="mt-2">
                {selectedTemplate
                  ? selectedTemplate.description
                  : 'Шаблон не выбран. Можно выбрать позже в списке.'}
              </Text>
              {selectedTemplate && (
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li>
                    <span className="font-semibold text-slate-800">Видимость:</span> {selectedTemplate.visibility}
                  </li>
                  <li>
                    <span className="font-semibold text-slate-800">Вопросов:</span> {selectedTemplate.questions?.length ?? 0}
                  </li>
                  <li>
                    <span className="font-semibold text-slate-800">ID шаблона:</span> {selectedTemplate.slug}
                  </li>
                </ul>
              )}
            </Card>

            <Card className="p-5 bg-slate-50">
              <Text variant="subheader-2">Что дальше</Text>
              <Text variant="body-2" color="secondary" className="mt-2">
                После создания перейдите к настройке вопросов и участников.
              </Text>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 list-disc list-inside">
                <li>Добавьте вопросы и варианты ответа</li>
                <li>Пригласите участников для приватных опросов</li>
                <li>Опубликуйте опрос, когда всё готово</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <Text variant="header-1" className="text-slate-900">
            Создание опроса
          </Text>
          <Text variant="body-2" color="secondary" className="mt-1">
            Запустите голосование за несколько минут — выберите шаблон или начните с нуля.
          </Text>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-5">
          <Text variant="subheader-2">Как это работает</Text>
          <ol className="mt-3 space-y-3 list-decimal list-inside text-sm text-slate-600">
            {creationSteps.map((step) => (
              <li key={step.title}>
                <span className="font-semibold text-slate-800">{step.title}:</span> {step.detail}
              </li>
            ))}
          </ol>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 border border-dashed border-slate-200">
            <div className="flex flex-col h-full justify-between gap-4">
              <div>
                <Text variant="subheader-2">Пустой опрос</Text>
                <Text variant="body-2" color="secondary" className="mt-1">
                  Полный контроль над настройками, видимостью и вопросами.
                </Text>
              </div>
              <Button view="action" onClick={handleBlankPoll} width="max">
                Начать с нуля
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col h-full justify-between gap-4">
              <div>
                <Text variant="subheader-2">Шаблоны</Text>
                <Text variant="body-2" color="secondary" className="mt-1">
                  {templateCount ? `${templateCount} готовых сценария` : 'Шаблоны пока не настроены.'}
                </Text>
              </div>
              <Button view="outlined" onClick={() => templates[0] && handleTemplateSelect(templates[0])} width="max" disabled={!templateCount}>
                Выбрать шаблон
              </Button>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {featureHighlights.map((highlight) => (
            <Card key={highlight.title} className="p-5">
              <Text variant="subheader-2">{highlight.title}</Text>
              <Text variant="body-2" color="secondary" className="mt-2">
                {highlight.description}
              </Text>
            </Card>
          ))}
        </div>

        {featuredTemplates.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Text variant="subheader-2">Популярные шаблоны</Text>
              <Text variant="caption-2" color="secondary">Всего {templateCount}</Text>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {featuredTemplates.map((template) => (
                <Card
                  key={template.slug}
                  className="p-5 hover:shadow-md transition cursor-pointer"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <Text variant="subheader-2">{template.title}</Text>
                  <Text variant="body-2" color="secondary" className="mt-1">
                    {template.description}
                  </Text>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 px-3 py-1">{template.visibility}</span>
                    <span className="rounded-full border border-slate-200 px-3 py-1">{template.questions?.length ?? 0} вопросов</span>
                  </div>
                  <Button view="normal" width="max" className="mt-4">
                    Использовать шаблон
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
