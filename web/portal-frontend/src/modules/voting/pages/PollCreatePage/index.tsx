import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@gravity-ui/uikit';
import { PollForm } from '../../../../features/voting/components/PollForm';
import { useCreatePoll, usePollTemplates } from '../../../../features/voting';
import type {
  PollCreatePayload,
  PollTemplate,
  PollUpdatePayload,
  ResultsVisibility,
} from '../../../../features/voting/types';
import { useRouteBase } from '../../../../shared/hooks/useRouteBase';
import { ContentDialog } from '../../../../shared/ui/portal/ContentDialog';
import {
  PageLayout,
  PageState,
  InlineError,
} from '../../../../shared/ui/portal/PortalUI';
import { useConfirmation } from '../../../../shared/ui/portal/useConfirmation';
import '../../styles/voting-workspace.css';

export function PollCreatePage() {
  const navigate = useNavigate();
  const base = useRouteBase();
  const location = useLocation();
  const {
    data: templates = [],
    isLoading,
    isError,
    refetch,
  } = usePollTemplates();
  const mutation = useCreatePoll();
  const { confirm, confirmationDialog } = useConfirmation();
  const [selection, setSelection] = useState<PollTemplate | null | undefined>();
  const [formRevision, setFormRevision] = useState(0);
  const [picker, setPicker] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = (location.state as { template?: string } | null)?.template;
  const selected =
    selection === undefined
      ? (templates.find((item) => item.slug === requested) ?? null)
      : selection;
  const defaults = useMemo(() => {
    const result = selected?.settings.results_visibility;
    return {
      visibility: selected?.visibility ?? ('public' as const),
      template: selected?.slug,
      allow_revoting: selected?.settings.allow_revoting === true,
      results_visibility: (['always', 'after_closed', 'admins_only'].includes(
        String(result),
      )
        ? result
        : 'after_closed') as ResultsVisibility,
    };
  }, [selected]);
  const choose = async (template: PollTemplate | null) => {
    if (
      dirty &&
      !(await confirm(
        'Заменить введённые параметры настройками шаблона? Текущий ввод будет потерян.',
      ))
    )
      return;
    setSelection(template);
    setFormRevision((revision) => revision + 1);
    setDirty(false);
    setPicker(false);
    setError(null);
  };
  const cancel = async () => {
    if (
      dirty &&
      !(await confirm(
        'Выйти без создания опроса? Введённые параметры не сохранятся.',
      ))
    )
      return;
    navigate(`${base}/voting`);
  };
  const submit = (data: PollCreatePayload | PollUpdatePayload) => {
    if (!data.title || mutation.isPending) return;
    setError(null);
    mutation.mutate(data as PollCreatePayload, {
      onSuccess: (poll) =>
        navigate(`${base}/voting/${poll.id}/manage?tab=questions`, {
          state: { tab: 'questions' },
        }),
      onError: () =>
        setError(
          'Не удалось подтвердить создание опроса. Введённые параметры сохранены; проверьте список перед повторной отправкой.',
        ),
    });
  };
  if (requested && selection === undefined && isLoading)
    return <PageState kind="loading" title="Загружаем выбранный шаблон" />;
  return (
    <div className="voting-workspace voting-workspace--form">
      <PageLayout
        title="Новый опрос"
        actions={
          <Button
            size="xl"
            view="flat"
            disabled={mutation.isPending}
            onClick={() => setPicker(true)}
          >
            Выбрать шаблон
          </Button>
        }
      >
        {selected && (
          <p className="voting-form-context">Шаблон: {selected.title}</p>
        )}
        {error && <InlineError>{error}</InlineError>}
        <PollForm
          key={`${selected?.slug ?? 'blank'}-${formRevision}`}
          initialData={defaults}
          onDirtyChange={setDirty}
          onSubmit={submit}
          onCancel={() => void cancel()}
          isSubmitting={mutation.isPending}
        />
        {picker && (
          <ContentDialog title="Шаблон опроса" onClose={() => setPicker(false)}>
            {isLoading && <p role="status">Загружаем шаблоны опросов…</p>}
            {isError && (
              <InlineError onRetry={() => void refetch()}>
                Не удалось загрузить шаблоны. Можно начать с пустого опроса.
              </InlineError>
            )}
            <div className="portal-stack">
              <Button
                size="xl"
                view="outlined"
                onClick={() => void choose(null)}
              >
                Пустой опрос
              </Button>
              {templates.map((template) => (
                <article className="voting-template" key={template.slug}>
                  <h2>{template.title}</h2>
                  <p>{template.description}</p>
                  <Button size="xl" onClick={() => void choose(template)}>
                    Использовать «{template.title}»
                  </Button>
                </article>
              ))}
            </div>
          </ContentDialog>
        )}
        {confirmationDialog}
      </PageLayout>
    </div>
  );
}
