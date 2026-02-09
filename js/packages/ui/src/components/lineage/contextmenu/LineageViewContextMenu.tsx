"use client";

/**
 * @file LineageViewContextMenu.tsx
 * @description Context menu components for lineage graph nodes with dependency injection.
 *
 * These components provide right-click context menus for model nodes and column nodes
 * in the lineage visualization. They support:
 * - Query generation and navigation
 * - Row count, profile, value diff, and histogram diff actions
 * - Node selection (parent/child nodes)
 * - Column-level lineage (impact radius)
 *
 * The components use dependency injection for:
 * - Action execution (runAction callback)
 * - Navigation (onNavigate callback)
 * - Analytics tracking (onTrack callback)
 * - Histogram diff support checking (supportsHistogramDiff callback)
 * - Run type metadata (findByRunType callback)
 *
 * @example
 * ```tsx
 * <LineageViewContextMenu
 *   x={100}
 *   y={200}
 *   node={selectedNode}
 *   isOpen={true}
 *   onClose={() => setMenuOpen(false)}
 *   deps={{
 *     runAction: (type, params, options) => executeAction(type, params, options),
 *     onNavigate: (path) => router.push(path),
 *     onTrack: (event, props) => analytics.track(event, props),
 *     supportsHistogramDiff: (columnType) => checkHistogramSupport(columnType),
 *     findByRunType: (type) => getRunTypeMetadata(type),
 *   }}
 * />
 * ```
 */

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { type ReactNode, useState } from "react";
import { BiArrowFromBottom, BiArrowToBottom } from "react-icons/bi";
import { FaRegDotCircle } from "react-icons/fa";
import type { CllInput } from "../../../api/cll";
import type { SubmitRunTrackProps } from "../../../api/runs";
import {
  isLineageGraphColumnNode,
  isLineageGraphNode,
  type LineageGraphColumnNode,
  type LineageGraphNode,
  type LineageGraphNodes,
} from "../../../contexts/lineage/types";
import { formatSelectColumns } from "../../../utils/formatSelect";
import type { IconComponent } from "../../run/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Tracking event types for context menu actions
 */
export type ContextMenuTrackEvent = "explore_action" | "lineage_selection";

/**
 * Properties for explore action tracking
 */
export interface ExploreActionTrackProps {
  action: string;
  source: string;
  node_count: number;
}

/**
 * Properties for lineage selection tracking
 */
export interface LineageSelectionTrackProps {
  action: string;
}

/**
 * Run type metadata returned by findByRunType
 */
export interface RunTypeMetadata {
  title: string;
  icon: IconComponent;
}

/**
 * Dependency injection props for context menu components.
 * These allow the consumer to inject OSS-specific behavior.
 */
export interface LineageViewContextMenuDeps {
  /**
   * Execute a run action (e.g., row_count_diff, profile_diff).
   * @param type - The run type to execute
   * @param params - Parameters for the run
   * @param options - Options including showForm and trackProps
   */
  runAction?: (
    type: string,
    params: Record<string, unknown>,
    options: { showForm: boolean; trackProps: SubmitRunTrackProps },
  ) => void;

  /**
   * Navigate to a path in the application.
   * @param path - The path to navigate to (e.g., "/query")
   */
  onNavigate?: (path: string) => void;

  /**
   * Track analytics events.
   * @param event - The event type
   * @param props - Event properties
   */
  onTrack?: (
    event: ContextMenuTrackEvent,
    props: ExploreActionTrackProps | LineageSelectionTrackProps,
  ) => void;

  /**
   * Check if histogram diff is supported for a column type.
   * @param columnType - The column data type
   * @returns true if histogram diff is supported
   */
  supportsHistogramDiff?: (columnType: string) => boolean;

  /**
   * Get metadata for a run type (title, icon).
   * @param type - The run type
   * @returns Run type metadata or undefined
   */
  findByRunType?: (type: string) => RunTypeMetadata | undefined;

  /**
   * Set the SQL query in the query context.
   * @param query - The SQL query string
   */
  setSqlQuery?: (query: string) => void;

