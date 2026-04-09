import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Icon, Label, Text, useToaster } from '@gravity-ui/uikit';
import { ArrowsOppositeToDots, Eye, Gear, GripHorizontal, Plus, TrashBin } from '@gravity-ui/icons';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import { usePortalI18n } from '../../../shared/i18n/usePortalI18n';
import { useFormatters } from '../../../shared/hooks/useFormatters';
import { useRouteBase } from '../../../shared/hooks/useRouteBase';
import { DashboardCard } from './ui/DashboardCard';
import { DashboardHero } from './ui/DashboardHero';
import { useDashboardStats } from './model/useDashboardStats';
import { useDashboards, useDashboardWidgets } from '../../../features/personalization/hooks/useDashboards';
import type { DashboardLayoutInput, DashboardWidget, DashboardWidgetInput } from '../../../features/personalization/types';
import { createDashboardWidget as createDashboardWidgetRequest } from '../../../features/personalization/api/contentApi';

import './dashboard.css';

type DashboardBreakpoint = 'desktop' | 'tablet' | 'mobile';

type LayoutPosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type DraftWidget = {
  clientId: string;
  persistedId: string | null;
  widget_key: string;
  settings: Record<string, unknown>;
  is_visible: boolean;
  positions: Record<DashboardBreakpoint, LayoutPosition>;
};

type DeletedWidgetRecord = {
  clientId: string;
  widgetKey: string;
};

type LayoutConfigV1 = {
  version: number;
  breakpoints: Record<DashboardBreakpoint, { cols: number; items: Record<string, LayoutPosition> }>;
};

type WidgetDefinition = {
  key: string;
  titleKey: string;
  descriptionKey: string;
  defaultSettings: Record<string, unknown>;
  defaultPositions: Record<DashboardBreakpoint, LayoutPosition>;
};

const BREAKPOINT_COLUMNS: Record<DashboardBreakpoint, number> = {
  desktop: 12,
  tablet: 8,
  mobile: 4,
};

const EDITOR_GRID_GAP_PX = 16;
const EDITOR_ROW_HEIGHT_PX = 112;
const DEFAULT_LAYOUT_NAME = 'My dashboard';

const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    key: 'overview-hero',
    titleKey: 'dashboard.widgets.hero.title',
    descriptionKey: 'dashboard.widgets.hero.description',
    defaultSettings: {},
    defaultPositions: {
      desktop: { x: 0, y: 0, w: 12, h: 2 },
      tablet: { x: 0, y: 0, w: 8, h: 2 },
      mobile: { x: 0, y: 0, w: 4, h: 2 },
    },
  },
  {
    key: 'overview-stats',
    titleKey: 'dashboard.widgets.stats.title',
    descriptionKey: 'dashboard.widgets.stats.description',
    defaultSettings: {},
    defaultPositions: {
      desktop: { x: 0, y: 2, w: 12, h: 3 },
      tablet: { x: 0, y: 2, w: 8, h: 3 },
      mobile: { x: 0, y: 2, w: 4, h: 3 },
    },
  },
  {
    key: 'activity-feed',
    titleKey: 'dashboard.widgets.activityFeed.title',
    descriptionKey: 'dashboard.widgets.activityFeed.description',
    defaultSettings: { limit: 5 },
    defaultPositions: {
      desktop: { x: 0, y: 5, w: 6, h: 3 },
      tablet: { x: 0, y: 5, w: 8, h: 3 },
      mobile: { x: 0, y: 5, w: 4, h: 3 },
    },
  },
  {
    key: 'upcoming-events',
    titleKey: 'dashboard.widgets.upcomingEvents.title',
    descriptionKey: 'dashboard.widgets.upcomingEvents.description',
    defaultSettings: { limit: 3 },
    defaultPositions: {
      desktop: { x: 6, y: 5, w: 6, h: 3 },
      tablet: { x: 0, y: 8, w: 8, h: 3 },
      mobile: { x: 0, y: 8, w: 4, h: 3 },
    },
  },
  {
    key: 'active-polls',
    titleKey: 'dashboard.widgets.activePolls.title',
    descriptionKey: 'dashboard.widgets.activePolls.description',
    defaultSettings: { limit: 3 },
    defaultPositions: {
      desktop: { x: 0, y: 8, w: 6, h: 3 },
      tablet: { x: 0, y: 11, w: 8, h: 3 },
      mobile: { x: 0, y: 11, w: 4, h: 3 },
    },
  },
  {
    key: 'team-stats',
    titleKey: 'dashboard.widgets.teamStats.title',
    descriptionKey: 'dashboard.widgets.teamStats.description',
    defaultSettings: { period: 'week' },
    defaultPositions: {
      desktop: { x: 6, y: 8, w: 3, h: 3 },
      tablet: { x: 0, y: 14, w: 4, h: 3 },
      mobile: { x: 0, y: 14, w: 4, h: 3 },
    },
  },
  {
    key: 'quick-links',
    titleKey: 'dashboard.widgets.quickLinks.title',
    descriptionKey: 'dashboard.widgets.quickLinks.description',
    defaultSettings: {},
    defaultPositions: {
      desktop: { x: 9, y: 8, w: 3, h: 3 },
      tablet: { x: 4, y: 14, w: 4, h: 3 },
      mobile: { x: 0, y: 17, w: 4, h: 3 },
    },
  },
];

