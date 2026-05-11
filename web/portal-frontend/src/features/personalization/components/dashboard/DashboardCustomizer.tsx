import { Button, Card, Checkbox, Select, Text, TextInput, useToaster } from '@gravity-ui/uikit';
import { memo, useMemo, useState } from 'react';

import { useDashboards, useDashboardWidgets } from '../../hooks/useDashboards';
import type { DashboardLayout, DashboardWidgetInput } from '../../types';

import './DashboardCustomizer.css';

const WIDGET_LIBRARY: Array<{ key: string; title: string }> = [
  { key: 'activity-feed', title: 'Activity Feed' },
  { key: 'upcoming-events', title: 'Upcoming Events' },
  { key: 'active-polls', title: 'Active Polls' },
  { key: 'team-stats', title: 'Team Stats' },
  { key: 'quick-links', title: 'Quick Links' },
];

type BaseWidgetConfig = {
  title: string;
  description: string;
  defaultSettings: Record<string, unknown>;
};

type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

const BASE_WIDGETS: Record<string, BaseWidgetConfig> = {
  'activity-feed': {
    title: 'Activity Feed',
    description: 'Latest community activity stream',
    defaultSettings: { limit: 10, showAvatars: true },
  },
  'upcoming-events': {
    title: 'Upcoming Events',
    description: 'Nearest events with RSVP progress',
    defaultSettings: { daysAhead: 14, showRsvp: true },
  },
  'active-polls': {
    title: 'Active Polls',
    description: 'Open votings requiring attention',
    defaultSettings: { limit: 5, showDeadline: true },
  },
  'team-stats': {
    title: 'Team Stats',
    description: 'Weekly community metrics summary',
    defaultSettings: { period: 'week', showTrend: true },
  },
  'quick-links': {
    title: 'Quick Links',
    description: 'Pinned shortcuts for frequent actions',
    defaultSettings: { maxLinks: 8, editable: true },
  },
};

