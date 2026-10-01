import { Button, DropdownMenu, Icon, Switch } from '@gravity-ui/uikit';
import { Ellipsis } from '@gravity-ui/icons';
import { usePortalI18n } from '../../../../shared/i18n/usePortalI18n';

type Section = { id: string; title: string; visible: boolean };

export function MobileLayoutEditor({
  sections,
  pending,
  onMove,
  onToggle,
  onRemove,
}: {
  sections: Section[];
  pending: boolean;
  onMove: (id: string, direction: -1 | 1) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = usePortalI18n();
  return (
    <ul className="dashboard-section-list" aria-label={t('dashboard.sections')}>
      {sections.map((section, index) => (
        <li key={section.id} className="dashboard-section-list__item">
          <div className="dashboard-section-list__label">
            <h2 id={`section-${section.id}`}>{section.title}</h2>
            <span>
              {t(
                section.visible
                  ? 'dashboard.widgetState.visible'
                  : 'dashboard.widgetState.hidden',
              )}
            </span>
          </div>
          <Switch
            size="l"
            checked={section.visible}
            disabled={pending}
            controlProps={{ 'aria-labelledby': `section-${section.id}` }}
            onUpdate={() => onToggle(section.id)}
          />
          <DropdownMenu
            size="xl"
            items={[
              {
                text: t('dashboard.widgetActions.up'),
                disabled: pending || index === 0,
                action: () => onMove(section.id, -1),
              },
              {
                text: t('dashboard.widgetActions.down'),
                disabled: pending || index === sections.length - 1,
                action: () => onMove(section.id, 1),
              },
              {
                text: t('dashboard.widgetActions.remove'),
                theme: 'danger',
                disabled: pending,
                action: () => onRemove(section.id),
              },
            ]}
            renderSwitcher={(props) => (
              <Button
                {...props}
                size="xl"
                view="flat"
                disabled={pending}
                aria-label={`${t('dashboard.sectionActions')}: ${section.title}`}
              >
                <Icon data={Ellipsis} size={20} />
              </Button>
            )}
          />
        </li>
      ))}
    </ul>
  );
}