  /**
   * Set the primary keys in the query context.
   * @param keys - Array of primary key column names
   */
  setPrimaryKeys?: (keys: string[] | undefined) => void;

  /**
   * Get the primary key for a model.
   * @param modelName - The model name
   * @returns The primary key column name or undefined
   */
  getPrimaryKey?: (modelName: string) => string | undefined;

  /**
   * Wrapper component for disabled menu items (e.g., SetupConnectionPopover).
   * Rendered when mode is "metadata only".
   */
  DisabledItemWrapper?: React.ComponentType<{
    display: boolean;
    children: ReactNode;
  }>;
}

/**
 * Context menu view options passed from LineageViewContext
 */
export interface ContextMenuViewOptions {
  selectMode?: "selecting" | "action_result" | undefined;
  cll?: unknown;
  showColumnLevelLineage?: (params: CllInput) => Promise<void>;
  selectParentNodes?: (nodeId: string, degree?: number) => void;
  selectChildNodes?: (nodeId: string, degree?: number) => void;
  getNodeColumnSet?: (nodeId: string) => Set<string>;
}

/**
 * Feature toggles that affect context menu behavior
 */
export interface ContextMenuFeatureToggles {
  disableDatabaseQuery?: boolean;
  disableViewActionDropdown?: boolean;
  mode?: string;
}

/**
 * Server flags that affect context menu behavior
 */
export interface ContextMenuServerFlags {
  single_env_onboarding?: boolean;
}

/**
 * Props for the main LineageViewContextMenu component
 */
export interface LineageViewContextMenuProps {
  x: number;
  y: number;
  node?: LineageGraphNodes;
  isOpen: boolean;
  onClose: () => void;
  deps?: LineageViewContextMenuDeps;
  viewOptions?: ContextMenuViewOptions;
  featureToggles?: ContextMenuFeatureToggles;
  serverFlags?: ContextMenuServerFlags;
  noCatalogCurrent?: boolean;
  isActionAvailable?: (actionName: string) => boolean;
}

/**
 * Props for ModelNodeContextMenu
 */
export interface ModelNodeContextMenuProps {
  x: number;
  y: number;
  node?: LineageGraphNode;
  isOpen: boolean;
  onClose: () => void;
  deps?: LineageViewContextMenuDeps;
  viewOptions?: ContextMenuViewOptions;
  featureToggles?: ContextMenuFeatureToggles;
  serverFlags?: ContextMenuServerFlags;
  noCatalogCurrent?: boolean;
  isActionAvailable?: (actionName: string) => boolean;
}

/**
 * Props for ColumnNodeContextMenu
 */
export interface ColumnNodeContextMenuProps {
  x: number;
  y: number;
  node?: LineageGraphColumnNode;
  isOpen: boolean;
  onClose: () => void;
  deps?: LineageViewContextMenuDeps;
  featureToggles?: ContextMenuFeatureToggles;
  serverFlags?: ContextMenuServerFlags;
  isActionAvailable?: (actionName: string) => boolean;
}

// ============================================================================
// Internal Types
// ============================================================================

interface ContextMenuItem {
  label?: string;
  itemIcon?: ReactNode;
  action?: () => void;
  isDisabled?: boolean;
  isSeparator?: boolean;
}