function DashboardCustomizerComponent() {
  const { add: addToast } = useToaster();
  const {
    layouts,
    isLoading,
    error,
    isForbidden,
    createLayout,
    updateLayout,
    deleteLayout,
  } = useDashboards();
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>('desktop');
  const selectedLayout = useMemo<DashboardLayout | null>(
    () => layouts.find((layout) => layout.id === selectedLayoutId) ?? layouts[0] ?? null,
    [layouts, selectedLayoutId]
  );

  const {
    widgets,
    isForbidden: widgetsForbidden,
    createWidget,
    updateWidget,
    deleteWidget,
  } = useDashboardWidgets(selectedLayout?.id ?? null, false, !isForbidden);

  if (isForbidden || widgetsForbidden) {
    return (
      <Card className="dashboard-customizer">
        <div className="dashboard-customizer__header">
          <div>
            <Text variant="header-1">Dashboard Customizer</Text>
            <Text variant="body-1" color="secondary">
              Manage dashboard layouts and widget visibility
            </Text>
          </div>
        </div>
        <Text variant="body-2" color="secondary">
          Dashboard customization is unavailable for this account.
        </Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="dashboard-customizer">
        <div className="dashboard-customizer__header">
          <div>
            <Text variant="header-1">Dashboard Customizer</Text>
            <Text variant="body-1" color="secondary">
              Manage dashboard layouts and widget visibility
            </Text>
          </div>
        </div>
        <Text variant="body-2" color="danger">
          Failed to load dashboard customization settings.
        </Text>
      </Card>
    );
  }

  async function handleCreateLayout() {
    if (!newLayoutName.trim()) {
      return;
    }
    try {
      await createLayout({
        layout_name: newLayoutName.trim(),
        layout_config: {},
        is_default: layouts.length === 0,
      });
      setNewLayoutName('');
      addToast({ name: 'layout-created', title: 'Layout created', theme: 'success' });
    } catch (error) {
      addToast({
        name: 'layout-create-error',
        title: 'Failed to create layout',
        content: error instanceof Error ? error.message : undefined,
        theme: 'danger',
      });
    }
  }

  async function handleAddWidget(widgetKey: string) {
    if (!selectedLayout) {
      addToast({
        name: 'no-layout',
        title: 'Create a layout first',
        theme: 'warning',
      });
      return;
    }
    try {
      const nextY = widgets.length > 0 ? Math.max(...widgets.map((widget) => widget.position_y + widget.height)) : 0;
      await createWidget({
        widget_key: widgetKey,
        position_x: 0,
        position_y: nextY,
        width: 6,
        height: 3,
        is_visible: true,
        settings: BASE_WIDGETS[widgetKey]?.defaultSettings ?? {},
      });
      addToast({ name: 'widget-added', title: 'Widget added', theme: 'success' });
    } catch (error) {
      addToast({
        name: 'widget-add-error',
        title: 'Failed to add widget',
        content: error instanceof Error ? error.message : undefined,
        theme: 'danger',
      });
    }
  }

  async function handleToggleVisibility(widgetId: string, current: DashboardWidgetInput) {
    try {
      await updateWidget(widgetId, { ...current, is_visible: !current.is_visible });
    } catch (error) {
      addToast({
        name: 'widget-toggle-error',
        title: 'Failed to update widget',
        content: error instanceof Error ? error.message : undefined,
        theme: 'danger',
      });
    }
  }

  async function handleSetDefault(layout: DashboardLayout) {
    try {
      await updateLayout(layout.id, {
        layout_name: layout.layout_name,
        layout_config: layout.layout_config,
        is_default: true,
      });
      addToast({ name: 'layout-default', title: 'Default layout updated', theme: 'success' });
    } catch (error) {
      addToast({
        name: 'layout-default-error',
        title: 'Failed to update default layout',
        content: error instanceof Error ? error.message : undefined,
        theme: 'danger',
      });
    }
  }

  return (
    <Card className="dashboard-customizer">
      <div className="dashboard-customizer__header">
        <div>
          <Text variant="header-1">Dashboard Customizer</Text>
          <Text variant="body-1" color="secondary">
            Manage dashboard layouts and widget visibility
          </Text>
        </div>
      </div>

      <div className="dashboard-customizer__row">
        <TextInput
          value={newLayoutName}
          onUpdate={setNewLayoutName}
          placeholder="New layout name"
          className="dashboard-customizer__create-input"
        />
        <Button view="action" onClick={handleCreateLayout}>
          Create layout
        </Button>
      </div>

      <div className="dashboard-customizer__row">
        <Select
          value={selectedLayout ? [selectedLayout.id] : []}
          options={layouts.map((layout) => ({
            value: layout.id,
            content: `${layout.layout_name}${layout.is_default ? ' (default)' : ''}`,
          }))}
          onUpdate={(value) => setSelectedLayoutId(value[0] ?? null)}
          placeholder="Choose layout"
          disabled={isLoading || layouts.length === 0}
          className="dashboard-customizer__layout-select"
        />
        {selectedLayout && (
          <>
            <Button onClick={() => handleSetDefault(selectedLayout)} view="outlined">
              Set default
            </Button>
            <Button
              onClick={() =>
                void deleteLayout(selectedLayout.id).catch((error) =>
                  addToast({
                    name: 'layout-delete-error',
                    title: 'Failed to delete layout',
                    content: error instanceof Error ? error.message : undefined,
                    theme: 'danger',
                  }),
                )
              }
              view="flat-danger"
            >
              Delete layout
            </Button>
          </>
        )}
      </div>

      <div className="dashboard-customizer__row">
        <Text variant="subheader-1">Responsive preview</Text>
        <Button view={previewViewport === 'desktop' ? 'action' : 'outlined'} onClick={() => setPreviewViewport('desktop')}>
          Desktop
        </Button>
        <Button view={previewViewport === 'tablet' ? 'action' : 'outlined'} onClick={() => setPreviewViewport('tablet')}>
          Tablet
        </Button>
        <Button view={previewViewport === 'mobile' ? 'action' : 'outlined'} onClick={() => setPreviewViewport('mobile')}>
          Mobile
        </Button>
      </div>

      <div className={`dashboard-customizer__sections dashboard-customizer__sections--${previewViewport}`}>
        <Card view="outlined" className="dashboard-customizer__section">
          <Text variant="subheader-2">Widget library</Text>
          <div className="dashboard-customizer__widget-library">
            {WIDGET_LIBRARY.map((widget) => (
              <Button
                key={widget.key}
                view="outlined"
                onClick={() => handleAddWidget(widget.key)}
                disabled={!selectedLayout}
              >
                {widget.title}
              </Button>
            ))}
          </div>
        </Card>

        <Card view="outlined" className="dashboard-customizer__section">
          <Text variant="subheader-2">Widgets in layout</Text>
          {selectedLayout ? (
            <div className="dashboard-customizer__widget-list">
              {widgets.map((widget) => (
                <div key={widget.id} className="dashboard-customizer__widget-item">
                  <div>
                    <Text variant="body-2">{BASE_WIDGETS[widget.widget_key]?.title ?? widget.widget_key}</Text>
                    <Text variant="caption-2" color="secondary">
                      {BASE_WIDGETS[widget.widget_key]?.description ?? 'Custom widget'}
                    </Text>
                    <Text variant="caption-2" color="secondary">
                      Position ({widget.position_x}, {widget.position_y}), size {widget.width}x{widget.height}
                    </Text>
                  </div>
                  <div className="dashboard-customizer__widget-actions">
                    <Checkbox
                      checked={widget.is_visible}
                      onUpdate={() =>
                        handleToggleVisibility(widget.id, {
                          widget_key: widget.widget_key,
                          position_x: widget.position_x,
                          position_y: widget.position_y,
                          width: widget.width,
                          height: widget.height,
                          settings: widget.settings,
                          is_visible: widget.is_visible,
                        })
                      }
                      content="Visible"
                    />
                    <Button
                      view="flat-danger"
                      size="s"
                      onClick={() =>
                        void deleteWidget(widget.id).catch((error) =>
                          addToast({
                            name: 'widget-delete-error',
                            title: 'Failed to delete widget',
                            content: error instanceof Error ? error.message : undefined,
                            theme: 'danger',
                          }),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {widgets.length === 0 && (
                <Text variant="body-2" color="secondary">
                  No widgets added yet.
                </Text>
              )}
            </div>
          ) : (
            <Text variant="body-2" color="secondary">
              Select or create a layout to manage widgets.
            </Text>
          )}
        </Card>
      </div>
    </Card>
  );
}

export const DashboardCustomizer = memo(DashboardCustomizerComponent);
