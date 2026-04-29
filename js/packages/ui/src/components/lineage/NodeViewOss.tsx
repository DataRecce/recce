"use client";

/**
 * @file NodeViewOss.tsx
 * @description wrapper for NodeView that injects dependencies.
 *
 * This wrapper:
 * 1. Provides OSS-specific schema view components
 * 2. Injects action callbacks that integrate with OSS contexts
 * 3. Provides run type icons from the OSS registry
 * 4. Handles navigation and tracking
 */

import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { getModelInfo, type LineageGraphNode } from "../..";
import { createSchemaDiffCheck } from "../../api";
import {
  useLineageGraphContext,
  useRecceActionContext,
  useRecceInstanceContext,
  useRouteConfig,
} from "../../contexts";
import {
  useApiConfig,
  useModelColumns,
  useRecceQueryContext,
} from "../../hooks";
import {
  EXPLORE_ACTION,
  EXPLORE_SOURCE,
  trackExploreAction,
  trackPreviewChange,
} from "../../lib/api/track";
import { formatSelectColumns } from "../../utils";
import { SetupConnectionPopover } from "../app";
import { LearnHowLink, RecceNotification } from "../onboarding-guide";
import { findByRunType } from "../run";
import { SchemaView, SingleEnvSchemaView } from "../schema";
import { LineageTabContent } from "./LineageTabContent";
import { NodeSqlViewOss } from "./NodeSqlViewOss";
import { RowCountDiffTag, RowCountTag } from "./NodeTag";
import {
  NodeView as BaseNodeView,
  type NodeViewActionCallbacks,
  type RunTypeIconMap,
} from "./NodeView";
import { SandboxViewOss } from "./SandboxViewOss";
import { NodeTag } from "./tags";

// =============================================================================
// TYPES
// =============================================================================

interface NodeViewProps {
  node: LineageGraphNode;
  onCloseNode: () => void;
  /** Navigate to another node: refocus the panel (canvas is not re-centered). */
  onNavigateToNode?: (nodeId: string) => void;
  /** Return to the previously focused node. Omit to hide the back button. */
  onBack?: () => void;
  /** Pan/zoom the lineage canvas onto the currently focused node. */
  onCenterFocused?: () => void;
  /** Stack of previously focused node ids, oldest first. */
  historyTrail?: string[];
  /** Jump to an entry in the history (breadcrumb click). */
  onJumpToHistory?: (index: number) => void;
}

const ResourceTypeTag = ({ node }: { node: LineageGraphNode }) => {
  return (
    <NodeTag
      resourceType={node.data.resourceType}
      materialized={node.data.materialized}
    />
  );
};

// =============================================================================
// OSS-SPECIFIC WRAPPER COMPONENTS
// =============================================================================

/**
 * Notification component that includes the LearnHowLink.
 */