const WIDGET_DEFINITION_MAP = Object.fromEntries(
  WIDGET_DEFINITIONS.map((definition) => [definition.key, definition]),
) as Record<string, WidgetDefinition>;

const createEmptyLayoutConfig = (): LayoutConfigV1 => ({
  version: 1,
  breakpoints: {
    desktop: { cols: BREAKPOINT_COLUMNS.desktop, items: {} },
    tablet: { cols: BREAKPOINT_COLUMNS.tablet, items: {} },
    mobile: { cols: BREAKPOINT_COLUMNS.mobile, items: {} },
  },
});

const clampPosition = (position: LayoutPosition, breakpoint: DashboardBreakpoint): LayoutPosition => {
  void breakpoint;
  return {
    x: Math.max(0, position.x),
    y: Math.max(0, position.y),
    w: Math.max(1, position.w),
    h: Math.max(1, position.h),
  };
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (!value || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'undefined';
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
};

const getRuntimeBreakpoint = (): DashboardBreakpoint => {
  if (typeof window === 'undefined') {
    return 'desktop';
  }
  if (window.innerWidth < 720) {
    return 'mobile';
  }
  if (window.innerWidth < 1080) {
    return 'tablet';
  }
  return 'desktop';
};

const parseLayoutConfig = (value: Record<string, unknown> | null | undefined): LayoutConfigV1 => {
  const base = createEmptyLayoutConfig();
  if (!value || typeof value !== 'object') {
    return base;
  }

  const rawBreakpoints = value.breakpoints;
  if (!rawBreakpoints || typeof rawBreakpoints !== 'object') {
    return {
      ...base,
      version: typeof value.version === 'number' ? value.version : 1,
    };
  }

  const breakpoints = { ...base.breakpoints };
  (['desktop', 'tablet', 'mobile'] as DashboardBreakpoint[]).forEach((breakpoint) => {
    const rawBreakpoint = (rawBreakpoints as Record<string, unknown>)[breakpoint];
    if (!rawBreakpoint || typeof rawBreakpoint !== 'object') {
      return;
    }
    const rawItems = (rawBreakpoint as { items?: unknown }).items;
    const nextItems: Record<string, LayoutPosition> = {};
    if (rawItems && typeof rawItems === 'object') {
      Object.entries(rawItems as Record<string, unknown>).forEach(([widgetId, rawPosition]) => {
        if (!rawPosition || typeof rawPosition !== 'object') {
          return;
        }
        const position = rawPosition as Partial<LayoutPosition>;
        if (
          typeof position.x === 'number' &&
          typeof position.y === 'number' &&
          typeof position.w === 'number' &&
          typeof position.h === 'number'
        ) {
          nextItems[widgetId] = clampPosition(
            { x: position.x, y: position.y, w: position.w, h: position.h },
            breakpoint,
          );
        }
      });
    }

    breakpoints[breakpoint] = {
      cols:
        typeof (rawBreakpoint as { cols?: unknown }).cols === 'number'
          ? (rawBreakpoint as { cols: number }).cols
          : BREAKPOINT_COLUMNS[breakpoint],
      items: nextItems,
    };
  });

  return {
    version: typeof value.version === 'number' ? value.version : 1,
    breakpoints,
  };
};

const buildDefaultDraftWidgets = (): DraftWidget[] =>
  WIDGET_DEFINITIONS.slice(0, 4).map((definition, index) => ({
    clientId: `draft-${definition.key}-${index}`,
    persistedId: null,
    widget_key: definition.key,
    settings: definition.defaultSettings,
    is_visible: true,
    positions: {
      desktop: definition.defaultPositions.desktop,
      tablet: definition.defaultPositions.tablet,
      mobile: definition.defaultPositions.mobile,
    },
  }));

const buildDraftWidgets = (
  widgets: DashboardWidget[],
  layoutConfig: LayoutConfigV1,
): DraftWidget[] => {
  if (!widgets.length) {
    return buildDefaultDraftWidgets();
  }

  return widgets.map((widget) => {
    const definition = WIDGET_DEFINITION_MAP[widget.widget_key];
    const fallback = definition?.defaultPositions ?? {
      desktop: { x: widget.position_x, y: widget.position_y, w: widget.width, h: widget.height },
      tablet: { x: 0, y: widget.position_y, w: Math.min(widget.width, BREAKPOINT_COLUMNS.tablet), h: widget.height },
      mobile: { x: 0, y: widget.position_y, w: Math.min(widget.width, BREAKPOINT_COLUMNS.mobile), h: widget.height },
    };

    const resolvePosition = (breakpoint: DashboardBreakpoint): LayoutPosition => {
      const stored = layoutConfig.breakpoints[breakpoint]?.items?.[widget.id];
      if (stored) {
        return clampPosition(stored, breakpoint);
      }

      if (breakpoint === 'desktop') {
        return clampPosition(
          { x: widget.position_x, y: widget.position_y, w: widget.width, h: widget.height },
          breakpoint,
        );
      }

      return clampPosition(fallback[breakpoint], breakpoint);
    };

    return {
      clientId: widget.id,
      persistedId: widget.id,
      widget_key: widget.widget_key,
      settings: widget.settings ?? {},
      is_visible: widget.is_visible,
      positions: {
        desktop: resolvePosition('desktop'),
        tablet: resolvePosition('tablet'),
        mobile: resolvePosition('mobile'),
      },
    };
  });
};

const serializeLayoutConfig = (draftWidgets: DraftWidget[]): LayoutConfigV1 => {
  const layoutConfig = createEmptyLayoutConfig();
  draftWidgets.forEach((widget) => {
    (['desktop', 'tablet', 'mobile'] as DashboardBreakpoint[]).forEach((breakpoint) => {
      layoutConfig.breakpoints[breakpoint].items[widget.clientId] = clampPosition(
        widget.positions[breakpoint],
        breakpoint,
      );
    });
  });
  return layoutConfig;
};

const toWidgetInput = (draftWidget: DraftWidget): DashboardWidgetInput => ({
  widget_key: draftWidget.widget_key,
  position_x: draftWidget.positions.desktop.x,
  position_y: draftWidget.positions.desktop.y,
  width: draftWidget.positions.desktop.w,
  height: draftWidget.positions.desktop.h,
  settings: draftWidget.settings,
  is_visible: draftWidget.is_visible,
});

const compareWidgetOrder = (left: DraftWidget, right: DraftWidget, breakpoint: DashboardBreakpoint) => {
  const leftPosition = left.positions[breakpoint];
  const rightPosition = right.positions[breakpoint];
  if (leftPosition.y === rightPosition.y) {
    return leftPosition.x - rightPosition.x;
  }
  return leftPosition.y - rightPosition.y;
};

const getOverlapArea = (left: LayoutPosition, right: LayoutPosition): number => {
  const overlapWidth = Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x);
  const overlapHeight = Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y);
  if (overlapWidth <= 0 || overlapHeight <= 0) {
    return 0;
  }

  return overlapWidth * overlapHeight;
};

