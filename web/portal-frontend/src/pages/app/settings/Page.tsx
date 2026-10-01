import { Avatar, Icon } from '@gravity-ui/uikit';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Palette,
  Globe,
  Shield,
  Sliders,
} from '@gravity-ui/icons';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { useUITranslation } from '../../../shared/ui/portal/PortalUI';
import { UserSettingsPanel } from '../../../features/personalization';
import { ProfileSection } from './ui/ProfileSection';
import { MembershipSection } from './ui/MembershipSection';
import './settings.css';

export function SettingsPage() {
  const { user } = useAuth();
  const mobile = useMediaQuery('(max-width: 719px)');
  const [params] = useSearchParams();
  const t = useUITranslation();
  const sections = [
    { id: 'appearance', title: t('Внешний вид', 'Appearance'), icon: Palette },
    {
      id: 'localization',
      title: t('Язык и время', 'Language and time'),
      icon: Globe,
    },
    {
      id: 'accessibility',
      title: t('Доступность', 'Accessibility'),
      icon: Sliders,
    },
    {
      id: 'notifications',
      title: t('Уведомления', 'Notifications'),
      icon: Bell,
    },
    { id: 'privacy', title: t('Приватность', 'Privacy'), icon: Shield },
    {
      id: 'account',
      title: t('Аккаунт и безопасность', 'Account and security'),
      icon: Shield,
    },
  ] as const;
  const selected = sections.find((section) => section.id === params.get('tab'));
  const active = selected || (!mobile ? sections[0] : undefined);
  if (!user) return null;
  const sectionHref = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    return `?${next}`;
  };
  const backParams = new URLSearchParams(params);
  backParams.delete('tab');
  const name = user.displayName || user.username;
  const preferenceSection =
    active && active.id !== 'account' ? active.id : undefined;
  return (
    <div
      className={`portal-settings${active ? ' portal-settings--detail' : ''}`}
    >
      <header className="portal-settings__heading">
        {mobile && active && (
          <Link
            className="portal-settings__back"
            to={{ search: backParams.toString() }}
            aria-label={t('Все настройки', 'All settings')}
          >
            <Icon data={ArrowLeft} size={20} />
            <span>{t('Настройки', 'Settings')}</span>
          </Link>
        )}
        <h1>{mobile && active ? active.title : t('Настройки', 'Settings')}</h1>
      </header>
      <div className="portal-settings__layout">
        {(!mobile || !active) && (
          <nav
            className="portal-settings__navigation"
            aria-label={t('Разделы настроек', 'Settings sections')}
          >
            <Link
              className="portal-settings__account-row"
              to={sectionHref('account')}
            >
              <Avatar
                size="l"
                text={name}
                imgUrl={user.avatarUrl ?? undefined}
              />
              <strong>{name}</strong>
              <Icon data={ChevronRight} />
            </Link>
            <div className="portal-settings__rows">
              {sections.map((section) => (
                <Link
                  key={section.id}
                  to={sectionHref(section.id)}
                  aria-current={active?.id === section.id ? 'page' : undefined}
                  className="portal-settings__row"
                >
                  <Icon data={section.icon} size={20} />
                  <span>{section.title}</span>
                  <Icon data={ChevronRight} size={16} />
                </Link>
              ))}
            </div>
            <MembershipSection />
          </nav>
        )}
        <div className="portal-settings__detail" hidden={!active}>
          {!mobile && active && (
            <h2 className="portal-settings__detail-title">{active.title}</h2>
          )}
          {active?.id === 'account' && (
            <ProfileSection
              user={user}
              idPortalUrl={user.idFrontendBaseUrl ?? undefined}
              hideTitle
            />
          )}
          <div hidden={!preferenceSection}>
            <UserSettingsPanel section={preferenceSection || 'appearance'} />
          </div>
        </div>
      </div>
    </div>
  );
}
