import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Label, Loader, Text } from '@gravity-ui/uikit';
import { usePollTemplates } from '../../../../features/voting';
import { VISIBILITY_META } from '../../../../features/voting/utils/pollMeta';

export const PollTemplatesPage: React.FC = () => {
  const { data: templates = [], isLoading, isError, error, refetch } = usePollTemplates();

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center">
        <Loader size="l" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <Text variant="subheader-2" className="mb-2">Не удалось загрузить шаблоны</Text>
          <Text variant="body-2" color="secondary" className="mb-4">
            {error instanceof Error ? error.message : 'Проверьте соединение и попробуйте снова.'}
          </Text>
          <Button onClick={() => refetch()} view="action" width="max">
            Повторить
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="container max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Text variant="header-1" className="text-slate-900">Шаблоны опросов</Text>
            <Text variant="body-2" color="secondary" className="mt-1">
              Быстрый старт для регулярных голосований.
            </Text>
          </div>
          <Link to="/app/voting/create">
            <Button view="action">Создать опрос</Button>
          </Link>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-6">
        {templates.length === 0 ? (
          <Card className="p-8 text-center">
            <Text variant="subheader-2" className="mb-2">Шаблонов пока нет</Text>
            <Text variant="body-2" color="secondary" className="mb-4">
              Создайте первый опрос вручную или дождитесь добавления шаблонов.
            </Text>
            <Link to="/app/voting/create">
              <Button view="action">Создать опрос</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => {
              const visibilityMeta = VISIBILITY_META[template.visibility];
              return (
                <Card key={template.slug} className="p-5 flex flex-col gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Label theme={visibilityMeta.theme} size="xs">
                        {visibilityMeta.label}
                      </Label>
                      <Label theme="utility" size="xs">
                        {template.questions?.length ?? 0} вопросов
                      </Label>
                    </div>
                    <Text variant="subheader-2">{template.title}</Text>
                    <Text variant="body-2" color="secondary">
                      {template.description}
                    </Text>
                  </div>
                  <div className="mt-auto">
                    <Link to="/app/voting/create" state={{ template: template.slug }}>
                      <Button view="action" width="max">
                        Использовать шаблон
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