const findSwapCandidate = (
  widgets: DraftWidget[],
  activeWidgetId: string,
  nextPosition: LayoutPosition,
  breakpoint: DashboardBreakpoint,
): DraftWidget | null => {
  let bestCandidate: DraftWidget | null = null;
  let bestOverlap = 0;

  widgets.forEach((widget) => {
    if (widget.clientId === activeWidgetId) {
      return;
    }

    const overlap = getOverlapArea(nextPosition, widget.positions[breakpoint]);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestCandidate = widget;
    }
  });

  return bestCandidate;
};

const positionsOverlap = (left: LayoutPosition, right: LayoutPosition): boolean =>
  left.x < right.x + right.w &&
  left.x + left.w > right.x &&
  left.y < right.y + right.h &&
  left.y + left.h > right.y;

const packBreakpointWidgets = (
  widgets: DraftWidget[],
  breakpoint: DashboardBreakpoint,
  activeWidgetId: string,
): DraftWidget[] => {
  const orderedWidgets = [...widgets].sort((left, right) => {
    if (left.clientId === activeWidgetId) {
      return -1;
    }
    if (right.clientId === activeWidgetId) {
      return 1;
    }
    return compareWidgetOrder(left, right, breakpoint);
  });

  const placedPositions: LayoutPosition[] = [];

  return orderedWidgets.map((widget) => {
    const basePosition = clampPosition(widget.positions[breakpoint], breakpoint);
    let nextPosition = basePosition;
    let attempts = 0;

    while (attempts < 100) {
      const collidingPositions = placedPositions.filter((position) => positionsOverlap(nextPosition, position));
      if (!collidingPositions.length) {
        break;
      }

      const nextY = Math.max(...collidingPositions.map((position) => position.y + position.h));
      nextPosition = {
        ...nextPosition,
        y: nextY,
      };
      attempts += 1;
    }

    placedPositions.push(nextPosition);

    return {
      ...widget,
      positions: {
        ...widget.positions,
        [breakpoint]: nextPosition,
      },
    };
  });
};

const packBreakpointWidgetsWithReservations = (
  widgets: DraftWidget[],
  breakpoint: DashboardBreakpoint,
  reservedPositions: LayoutPosition[],
): DraftWidget[] => {
  const orderedWidgets = [...widgets].sort((left, right) => compareWidgetOrder(left, right, breakpoint));
  const placedPositions = reservedPositions.map((position) => clampPosition(position, breakpoint));

  return orderedWidgets.map((widget) => {
    const basePosition = clampPosition(widget.positions[breakpoint], breakpoint);
    let nextPosition = basePosition;
    let attempts = 0;

    while (attempts < 100) {
      const collidingPositions = placedPositions.filter((position) => positionsOverlap(nextPosition, position));
      if (!collidingPositions.length) {
        break;
      }

      const nextY = Math.max(...collidingPositions.map((position) => position.y + position.h));
      nextPosition = {
        ...nextPosition,
        y: nextY,
      };
      attempts += 1;
    }

    placedPositions.push(nextPosition);

    return {
      ...widget,
      positions: {
        ...widget.positions,
        [breakpoint]: nextPosition,
      },
    };
  });
};

