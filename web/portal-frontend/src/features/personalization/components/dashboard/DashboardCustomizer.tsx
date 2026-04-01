import { Button, Card, Checkbox, Select, Text, TextInput, useToaster } from '@gravity-ui/uikit';
import { useMemo, useState } from 'react';

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

export function DashboardCustomizer() {
  const { add: addToast } = useToaster();
  const { layouts, isLoading, createLayout, updateLayout, deleteLayout } = useDashboards();
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [newLayoutName, setNewLayoutName] = useState('');
  const selectedLayout = useMemo<DashboardLayout | null>(
    () => layouts.find((layout) => layout.id === selectedLayoutId) ?? layouts[0] ?? null,
    [layouts, selectedLayoutId]
  );

  const {
    widgets,
    createWidget,
    updateWidget,
    deleteWidget,
  } = useDashboardWidgets(selectedLayout?.id ?? null);

  async function handleCreateLayout() {
    if (!newLayoutName.trim()) {
      return;
    }
    await createLayout({
      layout_name: newLayoutName.trim(),
      layout_config: {},
      is_default: layouts.length === 0,
    });
    setNewLayoutName('');
    addToast({ name: 'layout-created', title: 'Layout created', theme: 'success' });
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
    const nextY = widgets.length > 0 ? Math.max(...widgets.map((widget) => widget.position_y + widget.height)) : 0;
    await createWidget({
      widget_key: widgetKey,
      position_x: 0,
      position_y: nextY,
      width: 6,
      height: 3,
      is_visible: true,
      settings: {},
    });
    addToast({ name: 'widget-added', title: 'Widget added', theme: 'success' });
  }

  async function handleToggleVisibility(widgetId: string, current: DashboardWidgetInput) {
    await updateWidget(widgetId, { ...current, is_visible: !current.is_visible });
  }

  async function handleSetDefault(layout: DashboardLayout) {
    await updateLayout(layout.id, {
      layout_name: layout.layout_name,
      layout_config: layout.layout_config,
      is_default: true,
    });
    addToast({ name: 'layout-default', title: 'Default layout updated', theme: 'success' });
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
              onClick={() => deleteLayout(selectedLayout.id)}
              view="flat-danger"
            >
              Delete layout
            </Button>
          </>
        )}
      </div>

      <div className="dashboard-customizer__sections">
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
                    <Text variant="body-2">{widget.widget_key}</Text>
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
                      onClick={() => deleteWidget(widget.id)}
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
