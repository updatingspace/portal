import { Button } from '@gravity-ui/uikit';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUITranslation } from '../../shared/ui/portal/PortalUI';

export function LandingPage() {
  const { user } = useAuth();
  const t = useUITranslation();
  const features = [
    ['01', t('События', 'Events'), t('Собирайте команду. Планируйте встречи и сообщайте, кто будет.', 'Bring your team together. Plan meetups and let others know you are coming.')],
    ['02', t('Голосования', 'Polls'), t('Решайте вместе. Обсуждайте идеи и выбирайте следующий шаг.', 'Decide together. Share ideas and choose your next move.')],
    ['03', t('Жизнь сообщества', 'Community life'), t('Делитесь важным. Новости, публикации и общая история в одном месте.', 'Share what matters. News, posts and your shared story in one place.')],
    ['04', t('Достижения', 'Achievements'), t('Отмечайте вклад участников и сохраняйте памятные моменты.', 'Recognize contributions and celebrate memorable moments.')],
  ];
  return <div className="portal-landing">
    <section className="portal-cover portal-landing__hero">
      <div><span className="portal-eyebrow">UpdSpace Portal</span>
        <h1>{t('Ваше сообщество. Следующий уровень.', 'Your community. Next level.')}</h1>
        <p>{t('Место, где игроки встречаются, строят планы и создают общую историю.', 'A place for players to meet, make plans and build a shared story.')}</p>
        <div className="portal-actions"><Button view="action" size="xl" href={user ? '/choose-tenant' : '/login'}>{user ? t('Мои сообщества', 'My communities') : t('Войти', 'Sign in')}</Button><Button view="outlined-contrast" size="xl" href="#access">{t('Как получить доступ', 'How to join')}</Button></div>
        <p><small>{t('Доступ к сообществам предоставляется по приглашению.', 'Access to communities is by invitation.')}</small></p>
      </div>
      <div className="portal-landing__art" aria-hidden="true"><div>↗ {t('Будьте в игре', 'Stay in the game')}</div><div>◇ {t('Решайте вместе', 'Decide together')}</div><div>✦ {t('Создавайте историю', 'Build your story')}</div></div>
    </section>
    <section className="portal-grid" aria-label={t('Возможности', 'Features')}>{features.map(([number, title, description]) => <article className="portal-card" key={number}><p className="portal-eyebrow">{number}</p><h2>{title}</h2><p>{description}</p></article>)}</section>
    <section className="portal-card" id="access" style={{marginTop: 32}}><h2>{t('Начните со своего сообщества', 'Start with your community')}</h2><div className="portal-grid"><div><h3>{t('Есть приглашение?', 'Have an invitation?')}</h3><p>{t('Откройте ссылку, которую прислал администратор. Она подскажет, как активировать аккаунт и присоединиться.', 'Open the link from your administrator for instructions on activating your account and joining.')}</p></div><div><h3>{t('Уже есть аккаунт?', 'Already have an account?')}</h3><p>{t('Войдите, чтобы открыть свои сообщества или подать заявку на создание нового.', 'Sign in to open your communities or apply to create one.')}</p><Link to={user ? '/choose-tenant' : '/login'}>{t('Продолжить →', 'Continue →')}</Link></div></div></section>
  </div>;
}
