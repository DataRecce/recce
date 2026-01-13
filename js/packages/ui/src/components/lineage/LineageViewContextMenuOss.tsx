"use client";

/**
 * @file LineageViewContextMenuOss.tsx
 * @description Thin wrapper that imports from @datarecce/ui and injects OSS-specific implementations.
 *
 * This file serves as the integration layer between the @datarecce/ui library and the OSS application.
 * It injects:
 * - Amplitude analytics tracking
 * - Application routing
 * - Query context management
 * - Run type registry
 * - Histogram diff support checking
 */

import { useRouter } from "next/navigation";
import type {
  LineageGraphColumnNode,
  LineageGraphNode,
  LineageGraphNodes,
} from "../..";
import {
  useLineageGraphContext,
  useLineageViewContextSafe,
  useRecceActionContext,
  useRecceInstanceContext,
  useRecceServerFlag,
} from "../../contexts";
import { useModelColumns, useRecceQueryContext } from "../../hooks";
import { trackExploreAction, trackLineageSelection } from "../../lib/api/track";
import { SetupConnectionPopover } from "../app";
import { supportsHistogramDiff } from "../histogram";
import { findByRunType } from "../run";
import {
  ColumnNodeContextMenu as BaseColumnNodeContextMenu,
  LineageViewContextMenu as BaseLineageViewContextMenu,
  ModelNodeContextMenu as BaseModelNodeContextMenu,
  useLineageViewContextMenu as baseUseLineageViewContextMenu,
  EXPLORE_ACTION,
  EXPLORE_SOURCE,
  LINEAGE_SELECTION_ACTION,
  type LineageViewContextMenuDeps,
} from "./contextmenu";

// ============================================================================
// Types
// ============================================================================

interface LineageViewContextMenuProps<T> {
  x: number;
  y: number;
  node?: T;
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Internal Hooks
// ============================================================================

/**
 * Hook to create the dependency injection props for context menu components.
 * Wires up OSS-specific implementations for tracking, navigation, etc.
 */
const useContextMenuDeps = (modelName?: string): LineageViewContextMenuDeps => {
  const { runAction } = useRecceActionContext();
  const { setSqlQuery, setPrimaryKeys } = useRecceQueryContext();
  const router = useRouter();
  const { primaryKey } = useModelColumns(modelName);

  return {
    runAction: (type, params, options) => {
      runAction(type, params as Parameters<typeof runAction>[1], options);
    },
    onNavigate: (path) => {
      router.push(path);
    },
    onTrack: (event, props) => {
      if (event === "explore_action") {
        trackExploreAction({
          action: (props as { action: string })
            .action as (typeof EXPLORE_ACTION)[keyof typeof EXPLORE_ACTION],
          source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
          node_count: (props as { node_count: number }).node_count,
        });
      } else if (event === "lineage_selection") {
        trackLineageSelection({
          action: (props as { action: string })
            .action as (typeof LINEAGE_SELECTION_ACTION)[keyof typeof LINEAGE_SELECTION_ACTION],
        });
      }
    },
    supportsHistogramDiff,
    findByRunType: (type) => {
      const entry = findByRunType(type as Parameters<typeof findByRunType>[0]);
      return entry ? { title: entry.title, icon: entry.icon } : undefined;
    },
    setSqlQuery,
    setPrimaryKeys,
    getPrimaryKey: () => primaryKey,
    // Note: SetupConnectionPopover has a more restrictive children type (ReactElement vs ReactNode)
    // but it works correctly in practice since we always pass MenuItem elements
    DisabledItemWrapper:
      SetupConnectionPopover as LineageViewContextMenuDeps["DisabledItemWrapper"],
  };
};

// ============================================================================
// Exported Components
// ============================================================================

/**
 * OSS wrapper for ModelNodeContextMenu.
 * Injects OSS-specific dependencies and context.
 */
export const ModelNodeContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
}: LineageViewContextMenuProps<LineageGraphNode>) => {
  const {
    selectParentNodes,
    selectChildNodes,
    getNodeColumnSet,
    selectMode,
    cll,
    showColumnLevelLineage,
  } = useLineageViewContextSafe();
  const { featureToggles } = useRecceInstanceContext();
  const { isActionAvailable, lineageGraph } = useLineageGraphContext();
  const { data: flag } = useRecceServerFlag();
  const noCatalogCurrent = !lineageGraph?.catalogMetadata.current;

  const deps = useContextMenuDeps(node?.data?.name);

  return (
    <BaseModelNodeContextMenu
      x={x}
      y={y}
      node={node}
      isOpen={isOpen}
      onClose={onClose}
      deps={deps}
      viewOptions={{
        selectMode,
        cll,
        showColumnLevelLineage,
        selectParentNodes,
        selectChildNodes,
        getNodeColumnSet,
      }}
      featureToggles={{
        disableDatabaseQuery: featureToggles.disableDatabaseQuery,
        mode: featureToggles.mode ?? undefined,
      }}
      serverFlags={{
        single_env_onboarding: flag?.single_env_onboarding,
      }}
      noCatalogCurrent={noCatalogCurrent}
      isActionAvailable={isActionAvailable}
    />
  );
};