interface ContextMenuProps {
  menuItems: ContextMenuItem[];
  open: boolean;
  onClose: () => void;
  x: number;
  y: number;
  featureToggles?: ContextMenuFeatureToggles;
  DisabledItemWrapper?: React.ComponentType<{
    display: boolean;
    children: ReactNode;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Explore action constants
 */
export const EXPLORE_ACTION = {
  ROW_COUNT: "row_count",
  ROW_COUNT_DIFF: "row_count_diff",
  PROFILE: "profile",
  PROFILE_DIFF: "profile_diff",
  VALUE_DIFF: "value_diff",
  HISTOGRAM_DIFF: "histogram_diff",
  TOP_K_DIFF: "top_k_diff",
} as const;

/**
 * Explore source constants
 */
export const EXPLORE_SOURCE = {
  LINEAGE_VIEW_CONTEXT_MENU: "lineage_view_context_menu",
} as const;

/**
 * Lineage selection action constants
 */
export const LINEAGE_SELECTION_ACTION = {
  SELECT_PARENT_NODES: "select_parent_nodes",
  SELECT_CHILD_NODES: "select_child_nodes",
  SELECT_ALL_UPSTREAM: "select_all_upstream",
  SELECT_ALL_DOWNSTREAM: "select_all_downstream",
} as const;

// ============================================================================
// Internal Components
// ============================================================================

/**
 * Base context menu component that renders the MUI Menu with items.
 */
const ContextMenu = ({
  menuItems,
  open,
  onClose,
  x,
  y,
  featureToggles,
  DisabledItemWrapper,
}: ContextMenuProps) => {
  // Default wrapper that just renders children
  const Wrapper =
    DisabledItemWrapper ??
    (({ children }: { children: ReactNode }) => <>{children}</>);
  const isMetadataOnlyMode = featureToggles?.mode === "metadata only";

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: y, left: x }}
      slotProps={{
        paper: {
          sx: { fontSize: "0.85rem", width: "250px" },
        },
      }}
    >
      {menuItems.length === 0 ? (
        <MenuItem disabled key="no action">
          No action available
        </MenuItem>
      ) : (
        menuItems.map(
          ({ isSeparator, label, isDisabled, action, itemIcon }) => {
            if (isSeparator) {
              return <Divider key={label} />;
            }

            const menuItem = (
              <MenuItem
                key={label}
                disabled={isDisabled}
                onClick={() => {
                  if (action) {
                    action();
                  }
                  onClose();
                }}
              >
                {itemIcon} {label}
              </MenuItem>
            );

            // Wrap disabled items with DisabledItemWrapper if provided
            if (isDisabled && DisabledItemWrapper) {
              return (
                <Wrapper display={isMetadataOnlyMode} key={label}>
                  {menuItem}
                </Wrapper>
              );
            }

            return menuItem;
          },
        )
      )}
    </Menu>
  );
};

// ============================================================================
// Public Components
// ============================================================================

/**
 * Context menu for model/node right-click actions.
 *
 * Shows menu items for:
 * - Show Impact Radius (for modified nodes)
 * - Query / Query Related Columns / Query Modified Columns
 * - Row Count / Row Count Diff
 * - Profile / Profile Diff
 * - Value Diff
 * - Select Parent/Child Nodes
 */