const getMovePreviewPosition = (
  interaction: DashboardInteraction,
  breakpoint: DashboardBreakpoint,
): LayoutPosition => {
  const finalDeltaColumns = Math.round(interaction.currentOffsetX / interaction.columnStep);
  const finalDeltaRows = Math.round(interaction.currentOffsetY / interaction.rowStep);

  return clampPosition(
    {
      x: interaction.origin.x + finalDeltaColumns,
      y: interaction.origin.y + finalDeltaRows,
      w: interaction.origin.w,
      h: interaction.origin.h,
    },
    breakpoint,
  );
};

const buildMovePreviewWidgets = (
  widgets: DraftWidget[],
  interaction: DashboardInteraction,
  breakpoint: DashboardBreakpoint,
): DraftWidget[] => {
  const activeWidget = widgets.find((widget) => widget.clientId === interaction.widgetId);
  if (!activeWidget) {
    return widgets;
  }

  const previewPosition = getMovePreviewPosition(interaction, breakpoint);
  return packBreakpointWidgetsWithReservations(
    widgets.filter((widget) => widget.clientId !== interaction.widgetId),
    breakpoint,
    [previewPosition],
  );
};

const WidgetSurface: React.FC<{
  title: string;
  description: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <Card view="filled" className="dashboard-widget-surface h-100 p-4">
    <div className="dashboard-widget-surface__header">
      <div>
        <Text variant="subheader-2">{title}</Text>
        <Text variant="body-2" color="secondary">
          {description}
        </Text>
      </div>
    </div>
    <div className="dashboard-widget-surface__content">{children}</div>
  </Card>
);

type DashboardInteractionMode = 'move' | 'resize';

