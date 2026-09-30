import {Button} from '@gravity-ui/uikit';
import {PageLayout,PageState,useUITranslation} from '../shared/ui/portal/PortalUI';

/** Router render errors must never expose a stack trace or an invitation URL. */
export function RouteErrorState() {
  const t=useUITranslation();
  return <PageLayout title={t('Не удалось открыть страницу','Unable to open this page')}>
    <PageState kind="error" title={t('Произошла ошибка отображения','Something went wrong displaying the page')} description={t('Повторите загрузку. Если ошибка сохраняется, вернитесь к списку сообществ.','Reload the page. If the problem continues, return to your communities.')} action={<Button view="action" onClick={()=>window.location.reload()}>{t('Перезагрузить','Reload')}</Button>} secondaryAction={<Button href="/choose-tenant">{t('Мои сообщества','My communities')}</Button>}/>
  </PageLayout>;
}