export const ModelNodeContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
  deps = {},
  viewOptions = {},
  featureToggles = {},
  serverFlags = {},
  noCatalogCurrent = false,
  isActionAvailable = () => true,
}: ModelNodeContextMenuProps) => {
  const menuItems: ContextMenuItem[] = [];

  const {
    runAction,
    onNavigate,
    onTrack,
    findByRunType,
    setSqlQuery,
    setPrimaryKeys,
    getPrimaryKey,
    DisabledItemWrapper,
  } = deps;

  const {
    selectMode,
    cll,
    showColumnLevelLineage,
    selectParentNodes,
    selectChildNodes,
    getNodeColumnSet,
  } = viewOptions;

  const singleEnv = serverFlags.single_env_onboarding ?? false;
  const isQueryDisabled = featureToggles.disableDatabaseQuery ?? false;

  if (!node?.data) {
    return <></>;
  }

  const modelNode = node.data;
  const resourceType = modelNode.resourceType;
  const columns = getNodeColumnSet ? Array.from(getNodeColumnSet(node.id)) : [];
  const trackProps: SubmitRunTrackProps = {
    source: "lineage_model_node",
  };
  const changeStatus = modelNode.changeStatus;
  const primaryKey = getPrimaryKey?.(modelNode.name);

  // Show Impact Radius for modified nodes
  if (changeStatus === "modified") {
    menuItems.push({
      label: "Show Impact Radius",
      itemIcon: <FaRegDotCircle />,
      isDisabled: noCatalogCurrent || !isActionAvailable("change_analysis"),
      action: () => {
        void showColumnLevelLineage?.({
          node_id: node.id,
          change_analysis: true,
          no_upstream: true,
        });
      },
    });
  }

  // Query actions for model/seed/snapshot resource types
  if (
    !selectMode &&
    resourceType &&
    ["model", "seed", "snapshot"].includes(resourceType)
  ) {
    if (menuItems.length > 0) {
      menuItems.push({
        label: "select group one",
        isSeparator: true,
      });
    }

    // Query action
    const queryRunType = singleEnv ? "query" : "query_diff";
    const queryRun = findByRunType?.(queryRunType);
    const baseColumns = Object.keys(modelNode.data.base?.columns ?? {});
    const currentColumns = Object.keys(modelNode.data.current?.columns ?? {});
    const formattedColumns = formatSelectColumns(baseColumns, currentColumns);
    let query = `select * from {{ ref("${modelNode.name}") }}`;
    if (formattedColumns.length) {
      query = `select \n  ${formattedColumns.join("\n  ")}\nfrom {{ ref("${modelNode.name}") }}`;
    }

    if (queryRun) {
      menuItems.push({
        label: "Query",
        itemIcon: (
          <Box component={queryRun.icon} sx={{ display: "inline-flex" }} />
        ),
        isDisabled: isQueryDisabled,
        action: () => {
          setSqlQuery?.(query);
          if (isActionAvailable("query_diff_with_primary_key")) {
            setPrimaryKeys?.(
              primaryKey !== undefined ? [primaryKey] : undefined,
            );
          }
          onNavigate?.("/query");
        },
      });
    }

    // Query Related Columns (when CLL is active)
    if (columns.length > 0 && queryRun) {
      if (cll !== undefined) {
        const allColumns = new Set<string>();
        if (primaryKey) {
          allColumns.add(primaryKey);
        }
        columns.forEach((column) => {
          allColumns.add(column);
        });

        menuItems.push({
          label: "Query Related Columns",
          itemIcon: (
            <Box component={queryRun.icon} sx={{ display: "inline-flex" }} />
          ),
          isDisabled: isQueryDisabled,
          action: () => {
            const relatedQuery = `select \n  ${Array.from(allColumns).join(",\n  ")}\nfrom {{ ref("${modelNode.name}") }}`;
            setSqlQuery?.(relatedQuery);
            if (isActionAvailable("query_diff_with_primary_key")) {
              setPrimaryKeys?.(
                primaryKey !== undefined ? [primaryKey] : undefined,
              );
            }
            onNavigate?.("/query");
          },
        });
      } else {
        // Query Modified Columns
        const changedColumns = Object.entries(modelNode.change?.columns ?? {})
          .filter(([, value]) => value === "modified")
          .map(([key]) => key);
        if (changedColumns.length > 0) {
          const allColumns = new Set<string>();
          if (primaryKey) {
            allColumns.add(primaryKey);
          }
          changedColumns.forEach((column) => {
            allColumns.add(column);
          });

          menuItems.push({
            label: "Query Modified Columns",
            itemIcon: (
              <Box component={queryRun.icon} sx={{ display: "inline-flex" }} />
            ),
            isDisabled: isQueryDisabled,
            action: () => {
              const modifiedQuery = `select \n  ${Array.from(allColumns).join(",\n  ")}\nfrom {{ ref("${modelNode.name}") }}`;
              setSqlQuery?.(modifiedQuery);
              if (isActionAvailable("query_diff_with_primary_key")) {
                setPrimaryKeys?.(
                  primaryKey !== undefined ? [primaryKey] : undefined,
                );
              }
              onNavigate?.("/query");
            },
          });
        }
      }
    }

    // Row Count / Row Count Diff
    const rowCountRunType = singleEnv ? "row_count" : "row_count_diff";
    const rowCountRun = findByRunType?.(rowCountRunType);
    if (rowCountRun) {
      menuItems.push({
        label: rowCountRun.title,
        itemIcon: (
          <Box component={rowCountRun.icon} sx={{ display: "inline-flex" }} />
        ),
        isDisabled: isQueryDisabled,
        action: () => {
          onTrack?.("explore_action", {
            action: singleEnv
              ? EXPLORE_ACTION.ROW_COUNT
              : EXPLORE_ACTION.ROW_COUNT_DIFF,
            source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
            node_count: 1,
          });
          runAction?.(
            rowCountRunType,
            { node_names: [modelNode.name] },
            { showForm: false, trackProps },
          );
        },
      });
    }

    // Profile / Profile Diff
    const profileRunType = singleEnv ? "profile" : "profile_diff";
    const profileRun = findByRunType?.(profileRunType);
    if (profileRun) {
      menuItems.push({
        label: profileRun.title,
        itemIcon: (
          <Box component={profileRun.icon} sx={{ display: "inline-flex" }} />
        ),
        isDisabled: isQueryDisabled,
        action: () => {
          const profileColumns = getNodeColumnSet
            ? Array.from(getNodeColumnSet(node.id))
            : [];
          onTrack?.("explore_action", {
            action: singleEnv
              ? EXPLORE_ACTION.PROFILE
              : EXPLORE_ACTION.PROFILE_DIFF,
            source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
            node_count: 1,
          });
          runAction?.(
            profileRunType,
            { model: modelNode.name, columns: profileColumns },
            { showForm: true, trackProps },
          );
        },
      });
    }

    // Value Diff (multi-env only)
    if (!singleEnv) {
      const valueDiffRun = findByRunType?.("value_diff");
      if (valueDiffRun) {
        menuItems.push({
          label: valueDiffRun.title,
          itemIcon: (
            <Box
              component={valueDiffRun.icon}
              sx={{ display: "inline-flex" }}
            />
          ),
          isDisabled: isQueryDisabled,
          action: () => {
            const valueDiffColumns = getNodeColumnSet
              ? Array.from(getNodeColumnSet(node.id))
              : [];
            onTrack?.("explore_action", {
              action: EXPLORE_ACTION.VALUE_DIFF,
              source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
              node_count: 1,
            });
            runAction?.(
              "value_diff",
              { model: modelNode.name, columns: valueDiffColumns },
              { showForm: true, trackProps },
            );
          },
        });
      }
    }
  }

  // Select Parent/Child Nodes (multi-env only)
  if (!singleEnv) {
    if (menuItems.length > 0) {
      menuItems.push({
        label: "select group two",
        isSeparator: true,
      });
    }
    menuItems.push({
      label: "Select Parent Nodes",
      itemIcon: <BiArrowFromBottom />,
      action: () => {
        onTrack?.("lineage_selection", {
          action: LINEAGE_SELECTION_ACTION.SELECT_PARENT_NODES,
        });
        selectParentNodes?.(node.id, 1);
      },
    });
    menuItems.push({
      label: "Select Child Nodes",
      itemIcon: <BiArrowToBottom />,
      action: () => {
        onTrack?.("lineage_selection", {
          action: LINEAGE_SELECTION_ACTION.SELECT_CHILD_NODES,
        });
        selectChildNodes?.(node.id, 1);
      },
    });
    menuItems.push({
      label: "Select All Upstream Nodes",
      itemIcon: <BiArrowFromBottom />,
      action: () => {
        onTrack?.("lineage_selection", {
          action: LINEAGE_SELECTION_ACTION.SELECT_ALL_UPSTREAM,
        });
        selectParentNodes?.(node.id);
      },
    });
    menuItems.push({
      label: "Select All Downstream Nodes",
      itemIcon: <BiArrowToBottom />,
      action: () => {
        onTrack?.("lineage_selection", {
          action: LINEAGE_SELECTION_ACTION.SELECT_ALL_DOWNSTREAM,
        });
        selectChildNodes?.(node.id);
      },
    });
  }

  return (
    <ContextMenu
      x={x}
      y={y}
      menuItems={menuItems}
      open={isOpen}
      onClose={onClose}
      featureToggles={featureToggles}
      DisabledItemWrapper={DisabledItemWrapper}
    />
  );
};