type DashboardInteraction = {
  widgetId: string;
  mode: DashboardInteractionMode;
  pointerId: number;
  startX: number;
  startY: number;
  origin: LayoutPosition;
  currentOffsetX: number;
  currentOffsetY: number;
  columnStep: number;
  rowStep: number;
  swapTargetId: string | null;
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const routeBase = useRouteBase();
  const { add } = useToaster();
  const { t } = usePortalI18n();
  const { formatDateTime, formatRelativeTime } = useFormatters();
  const { stats } = useDashboardStats();
  const { layouts, isForbidden, createLayout, updateLayout } = useDashboards();
  const selectedLayout = useMemo(
    () => layouts.find((layout) => layout.is_default) ?? layouts[0] ?? null,
    [layouts],
  );
  const {
    widgets,
    createWidget,
    updateWidget,
    deleteWidget,
  } = useDashboardWidgets(selectedLayout?.id ?? null, false, !isForbidden);
  const [isEditing, setIsEditing] = useState(false);
  const [previewBreakpoint, setPreviewBreakpoint] = useState<DashboardBreakpoint>(() => getRuntimeBreakpoint());
  const [deletedWidgets, setDeletedWidgets] = useState<DeletedWidgetRecord[]>([]);
  const dashboardGridRef = useRef<HTMLDivElement | null>(null);
  const lastSyncedServerStateRef = useRef<string | null>(null);
  const [interaction, setInteraction] = useState<DashboardInteraction | null>(null);
  const serverLayoutConfig = useMemo(
    () => parseLayoutConfig(selectedLayout?.layout_config as Record<string, unknown> | undefined),
    [selectedLayout?.layout_config],
  );
  const serverDraftWidgets = useMemo(
    () => buildDraftWidgets(widgets, serverLayoutConfig),
    [widgets, serverLayoutConfig],
  );
  const serverStateSignature = useMemo(
    () =>
      stableStringify({
        layoutId: selectedLayout?.id ?? null,
        layoutName: selectedLayout?.layout_name ?? DEFAULT_LAYOUT_NAME,
        widgets: serverDraftWidgets.map((widget) => ({
          clientId: widget.clientId,
          persistedId: widget.persistedId,
          widget_key: widget.widget_key,
          is_visible: widget.is_visible,
          settings: widget.settings,
          positions: widget.positions,
        })),
      }),
    [selectedLayout?.id, selectedLayout?.layout_name, serverDraftWidgets],
  );
  const [draftWidgets, setDraftWidgets] = useState<DraftWidget[]>(serverDraftWidgets);
  const [layoutName, setLayoutName] = useState(selectedLayout?.layout_name ?? DEFAULT_LAYOUT_NAME);

  useDocumentTitle(t('dashboard.title'));

  useEffect(() => {
    if (!isEditing && lastSyncedServerStateRef.current !== serverStateSignature) {
      lastSyncedServerStateRef.current = serverStateSignature;
      setDraftWidgets(serverDraftWidgets);
      setLayoutName(selectedLayout?.layout_name ?? DEFAULT_LAYOUT_NAME);
      setDeletedWidgets([]);
    }
  }, [isEditing, selectedLayout?.layout_name, serverDraftWidgets, serverStateSignature]);

  useEffect(() => {
    const handleResize = () => {
      if (!isEditing) {
        setPreviewBreakpoint(getRuntimeBreakpoint());
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isEditing]);

  const handleOpenFeed = useCallback(() => navigate(`${routeBase}/feed`), [navigate, routeBase]);
  const handleOpenEvents = useCallback(() => navigate(`${routeBase}/events`), [navigate, routeBase]);
  const handleOpenVoting = useCallback(() => navigate(`${routeBase}/voting`), [navigate, routeBase]);

  const updateDraftWidget = useCallback((clientId: string, updater: (widget: DraftWidget) => DraftWidget) => {
    setDraftWidgets((current) =>
      current.map((widget) => (widget.clientId === clientId ? updater(widget) : widget)),
    );
  }, []);

  const handleToggleVisibility = useCallback(
    (clientId: string) => {
      updateDraftWidget(clientId, (widget) => ({
        ...widget,
        is_visible: !widget.is_visible,
      }));
    },
    [updateDraftWidget],
  );

  const handleRemoveWidget = useCallback((clientId: string) => {
    const target = draftWidgets.find((widget) => widget.clientId === clientId);
    if (!target) {
      return;
    }
    setDraftWidgets((current) => current.filter((widget) => widget.clientId !== clientId));
    setDeletedWidgets((current) => [...current, { clientId, widgetKey: target.widget_key }]);
  }, [draftWidgets]);

  const handleAddWidget = useCallback((widgetKey: string) => {
    const definition = WIDGET_DEFINITION_MAP[widgetKey];
    if (!definition) {
      return;
    }
    const draftId = `draft-${widgetKey}-${Date.now()}`;
    setDraftWidgets((current) => {
      const nextY =
        current.reduce(
          (max, widget) => Math.max(max, widget.positions[previewBreakpoint].y + widget.positions[previewBreakpoint].h),
          0,
        );

      const nextWidget: DraftWidget = {
        clientId: draftId,
        persistedId: null,
        widget_key: widgetKey,
        settings: definition.defaultSettings,
        is_visible: true,
        positions: {
          ...definition.defaultPositions,
          [previewBreakpoint]: {
            ...definition.defaultPositions[previewBreakpoint],
            x: 0,
            y: nextY,
          },
        },
      };

      return packBreakpointWidgets([...current, nextWidget], previewBreakpoint, draftId);
    });
  }, [previewBreakpoint]);

  const beginInteraction = useCallback(
    (widgetId: string, mode: DashboardInteractionMode) =>
      (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!isEditing) {
          return;
        }

        const widget = draftWidgets.find((item) => item.clientId === widgetId);
        const grid = dashboardGridRef.current;
        if (!widget || !grid) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const rect = grid.getBoundingClientRect();
        const cols = BREAKPOINT_COLUMNS[previewBreakpoint];
        const availableWidth = Math.max(1, rect.width - EDITOR_GRID_GAP_PX * (cols - 1));

        setInteraction({
          widgetId,
          mode,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          origin: widget.positions[previewBreakpoint],
          currentOffsetX: 0,
          currentOffsetY: 0,
          columnStep: availableWidth / cols,
          rowStep: EDITOR_ROW_HEIGHT_PX + EDITOR_GRID_GAP_PX,
          swapTargetId: null,
        });
      },
    [draftWidgets, isEditing, previewBreakpoint],
  );

  useEffect(() => {
    if (!interaction) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== interaction.pointerId) {
        return;
      }

      event.preventDefault();

      const offsetX = event.clientX - interaction.startX;
      const offsetY = event.clientY - interaction.startY;
      const deltaColumns = Math.round(offsetX / interaction.columnStep);
      const deltaRows = Math.round(offsetY / interaction.rowStep);

      const nextPosition =
        interaction.mode === 'move'
          ? clampPosition(
              {
                x: interaction.origin.x + deltaColumns,
                y: interaction.origin.y + deltaRows,
                w: interaction.origin.w,
                h: interaction.origin.h,
              },
              previewBreakpoint,
            )
          : clampPosition(
              {
                x: interaction.origin.x,
                y: interaction.origin.y,
                w: interaction.origin.w + deltaColumns,
                h: interaction.origin.h + deltaRows,
              },
              previewBreakpoint,
            );

      if (interaction.mode === 'move') {
        const swapTarget = findSwapCandidate(draftWidgets, interaction.widgetId, nextPosition, previewBreakpoint);
        setInteraction((current) =>
          current && current.widgetId === interaction.widgetId
            ? {
                ...current,
                currentOffsetX: offsetX,
                currentOffsetY: offsetY,
                swapTargetId: swapTarget?.clientId ?? null,
              }
            : current,
        );
        return;
      }

      setDraftWidgets((current) =>
        packBreakpointWidgets(
          current.map((widget) => {
            if (widget.clientId !== interaction.widgetId) {
              return widget;
            }

            return {
              ...widget,
              positions: {
                ...widget.positions,
                [previewBreakpoint]: nextPosition,
              },
            };
          }),
          previewBreakpoint,
          interaction.widgetId,
        ),
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== interaction.pointerId) {
        return;
      }

      if (interaction.mode === 'move') {
        setDraftWidgets((current) => {
          const activeWidget = current.find((widget) => widget.clientId === interaction.widgetId);
          if (!activeWidget) {
            return current;
          }

          const finalPosition = getMovePreviewPosition(interaction, previewBreakpoint);
          const packedWidgets = packBreakpointWidgetsWithReservations(
            current.filter((widget) => widget.clientId !== interaction.widgetId),
            previewBreakpoint,
            [finalPosition],
          );

          return [
            ...packedWidgets,
            {
              ...activeWidget,
              positions: {
                ...activeWidget.positions,
                [previewBreakpoint]: finalPosition,
              },
            },
          ];
        });
      }

      setInteraction(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [interaction, previewBreakpoint]);

  const handleDiscardChanges = useCallback(() => {
    setDraftWidgets(serverDraftWidgets);
    setLayoutName(selectedLayout?.layout_name ?? DEFAULT_LAYOUT_NAME);
    setDeletedWidgets([]);
    setInteraction(null);
    setIsEditing(false);
  }, [selectedLayout?.layout_name, serverDraftWidgets]);

  const handleResetLayout = useCallback(() => {
    const resetDraft = buildDraftWidgets(
      draftWidgets
        .filter((widget) => widget.persistedId)
        .map((widget) => ({
          id: widget.persistedId as string,
          layout_id: selectedLayout?.id ?? '',
          tenant_id: selectedLayout?.tenant_id ?? '',
          widget_key: widget.widget_key,
          position_x: widget.positions.desktop.x,
          position_y: widget.positions.desktop.y,
          width: widget.positions.desktop.w,
          height: widget.positions.desktop.h,
          settings: widget.settings,
          is_visible: widget.is_visible,
          deleted_at: null,
          created_at: '',
          updated_at: '',
        })),
      createEmptyLayoutConfig(),
    );
    setDraftWidgets(resetDraft);
    setDeletedWidgets([]);
    setInteraction(null);
  }, [draftWidgets, selectedLayout?.id, selectedLayout?.tenant_id]);

  const handleSaveLayout = useCallback(async () => {
    try {
      let layout = selectedLayout;
      let resolvedWidgets = [...draftWidgets];

      if (!layout) {
        layout = await createLayout({
          layout_name: layoutName || DEFAULT_LAYOUT_NAME,
          layout_config: createEmptyLayoutConfig(),
          is_default: true,
        } satisfies DashboardLayoutInput);
      }

      for (const widget of resolvedWidgets.filter((item) => item.persistedId === null)) {
        const created =
          selectedLayout?.id === layout.id
            ? await createWidget(toWidgetInput(widget))
            : await createDashboardWidgetRequest(layout.id, toWidgetInput(widget));
        resolvedWidgets = resolvedWidgets.map((item) =>
          item.clientId === widget.clientId
            ? { ...item, clientId: created.id, persistedId: created.id }
            : item,
        );
      }

      for (const widget of resolvedWidgets.filter((item) => item.persistedId !== null)) {
        await updateWidget(widget.persistedId as string, toWidgetInput(widget));
      }

      for (const deletedWidget of deletedWidgets) {
        if (resolvedWidgets.some((widget) => widget.widget_key === deletedWidget.widgetKey)) {
          continue;
        }

        const persistedId =
          widgets.find((widget) => widget.id === deletedWidget.clientId)?.id ??
          resolvedWidgets.find((widget) => widget.clientId === deletedWidget.clientId)?.persistedId;
        if (persistedId) {
          await deleteWidget(persistedId);
        }
      }

      const layoutConfig = serializeLayoutConfig(resolvedWidgets);
      await updateLayout(layout.id, {
        layout_name: layoutName || DEFAULT_LAYOUT_NAME,
        layout_config: layoutConfig,
        is_default: true,
      } satisfies DashboardLayoutInput);

      setDraftWidgets(resolvedWidgets);
      setDeletedWidgets([]);
      setIsEditing(false);
      add({ name: 'dashboard-saved', title: t('dashboard.save'), theme: 'success' });
    } catch (error) {
      add({
        name: 'dashboard-save-error',
        title: t('dashboard.saveError'),
        content: error instanceof Error ? error.message : undefined,
        theme: 'danger',
      });
    }
  }, [
    add,
    createLayout,
    createWidget,
    deleteWidget,
    deletedWidgets,
    draftWidgets,
    layoutName,
    selectedLayout,
    t,
    updateLayout,
    updateWidget,
    widgets,
  ]);

  const activeMoveWidget =
    interaction?.mode === 'move'
      ? draftWidgets.find((widget) => widget.clientId === interaction.widgetId) ?? null
      : null;
  const renderedWidgets = useMemo(() => {
    if (!isEditing) {
      return [...serverDraftWidgets]
        .filter((widget) => widget.is_visible)
        .sort((left, right) => compareWidgetOrder(left, right, previewBreakpoint));
    }

    if (interaction?.mode === 'move') {
      return buildMovePreviewWidgets(draftWidgets, interaction, previewBreakpoint).sort((left, right) =>
        compareWidgetOrder(left, right, previewBreakpoint),
      );
    }

    return [...draftWidgets].sort((left, right) => compareWidgetOrder(left, right, previewBreakpoint));
  }, [draftWidgets, interaction, isEditing, previewBreakpoint, serverDraftWidgets]);
  const moveOverlayOrigin = activeMoveWidget?.positions[previewBreakpoint] ?? null;

  const availableWidgetDefinitions = useMemo(
    () =>
      WIDGET_DEFINITIONS.filter(
        (definition) => !draftWidgets.some((widget) => widget.widget_key === definition.key),
      ),
    [draftWidgets],
  );

  const renderWidgetContent = (widget: DraftWidget) => {
    const title = t(WIDGET_DEFINITION_MAP[widget.widget_key]?.titleKey ?? 'dashboard.title');
    const description = t(WIDGET_DEFINITION_MAP[widget.widget_key]?.descriptionKey ?? 'dashboard.subtitle');

    switch (widget.widget_key) {
      case 'overview-hero':
        return (
          <DashboardHero
            onOpenFeed={handleOpenFeed}
            onOpenEvents={handleOpenEvents}
            onOpenVoting={handleOpenVoting}
          />
        );
      case 'overview-stats':
        return (
          <div className="row g-3">
            {stats.map((stat) => (
              <div key={stat.title} className="col-12 col-md-4">
                <DashboardCard stat={stat} />
              </div>
            ))}
          </div>
        );
      case 'activity-feed':
        return (
          <WidgetSurface title={title} description={description}>
            <div className="dashboard-list">
              {['Patch notes synced', 'Moderator approved a request', 'Feed digest refreshed'].map((item, index) => (
                <div key={item} className="dashboard-list__item">
                  <Text variant="body-2">{item}</Text>
                  <Text variant="caption-1" color="secondary">
                    {formatRelativeTime(new Date(Date.now() - index * 60 * 60 * 1000))}
                  </Text>
                </div>
              ))}
            </div>
          </WidgetSurface>
        );
      case 'upcoming-events':
        return (
          <WidgetSurface title={title} description={description}>
            <div className="dashboard-list">
              {[
                { title: 'Raid planning', at: new Date(Date.now() + 2 * 60 * 60 * 1000) },
                { title: 'Recruitment interview', at: new Date(Date.now() + 7 * 60 * 60 * 1000) },
              ].map((item) => (
                <div key={item.title} className="dashboard-list__item">
                  <Text variant="body-2">{item.title}</Text>
                  <Text variant="caption-1" color="secondary">
                    {formatDateTime(item.at)}
                  </Text>
                </div>
              ))}
            </div>
          </WidgetSurface>
        );
      case 'active-polls':
        return (
          <WidgetSurface title={title} description={description}>
            <div className="dashboard-list">
              {['Officer rotation vote', 'New raid slot poll', 'Community feedback'].map((item, index) => (
                <div key={item} className="dashboard-list__item">
                  <Text variant="body-2">{item}</Text>
                  <Label theme="warning" size="xs">
                    {formatRelativeTime(new Date(Date.now() + (index + 1) * 2 * 60 * 60 * 1000))}
                  </Label>
                </div>
              ))}
            </div>
          </WidgetSurface>
        );
      case 'team-stats':
        return (
          <WidgetSurface title={title} description={description}>
            <div className="dashboard-metric-stack">
              <div>
                <Text variant="header-2">94%</Text>
                <Text variant="caption-1" color="secondary">Attendance rate</Text>
              </div>
              <div>
                <Text variant="header-2">18</Text>
                <Text variant="caption-1" color="secondary">Open tasks</Text>
              </div>
            </div>
          </WidgetSurface>
        );
      case 'quick-links':
        return (
          <WidgetSurface title={title} description={description}>
            <div className="dashboard-link-stack">
              <Button view="outlined" onClick={handleOpenFeed}>Feed</Button>
              <Button view="outlined" onClick={handleOpenEvents}>Events</Button>
              <Button view="outlined" onClick={handleOpenVoting}>Voting</Button>
            </div>
          </WidgetSurface>
        );
      default:
        return (
          <WidgetSurface title={title} description={description}>
            <Text variant="body-2">{formatDateTime(new Date())}</Text>
          </WidgetSurface>
        );
    }
  };

  const renderWidgetFrame = (
    widget: DraftWidget,
    options: {
      isEditing: boolean;
      isMoveInteraction: boolean;
      isResizeInteraction: boolean;
      isDropTarget: boolean;
      isOverlay?: boolean;
      style?: React.CSSProperties;
    },
  ) => {
    const position = widget.positions[previewBreakpoint];
    const baseClasses = [
      'dashboard-grid__item',
      widget.is_visible ? '' : 'dashboard-grid__item--hidden',
      options.isEditing ? 'dashboard-grid__item--editing' : '',
      options.isMoveInteraction ? 'dashboard-grid__item--dragging' : '',
      options.isResizeInteraction ? 'dashboard-grid__item--resizing' : '',
      options.isDropTarget ? 'dashboard-grid__item--drop-target' : '',
      options.isOverlay ? 'dashboard-grid__item--drag-overlay' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        key={widget.clientId}
        className={baseClasses}
        style={{
          gridColumn: `${position.x + 1} / span ${position.w}`,
          gridRow: `${position.y + 1} / span ${position.h}`,
          ...(options.style ?? {}),
        }}
      >
        {options.isEditing ? (
          <div className="dashboard-grid__chrome">
            <button
              type="button"
              className="dashboard-grid__drag-handle"
              onPointerDown={beginInteraction(widget.clientId, 'move')}
            >
              <Icon data={GripHorizontal} />
              <span>{t('dashboard.widgetActions.move')}</span>
            </button>
            <div className="dashboard-grid__chrome-actions">
              <Button
                size="s"
                view="flat"
                onClick={() => handleToggleVisibility(widget.clientId)}
                title={widget.is_visible ? t('dashboard.widgetActions.hide') : t('dashboard.widgetActions.show')}
              >
                <Icon data={Eye} />
                {widget.is_visible ? t('dashboard.widgetActions.hide') : t('dashboard.widgetActions.show')}
              </Button>
              <Button
                size="s"
                view="flat-danger"
                onClick={() => handleRemoveWidget(widget.clientId)}
                title={t('dashboard.widgetActions.remove')}
              >
                <Icon data={TrashBin} />
              </Button>
            </div>
          </div>
        ) : null}
        {options.isEditing ? (
          <button
            type="button"
            className="dashboard-grid__resize-handle"
            onPointerDown={beginInteraction(widget.clientId, 'resize')}
            aria-label={t('dashboard.widgetActions.resize')}
            title={t('dashboard.widgetActions.resize')}
          >
            <Icon data={ArrowsOppositeToDots} />
          </button>
        ) : null}
        {!widget.is_visible && options.isEditing ? (
          <Label theme="normal" className="dashboard-grid__hidden-label">
            {t('dashboard.widgetState.hidden')}
          </Label>
        ) : null}
        <div className="dashboard-grid__content">{renderWidgetContent(widget)}</div>
      </div>
    );
  };

  return (
    <div className="dashboard-page container-fluid">
      <div className="dashboard-page__header">
        <div>
          <Text variant="caption-2" color="secondary">
            {t('dashboard.kicker')}
          </Text>
          <Text variant="display-1" as="h1">
            {t('dashboard.title')}
          </Text>
        </div>
        <div className="dashboard-page__actions">
          {!isForbidden ? (
            isEditing ? (
              <>
                <Button view="outlined" onClick={handleDiscardChanges}>
                  {t('dashboard.discard')}
                </Button>
                <Button view="outlined" onClick={handleResetLayout}>
                  {t('dashboard.reset')}
                </Button>
                <Button view="action" onClick={() => void handleSaveLayout()}>
                  {t('dashboard.save')}
                </Button>
              </>
            ) : (
              <Button view="action" onClick={() => setIsEditing(true)}>
                <Icon data={Gear} />
                {t('dashboard.edit')}
              </Button>
            )
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <Card view="filled" className="dashboard-editor-toolbar p-4 mb-4">
          <div className="dashboard-editor-toolbar__section">
            <Text variant="subheader-2">{t('dashboard.done')}</Text>
            <Text variant="body-2" color="secondary">
              {layoutName}
            </Text>
          </div>
          <div className="dashboard-editor-toolbar__section">
            {(Object.keys(BREAKPOINT_COLUMNS) as DashboardBreakpoint[]).map((breakpoint) => (
              <Button
                key={breakpoint}
                view={previewBreakpoint === breakpoint ? 'action' : 'outlined'}
                onClick={() => setPreviewBreakpoint(breakpoint)}
              >
                {t(`dashboard.breakpoint.${breakpoint}`)}
              </Button>
            ))}
          </div>
          <div className="dashboard-editor-toolbar__section">
            {availableWidgetDefinitions.map((definition) => (
              <Button key={definition.key} view="flat" onClick={() => handleAddWidget(definition.key)}>
                <Icon data={Plus} />
                {t(definition.titleKey)}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}

      <div
        ref={dashboardGridRef}
        className={`dashboard-grid dashboard-grid--${previewBreakpoint}${isEditing ? ' dashboard-grid--editing' : ''}`}
        style={{ ['--dashboard-cols' as string]: BREAKPOINT_COLUMNS[previewBreakpoint] }}
      >
        {renderedWidgets.map((widget) => {
          const isMoveInteraction = interaction?.widgetId === widget.clientId && interaction.mode === 'move';
          const isResizeInteraction = interaction?.widgetId === widget.clientId && interaction.mode === 'resize';
          const isDropTarget = interaction?.swapTargetId === widget.clientId && interaction.mode === 'move';

          return renderWidgetFrame(widget, {
            isEditing,
            isMoveInteraction,
            isResizeInteraction,
            isDropTarget,
          });
        })}
        {activeMoveWidget && interaction && moveOverlayOrigin ? (
          <div
            className="dashboard-grid__drag-overlay"
            style={{
              left: `${moveOverlayOrigin.x * (interaction.columnStep + EDITOR_GRID_GAP_PX)}px`,
              top: `${moveOverlayOrigin.y * (EDITOR_ROW_HEIGHT_PX + EDITOR_GRID_GAP_PX)}px`,
              width: `${moveOverlayOrigin.w * interaction.columnStep + Math.max(0, moveOverlayOrigin.w - 1) * EDITOR_GRID_GAP_PX}px`,
              height: `${moveOverlayOrigin.h * EDITOR_ROW_HEIGHT_PX + Math.max(0, moveOverlayOrigin.h - 1) * EDITOR_GRID_GAP_PX}px`,
              transform: `translate3d(${interaction.currentOffsetX}px, ${interaction.currentOffsetY}px, 0)`,
            }}
          >
            {renderWidgetFrame(activeMoveWidget, {
              isEditing,
            isMoveInteraction: true,
            isResizeInteraction: false,
            isDropTarget: false,
            isOverlay: true,
            style: {
                gridColumn: 'auto',
                gridRow: 'auto',
                width: '100%',
                height: '100%',
              },
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default DashboardPage;