function OssNotificationComponent({ onClose }: { onClose: () => void }) {
  return (
    <RecceNotification onClose={onClose} align="flex-start">
      <Typography variant="body2">
        Enable the Recce Checklist and start adding checks for better data
        validation and review.
        <br />
        <LearnHowLink />
      </Typography>
    </RecceNotification>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * OSS wrapper for NodeView that injects OSS-specific dependencies.
 *
 * This wrapper provides:
 * - OSS-specific schema view components
 * - Action callbacks that integrate with OSS contexts (tracking, navigation)
 * - Run type icons from the OSS registry
 * - Connection popover wrapper for database setup prompts
 * - Sandbox dialog component
 */
export function NodeViewOss({
  node,
  onCloseNode,
  onNavigateToNode,
  onBack,
  onCenterFocused,
  historyTrail,
  onJumpToHistory,
}: NodeViewProps) {
  const router = useRouter();
  const { runAction } = useRecceActionContext();
  const { isActionAvailable, envInfo, lineageGraph } = useLineageGraphContext();
  const { singleEnv: isSingleEnvOnboarding, featureToggles } =
    useRecceInstanceContext();
  const { setSqlQuery, setPrimaryKeys } = useRecceQueryContext();
  const { primaryKey } = useModelColumns(node.data.name);
  const { apiClient } = useApiConfig();
  const { basePath } = useRouteConfig();

  // Fetch model detail (columns, raw_code, primary_key) on demand
  const { data: modelDetailData } = useQuery({
    queryKey: ["modelDetail", node.id],
    queryFn: () => getModelInfo(node.id, apiClient),
    enabled: !!apiClient,
    staleTime: 5 * 60 * 1000,
  });
  const modelDetail = modelDetailData?.model;

  // Build run type icons map from OSS registry
  const runTypeIcons: RunTypeIconMap = useMemo(
    () => ({
      query: findByRunType("query").icon,
      row_count: findByRunType("row_count").icon,
      row_count_diff: findByRunType("row_count_diff").icon,
      profile: findByRunType("profile").icon,
      profile_diff: findByRunType("profile_diff").icon,
      query_diff: findByRunType("query_diff").icon,
      value_diff: findByRunType("value_diff").icon,
      top_k_diff: findByRunType("top_k_diff").icon,
      histogram_diff: findByRunType("histogram_diff").icon,
      schema_diff: findByRunType("schema_diff").icon,
      sandbox: findByRunType("sandbox").icon,
    }),
    [],
  );

  // Build query string for this node
  const baseColumns = Object.keys(modelDetail?.base?.columns ?? {});
  const currentColumns = Object.keys(modelDetail?.current?.columns ?? {});
  const formattedColumns = formatSelectColumns(baseColumns, currentColumns);
  const query = useMemo(() => {
    if (formattedColumns.length) {
      return `select \n  ${formattedColumns.join("\n  ")}\nfrom {{ ref("${node.data.name}") }}`;
    }
    return `select * from {{ ref("${node.data.name}") }}`;
  }, [formattedColumns, node.data.name]);

  // Action callbacks for the base component
  const actionCallbacks: NodeViewActionCallbacks = useMemo(
    () => ({
      onQueryClick: () => {
        if (envInfo?.adapterType === "dbt") {
          setSqlQuery(query);
        } else if (envInfo?.adapterType === "sqlmesh") {
          setSqlQuery(`select * from ${node.data.name}`);
        }
        router.push(`${basePath}/query`);
      },

      onRowCountClick: () => {
        trackExploreAction({
          action: EXPLORE_ACTION.ROW_COUNT,
          source: EXPLORE_SOURCE.SCHEMA_ROW_COUNT_BUTTON,
          node_count: 1,
        });
        runAction(
          "row_count",
          { node_names: [node.data.name] },
          { showForm: false, showLast: false },
        );
      },

      onRowCountDiffClick: () => {
        trackExploreAction({
          action: EXPLORE_ACTION.ROW_COUNT_DIFF,
          source: EXPLORE_SOURCE.SCHEMA_ROW_COUNT_BUTTON,
          node_count: 1,
        });
        runAction(
          "row_count_diff",
          { node_names: [node.data.name] },
          { showForm: false, showLast: false },
        );
      },

      onProfileClick: () => {
        trackExploreAction({
          action: EXPLORE_ACTION.PROFILE,
          source: EXPLORE_SOURCE.NODE_SIDEBAR_SINGLE_ENV,
          node_count: 1,
        });
        runAction(
          "profile",
          { model: node.data.name },
          { showForm: true, showLast: false },
        );
      },

      onProfileDiffClick: () => {
        trackExploreAction({
          action: EXPLORE_ACTION.PROFILE_DIFF,
          source: EXPLORE_SOURCE.NODE_SIDEBAR_MULTI_ENV,
          node_count: 1,
        });
        runAction(
          "profile_diff",
          { model: node.data.name },
          { showForm: true, showLast: false },
        );
      },

      onQueryDiffClick: () => {
        if (envInfo?.adapterType === "dbt") {
          setSqlQuery(query);
        } else if (envInfo?.adapterType === "sqlmesh") {
          setSqlQuery(`select * from ${node.data.name}`);
        }
        if (isActionAvailable("query_diff_with_primary_key")) {
          setPrimaryKeys(primaryKey !== undefined ? [primaryKey] : undefined);
        }
        router.push(`${basePath}/query`);
      },

      onValueDiffClick: () => {
        trackExploreAction({
          action: EXPLORE_ACTION.VALUE_DIFF,
          source: EXPLORE_SOURCE.NODE_SIDEBAR_MULTI_ENV,
          node_count: 1,
        });
        runAction(
          "value_diff",
          { model: node.data.name },
          { showForm: true, showLast: false },
        );
      },

      onTopKDiffClick: () => {
        trackExploreAction({
          action: EXPLORE_ACTION.TOP_K_DIFF,
          source: EXPLORE_SOURCE.NODE_SIDEBAR_MULTI_ENV,
          node_count: 1,
        });
        runAction(
          "top_k_diff",
          { model: node.data.name, column_name: "", k: 50 },
          { showForm: true },
        );
      },

      onHistogramDiffClick: () => {
        trackExploreAction({
          action: EXPLORE_ACTION.HISTOGRAM_DIFF,
          source: EXPLORE_SOURCE.NODE_SIDEBAR_MULTI_ENV,
          node_count: 1,
        });
        runAction(
          "histogram_diff",
          { model: node.data.name, column_name: "", column_type: "" },
          { showForm: true },
        );
      },

      onAddSchemaDiffClick: async () => {
        const check = await createSchemaDiffCheck(
          { node_id: node.id },
          apiClient,
        );
        router.push(`${basePath}/checks/?id=${check.check_id}`);
      },

      onSandboxClick: () => {
        if (isActionAvailable("query_diff_with_primary_key")) {
          setPrimaryKeys(primaryKey !== undefined ? [primaryKey] : undefined);
        }
        trackPreviewChange({
          action: "explore",
          node: node.data.name,
        });
      },
    }),
    [
      node,
      query,
      envInfo,
      setSqlQuery,
      runAction,
      isActionAvailable,
      setPrimaryKeys,
      primaryKey,
      apiClient,
      router.push,
      basePath,
    ],
  );

  return (
    <BaseNodeView
      node={node}
      onCloseNode={onCloseNode}
      isSingleEnv={isSingleEnvOnboarding ?? false}
      featureToggles={featureToggles}
      modelDetail={(() => {
        if (!modelDetail) return undefined;
        const hasBase =
          !!modelDetail.base && Object.keys(modelDetail.base).length > 0;
        const hasCurrent =
          !!modelDetail.current && Object.keys(modelDetail.current).length > 0;
        if (!hasBase && !hasCurrent) return undefined;
        return {
          base: hasBase
            ? {
                id: node.id,
                unique_id: node.id,
                name: node.data.name,
                resource_type: node.data.resourceType,
                package_name: node.data.packageName,
                ...modelDetail.base,
              }
            : undefined,
          current: hasCurrent
            ? {
                id: node.id,
                unique_id: node.id,
                name: node.data.name,
                resource_type: node.data.resourceType,
                package_name: node.data.packageName,
                ...modelDetail.current,
              }
            : undefined,
        };
      })()}
      // Schema components
      SchemaView={SchemaView}
      SingleEnvSchemaView={SingleEnvSchemaView}
      NodeSqlView={NodeSqlViewOss}
      // Tag components
      ResourceTypeTag={ResourceTypeTag}
      RowCountDiffTag={RowCountDiffTag}
      RowCountTag={RowCountTag}
      // Notification for single env
      NotificationComponent={OssNotificationComponent}
      // Connection popover wrapper
      ConnectionPopoverWrapper={SetupConnectionPopover}
      // Sandbox dialog
      SandboxDialog={SandboxViewOss}
      // Icons
      runTypeIcons={runTypeIcons}
      // Callbacks
      actionCallbacks={actionCallbacks}
      isActionAvailable={isActionAvailable}
      lineageTabContent={
        onNavigateToNode ? (
          <LineageTabContent
            node={node}
            nodesById={lineageGraph?.nodes}
            onNavigate={onNavigateToNode}
            onBack={onBack}
            onCenterFocus={onCenterFocused}
            historyTrail={historyTrail}
            onJumpToHistory={onJumpToHistory}
          />
        ) : undefined
      }
    />
  );
}
