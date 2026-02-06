import { Button, Loader } from '@gravity-ui/uikit';
import { createClientAccessDeniedError } from '../../../api/accessDenied';
import { AccessDeniedScreen } from '../../../features/access-denied';

import { redirectToLogin } from '../auth';

export type StatusKind = 'loading' | 'empty' | 'error' | 'no-access' | 'unauthorized';

type Props = {
  kind: StatusKind;
  title?: string;
  description?: string;
  retry?: { label?: string; onClick: () => void };
  showLogin?: boolean;
};

export function StatusView({
  kind,
  title,
  description,
  retry,
  showLogin = false,
}: Props) {
  if (kind === 'no-access') {
    return (
      <AccessDeniedScreen
        error={createClientAccessDeniedError({ reason: description })}
      />
    );
  }

  const resolvedTitle =
    title ??
    (kind === 'loading'
      ? 'Загрузка'
      : kind === 'empty'
        ? 'Пока пусто'
        : kind === 'unauthorized'
          ? 'Требуется вход'
          : 'Ошибка');

  const resolvedDescription =
    description ??
    (kind === 'loading'
      ? 'Подождите…'
      : kind === 'unauthorized'
        ? 'Авторизуйтесь через UpdSpaceID, чтобы продолжить.'
        : kind === 'empty'
            ? 'Данных пока нет.'
            : 'Не удалось загрузить данные.');

  return (
    <div className="container py-4">
      <div className="row">
        <div className="col-12 col-lg-10 mx-auto">
          <div className="status-block status-block-info">
            {kind === 'loading' ? <Loader size="l" /> : null}
            <div className="status-title mt-2">{resolvedTitle}</div>
            <p className="text-muted mb-3">{resolvedDescription}</p>
            <div className="d-flex gap-2 flex-wrap">
              {retry ? (
                <Button view="outlined" onClick={retry.onClick}>
                  {retry.label ?? 'Попробовать ещё раз'}
                </Button>
              ) : null}
              {showLogin ? (
                <Button view="action" onClick={() => redirectToLogin()}>
                  Войти
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