/**
 * Context menu for column node right-click actions.
 *
 * Shows menu items for:
 * - Profile / Profile Diff
 * - Histogram Diff
 * - Top-K Diff
 * - Value Diff
 */
export const ColumnNodeContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
  deps = {},
  featureToggles = {},
  serverFlags = {},
  isActionAvailable = () => true,
}: ColumnNodeContextMenuProps) => {
  const menuItems: ContextMenuItem[] = [];

  const {
    runAction,
    onTrack,
    findByRunType,
    supportsHistogramDiff: checkHistogramSupport,
    DisabledItemWrapper,
  } = deps;

  const singleEnv = serverFlags.single_env_onboarding ?? false;
  const isQueryDisabled = featureToggles.disableDatabaseQuery ?? false;

  if (node?.data === undefined) {
    return <></>;
  }

  const columnNode = node.data;
  const modelNode = columnNode.node;
  const column = columnNode.column;
  const columnType = columnNode.type;
  const trackProps: SubmitRunTrackProps = {
    source: "lineage_column_node",
  };

  const handleProfileDiff = () => {
    onTrack?.("explore_action", {
      action: EXPLORE_ACTION.PROFILE_DIFF,
      source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
      node_count: 1,
    });
    runAction?.(
      "profile_diff",
      { model: modelNode.name, columns: [column] },
      { showForm: false, trackProps },
    );
  };

  const handleHistogramDiff = () => {
    onTrack?.("explore_action", {
      action: EXPLORE_ACTION.HISTOGRAM_DIFF,
      source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
      node_count: 1,
    });
    runAction?.(
      "histogram_diff",
      { model: modelNode.name, column_name: column, column_type: columnType },
      { showForm: false, trackProps },
    );
  };

  const handleTopkDiff = () => {
    onTrack?.("explore_action", {
      action: EXPLORE_ACTION.TOP_K_DIFF,
      source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
      node_count: 1,
    });
    runAction?.(
      "top_k_diff",
      { model: modelNode.name, column_name: column, k: 50 },
      { showForm: false, trackProps },
    );
  };

  const handleValueDiff = () => {
    onTrack?.("explore_action", {
      action: EXPLORE_ACTION.VALUE_DIFF,
      source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
      node_count: 1,
    });
    runAction?.(
      "value_diff",
      { model: modelNode.name, columns: [column] },
      { showForm: true, trackProps },
    );
  };

  const addedOrRemoved =
    modelNode.data.base?.columns?.[column] === undefined ||
    modelNode.data.current?.columns?.[column] === undefined;

  // Profile / Profile Diff
  const profileRunType = singleEnv ? "profile" : "profile_diff";
  const profileRun = findByRunType?.(profileRunType);
  if (profileRun) {
    menuItems.push({
      label: profileRun.title,
      itemIcon: (
        <Box component={profileRun.icon} sx={{ display: "inline-flex" }} />
      ),
      action: handleProfileDiff,
      isDisabled:
        addedOrRemoved || !isActionAvailable("profile_diff") || isQueryDisabled,
    });
  }

  // Histogram Diff, Top-K Diff, Value Diff (multi-env only)
  if (!singleEnv) {
    const histogramRun = findByRunType?.("histogram_diff");
    if (histogramRun) {
      const histogramSupported = checkHistogramSupport?.(columnType) ?? true;
      menuItems.push({
        label: histogramRun.title,
        itemIcon: (
          <Box component={histogramRun.icon} sx={{ display: "inline-flex" }} />
        ),
        action: handleHistogramDiff,
        isDisabled: addedOrRemoved || !histogramSupported || isQueryDisabled,
      });
    }

    const topKRun = findByRunType?.("top_k_diff");
    if (topKRun) {
      menuItems.push({
        label: topKRun.title,
        itemIcon: (
          <Box component={topKRun.icon} sx={{ display: "inline-flex" }} />
        ),
        action: handleTopkDiff,
        isDisabled: addedOrRemoved || isQueryDisabled,
      });
    }

    const valueDiffRun = findByRunType?.("value_diff");
    if (valueDiffRun) {
      menuItems.push({
        label: valueDiffRun.title,
        itemIcon: (
          <Box component={valueDiffRun.icon} sx={{ display: "inline-flex" }} />
        ),
        action: handleValueDiff,
        isDisabled: addedOrRemoved || isQueryDisabled,
      });
    }
  }

  return (
    <ContextMenu
      x={x}
      y={y}
      menuItems={menuItems}
      open={isOpen}
      onClose={onClose}
      featureToggles={featureToggles}
      DisabledItemWrapper={DisabledItemWrapper}
    />
  );
};

