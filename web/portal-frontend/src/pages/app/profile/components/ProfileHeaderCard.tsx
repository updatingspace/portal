import { Avatar, Button, Icon } from '@gravity-ui/uikit';
import { Gear } from '@gravity-ui/icons';
import { useNavigate } from 'react-router-dom';
import { useRouteBase } from '../../../../shared/hooks/useRouteBase';
import { useUITranslation } from '../../../../shared/ui/portal/PortalUI';
import type { ProfileOwnerVM } from '../model/types';

type ProfileHeaderCardProps = {
  owner: ProfileOwnerVM;
  isSelf: boolean;
  canEditProfile: boolean;
  onDetails: () => void;
};

export function ProfileHeaderCard({
  owner,
  isSelf,
  canEditProfile,
  onDetails,
}: ProfileHeaderCardProps) {
  const navigate = useNavigate();
  const routeBase = useRouteBase();
  const t = useUITranslation();
  const roles: Record<string, string> = {
    member: t('Участник', 'Member'),
    admin: t('Администратор', 'Administrator'),
    owner: t('Владелец', 'Owner'),
  };
  return (
    <header className="profile-identity">
      <div className="profile-identity__top">
        <Avatar
          size="xl"
          imgUrl={owner.avatarUrl}
          text={owner.tenantDisplayName}
        />
        {isSelf && canEditProfile && (
          <Button
            view="flat"
            size="xl"
            aria-label={t('Настройки профиля', 'Profile settings')}
            onClick={() => navigate(`${routeBase}/settings`)}
          >
            <Icon data={Gear} size={20} />
          </Button>
        )}
      </div>
      <h1>{owner.tenantDisplayName}</h1>
      {(owner.handle || owner.roleBadge) && (
        <p className="profile-identity__meta">
          {owner.handle && `@${owner.handle}`}
          {owner.handle && owner.roleBadge && ' · '}
          {owner.roleBadge && (roles[owner.roleBadge] || owner.roleBadge)}
        </p>
      )}
      {owner.bio && <p className="profile-identity__bio">{owner.bio}</p>}
      <Button
        size="xl"
        view="flat"
        className="profile-identity__details"
        onClick={onDetails}
      >
        {t('О профиле', 'Profile details')}
        <span aria-hidden="true">›</span>
      </Button>
    </header>
  );
}