/**
 * OSS wrapper for ColumnNodeContextMenu.
 * Injects OSS-specific dependencies and context.
 */
export const ColumnNodeContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
}: LineageViewContextMenuProps<LineageGraphColumnNode>) => {
  const { featureToggles } = useRecceInstanceContext();
  const { isActionAvailable } = useLineageGraphContext();
  const { data: flag } = useRecceServerFlag();

  const deps = useContextMenuDeps(node?.data?.node?.name);

  return (
    <BaseColumnNodeContextMenu
      x={x}
      y={y}
      node={node}
      isOpen={isOpen}
      onClose={onClose}
      deps={deps}
      featureToggles={{
        disableDatabaseQuery: featureToggles.disableDatabaseQuery,
        mode: featureToggles.mode ?? undefined,
      }}
      serverFlags={{
        single_env_onboarding: flag?.single_env_onboarding,
      }}
      isActionAvailable={isActionAvailable}
    />
  );
};

/**
 * OSS wrapper for LineageViewContextMenu.
 * Injects OSS-specific dependencies and context.
 */
export const LineageViewContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
}: LineageViewContextMenuProps<LineageGraphNodes>) => {
  const {
    selectParentNodes,
    selectChildNodes,
    getNodeColumnSet,
    selectMode,
    cll,
    showColumnLevelLineage,
  } = useLineageViewContextSafe();
  const { featureToggles } = useRecceInstanceContext();
  const { isActionAvailable, lineageGraph } = useLineageGraphContext();
  const { data: flag } = useRecceServerFlag();
  const noCatalogCurrent = !lineageGraph?.catalogMetadata.current;

  // Get model name from either model node or column node
  const modelName =
    node?.type === "lineageGraphNode"
      ? (node as LineageGraphNode).data?.name
      : node?.type === "lineageGraphColumnNode"
        ? (node as LineageGraphColumnNode).data?.node?.name
        : undefined;

  const deps = useContextMenuDeps(modelName);

  return (
    <BaseLineageViewContextMenu
      x={x}
      y={y}
      node={node}
      isOpen={isOpen}
      onClose={onClose}
      deps={deps}
      viewOptions={{
        selectMode,
        cll,
        showColumnLevelLineage,
        selectParentNodes,
        selectChildNodes,
        getNodeColumnSet,
      }}
      featureToggles={{
        disableDatabaseQuery: featureToggles.disableDatabaseQuery,
        disableViewActionDropdown: featureToggles.disableViewActionDropdown,
        mode: featureToggles.mode ?? undefined,
      }}
      serverFlags={{
        single_env_onboarding: flag?.single_env_onboarding,
      }}
      noCatalogCurrent={noCatalogCurrent}
      isActionAvailable={isActionAvailable}
    />
  );
};

/**
 * Re-export the hook from @datarecce/ui.
 * This hook doesn't need any OSS-specific modifications.
 */
export const useLineageViewContextMenu = baseUseLineageViewContextMenu;
