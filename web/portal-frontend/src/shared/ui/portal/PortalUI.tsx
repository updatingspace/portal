import { useCallback, useContext, useId, type ReactNode } from 'react';
import { Button, Dialog, Loader } from '@gravity-ui/uikit';
import { I18nContext } from '../../../app/providers/i18nContext';

// Shared primitives also work at bootstrap, before the locale provider is ready.
// eslint-disable-next-line react-refresh/only-export-components
export function useUITranslation() {
  const locale = useContext(I18nContext)?.locale ?? 'ru';
  return useCallback(
    (ru: string, en: string) => (locale === 'en' ? en : ru),
    [locale],
  );
}

export function PageLayout({
  title,
  description,
  actions,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`portal-page${wide ? ' portal-page--wide' : ''}`}>
      <header className="portal-page__heading">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="portal-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function PageState({
  kind,
  title,
  description,
  action,
  secondaryAction,
  children,
}: {
  kind:
    | 'loading'
    | 'error'
    | 'empty'
    | 'forbidden'
    | 'unavailable'
    | 'not-found';
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className={`portal-state portal-state--${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-busy={kind === 'loading'}
    >
      <div className="portal-state__symbol" aria-hidden="true">
        {kind === 'loading' ? (
          <Loader />
        ) : kind === 'error' ? (
          '!'
        ) : kind === 'forbidden' ? (
          '↗'
        ) : (
          '◇'
        )}
      </div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
      <div className="portal-actions">
        {action}
        {secondaryAction}
      </div>
    </section>
  );
}

export function InlineError({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}) {
  const t = useUITranslation();
  return (
    <div className="portal-inline-error" role="alert">
      <div>{children}</div>
      {onRetry && (
        <Button size="l" onClick={onRetry}>
          {t('Повторить', 'Try again')}
        </Button>
      )}
    </div>
  );
}

export function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid': boolean;
  }) => ReactNode;
}) {
  const id = `field-${useId().replaceAll(':', '')}`;
  return (
    <div className="portal-field">
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        'aria-describedby': hint || error ? `${id}-description` : undefined,
        'aria-invalid': Boolean(error),
      })}
      {(hint || error) && (
        <div
          id={`${id}-description`}
          className={error ? 'portal-field__error' : 'portal-field__hint'}
        >
          {error || hint}
        </div>
      )}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onClose,
  destructive = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  destructive?: boolean;
}) {
  const t = useUITranslation();
  if (!open) return null;
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      aria-label={title}
      disableOutsideClick={pending}
      disableEscapeKeyDown={pending}
    >
      <Dialog.Header caption={title} />
      <Dialog.Body>
        <p>{description}</p>
        {error && <InlineError>{error}</InlineError>}
      </Dialog.Body>
      <Dialog.Footer>
        <div className="portal-actions">
          <Button onClick={onClose} disabled={pending}>
            {t('Отмена', 'Cancel')}
          </Button>
          <Button
            view={destructive ? 'outlined-danger' : 'action'}
            loading={pending}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </Dialog.Footer>
    </Dialog>
  );
}
