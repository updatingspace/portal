import { Avatar, Button, Icon } from '@gravity-ui/uikit';
import { ArrowUpRightFromSquare } from '@gravity-ui/icons';
import type { UserInfo } from '../../../../contexts/AuthContext';
import { useUITranslation } from '../../../../shared/ui/portal/PortalUI';

export function ProfileSection({
  user,
  idPortalUrl,
  hideTitle = false,
}: {
  user: UserInfo;
  idPortalUrl?: string;
  hideTitle?: boolean;
}) {
  const t = useUITranslation();
  const name = user.displayName || user.username || t('Аккаунт', 'Account');
  const accountUrl =
    idPortalUrl && /^https?:\/\//.test(idPortalUrl)
      ? `${idPortalUrl.replace(/\/$/, '')}/profile`
      : undefined;
  return (
    <section
      className="portal-settings__section"
      aria-label={t('Аккаунт и безопасность', 'Account and security')}
    >
      {!hideTitle && (
        <h2 id="settings-account">
          {t('Аккаунт и безопасность', 'Account and security')}
        </h2>
      )}
      <div className="portal-settings__identity">
        <Avatar
          size="m"
          text={name}
          imgUrl={user.avatarUrl ?? undefined}
          aria-hidden="true"
        />
        <div>
          <strong>{name}</strong>
          {user.email && <p>{user.email}</p>}
        </div>
      </div>
      <p>
        {t(
          'Профиль, пароль и способы входа управляются в UpdSpaceID.',
          'Your profile, password and sign-in methods are managed in UpdSpaceID.',
        )}
      </p>
      {accountUrl ? (
        <Button
          size="l"
          view="outlined"
          href={accountUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Открыть UpdSpaceID', 'Open UpdSpaceID')}
          <Icon data={ArrowUpRightFromSquare} size={14} />
        </Button>
      ) : (
        <p className="portal-settings__notice">
          {t(
            'Ссылка на управление аккаунтом сейчас недоступна. Попробуйте позже.',
            'Account management is currently unavailable. Try again later.',
          )}
        </p>
      )}
    </section>
  );
}
