import { useContext, type MutableRefObject } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import { ConfirmDialog, useUITranslation } from './PortalUI';
export function DraftNavigationGuard({dirty, allowed}: {dirty: boolean; allowed: MutableRefObject<boolean>}) {
  const router = useContext(UNSAFE_DataRouterContext);
  return router ? <RouterDraftGuard dirty={dirty} allowed={allowed} /> : null;
}
function RouterDraftGuard({dirty, allowed}: {dirty: boolean; allowed: MutableRefObject<boolean>}) {
  const blocker = useBlocker(() => dirty && !allowed.current);
  const t = useUITranslation();
  return <ConfirmDialog open={blocker.state === 'blocked'} title={t('Есть несохранённые изменения', 'Unsaved changes')} description={t('Черновик останется в этой вкладке для вашего аккаунта и сообщества. Уйти со страницы?', 'Your draft will remain in this tab for your account and community. Leave this page?')} confirmLabel={t('Уйти', 'Leave')} onConfirm={() => blocker.state === 'blocked' && blocker.proceed()} onClose={() => blocker.state === 'blocked' && blocker.reset()} />;
}