/**
 * Main context menu component that delegates to ModelNodeContextMenu
 * or ColumnNodeContextMenu based on node type.
 *
 * @example
 * ```tsx
 * <LineageViewContextMenu
 *   x={event.clientX}
 *   y={event.clientY}
 *   node={selectedNode}
 *   isOpen={menuOpen}
 *   onClose={() => setMenuOpen(false)}
 *   deps={contextMenuDeps}
 *   viewOptions={lineageViewOptions}
 *   featureToggles={featureToggles}
 *   serverFlags={serverFlags}
 *   noCatalogCurrent={!catalog?.current}
 *   isActionAvailable={isActionAvailable}
 * />
 * ```
 */
export const LineageViewContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
  deps = {},
  viewOptions = {},
  featureToggles = {},
  serverFlags = {},
  noCatalogCurrent = false,
  isActionAvailable = () => true,
}: LineageViewContextMenuProps) => {
  if (featureToggles.disableViewActionDropdown) {
    return (
      <ContextMenu
        menuItems={[]}
        open={isOpen}
        onClose={onClose}
        x={x}
        y={y}
        featureToggles={featureToggles}
        DisabledItemWrapper={deps.DisabledItemWrapper}
      />
    );
  }

  if (node && isLineageGraphNode(node)) {
    return (
      <ModelNodeContextMenu
        x={x}
        y={y}
        isOpen={isOpen}
        onClose={onClose}
        node={node}
        deps={deps}
        viewOptions={viewOptions}
        featureToggles={featureToggles}
        serverFlags={serverFlags}
        noCatalogCurrent={noCatalogCurrent}
        isActionAvailable={isActionAvailable}
      />
    );
  }

  if (node && isLineageGraphColumnNode(node)) {
    return (
      <ColumnNodeContextMenu
        x={x}
        y={y}
        isOpen={isOpen}
        onClose={onClose}
        node={node}
        deps={deps}
        featureToggles={featureToggles}
        serverFlags={serverFlags}
        isActionAvailable={isActionAvailable}
      />
    );
  }

  return null;
};

/**
 * Hook to manage context menu state.
 * Returns props for LineageViewContextMenu and methods to show/close the menu.
 *
 * @example
 * ```tsx
 * const { props, showContextMenu, closeContextMenu } = useLineageViewContextMenu();
 *
 * const handleNodeContextMenu = (event: React.MouseEvent, node: LineageGraphNodes) => {
 *   event.preventDefault();
 *   showContextMenu(event.clientX, event.clientY, node);
 * };
 *
 * return (
 *   <>
 *     <LineageCanvas onNodeContextMenu={handleNodeContextMenu} />
 *     <LineageViewContextMenu {...props} deps={deps} />
 *   </>
 * );
 * ```
 */
export const useLineageViewContextMenu = () => {
  const [open, setOpen] = useState(false);
  const onOpen = () => setOpen(true);
  const onClose = () => setOpen(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [node, setNode] = useState<LineageGraphNodes>();

  const showContextMenu = (x: number, y: number, node: LineageGraphNodes) => {
    setPosition({ x, y });
    setNode(node);
    onOpen();
  };

  const closeContextMenu = () => {
    setPosition({ x: 0, y: 0 });
    setNode(undefined);
    onClose();
  };

  const props: Pick<
    LineageViewContextMenuProps,
    "x" | "y" | "node" | "isOpen" | "onClose"
  > = {
    x: position.x,
    y: position.y,
    node,
    isOpen: open,
    onClose,
  };

  return {
    props,
    showContextMenu,
    closeContextMenu,
  };
};
