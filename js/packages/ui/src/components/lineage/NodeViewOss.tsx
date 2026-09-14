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
import { useCallback, useMemo } from "react";
import { getModelInfo, type LineageGraphNode } from "../..";
import {
  cacheKeys,
  createSchemaDiffCheck,
  listRuns,
  type RowCount,
  type RowCountDiff,
  type Run,
} from "../../api";
import {
  useLineageGraphContext,
  useLineageViewContext,
  useRecceActionContext,
  useRecceInstanceContext,
  useRouteConfig,
} from "../../contexts";
import type { NodeDetailsOpenRequest } from "../../contexts/lineage/types";
import {
  useApiConfig,
  useModelColumns,
  useRecceQueryContext,
} from "../../hooks";
import {
  EXPLORE_ACTION,
  EXPLORE_SOURCE,
  trackExploreAction,
} from "../../lib/api/track";
import { formatSelectColumns } from "../../utils";
import { SetupConnectionPopover } from "../app";
import { LearnHowLink, RecceNotification } from "../onboarding-guide";
import { findByRunType } from "../run";
import { SchemaView, SingleEnvSchemaView } from "../schema";
import { computeLineageTabImpactSets } from "./computeLineageTabImpactSets";
import { LineageTabContent } from "./LineageTabContent";
import { NodeSqlViewOss } from "./NodeSqlViewOss";
import { RowCountSummary } from "./NodeTag";
import {
  type AnalysisRunType,
  NodeView as BaseNodeView,
  type NodeViewActionCallbacks,
  type RecentAnalysisRun,
  type RunTypeIconMap,
} from "./NodeView";
import { NodeTag } from "./tags";
import { pickWholeModelFlags } from "./wholeModelTreatment";

// =============================================================================
// TYPES
// =============================================================================

interface NodeViewProps {
  node: LineageGraphNode;
  onCloseNode: () => void;
  /** Explicit, repeatable request to select a detail-panel view. */
  openRequest?: NodeDetailsOpenRequest;
  /** Acknowledge that an explicit detail-panel request was applied. */
  onOpenRequestConsumed?: (requestToken: number) => void;
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

const ANALYSIS_RUN_TYPES = new Set<AnalysisRunType>([
  "profile_diff",
  "value_diff",
  "top_k_diff",
  "histogram_diff",
]);

function isAnalysisRun(
  run: Run,
): run is Extract<Run, { type: AnalysisRunType }> {
  return ANALYSIS_RUN_TYPES.has(run.type as AnalysisRunType);
}

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
 */
export function NodeViewOss({
  node,
  onCloseNode,
  openRequest,
  onOpenRequestConsumed,
  onNavigateToNode,
  onBack,
  onCenterFocused,
  historyTrail,
  onJumpToHistory,
}: NodeViewProps) {
  const router = useRouter();
  const { runAction, showRunId } = useRecceActionContext();
  const { isActionAvailable, envInfo, lineageGraph } = useLineageGraphContext();
  // Optional: undefined in tests/Storybook that mount NodeView without LineageView.
  const lineageViewCtx = useLineageViewContext();
  const { impactingNodeIds, impactedNodeIds } = useMemo(
    () => computeLineageTabImpactSets(lineageViewCtx?.cll),
    [lineageViewCtx?.cll],
  );
  const { singleEnv: isSingleEnvOnboarding, featureToggles } =
    useRecceInstanceContext();
  const { setSqlQuery, setPrimaryKeys } = useRecceQueryContext();
  const { primaryKey } = useModelColumns(node.data.name);
  const { apiClient } = useApiConfig();
  const { basePath } = useRouteConfig();
  const { runsAggregated } = useLineageGraphContext();
  const isSingleEnv = isSingleEnvOnboarding ?? false;
  const supportsDiffAnalysis =
    !isSingleEnv &&
    (node.data.resourceType === "model" ||
      node.data.resourceType === "seed" ||
      node.data.resourceType === "snapshot");

  const rowCountDisplay = useMemo(() => {
    const aggregated = runsAggregated?.[node.id];
    const rc = isSingleEnv
      ? (aggregated?.row_count?.result as RowCount | undefined)
      : (aggregated?.row_count_diff?.result as RowCountDiff | undefined);
    return rc ? <RowCountSummary rowCount={rc} /> : undefined;
  }, [runsAggregated, node.id, isSingleEnv]);

  // Fetch model detail (columns, raw_code, primary_key) on demand
  const { data: modelDetailData } = useQuery({
    queryKey: ["modelDetail", node.id],
    queryFn: () => getModelInfo(node.id, apiClient),
    enabled: !!apiClient,
    staleTime: 5 * 60 * 1000,
  });
  const modelDetail = modelDetailData?.model;

  const { data: runs } = useQuery({
    queryKey: cacheKeys.runs(),
    queryFn: () => listRuns(apiClient),
    enabled: supportsDiffAnalysis && !!apiClient,
    retry: false,
  });

  const recentAnalysisRuns = useMemo<RecentAnalysisRun[]>(() => {
    return (runs ?? [])
      .filter(isAnalysisRun)
      .filter(
        (run) =>
          run.status !== "Running" && run.params?.model === node.data.name,
      )
      .sort(
        (a, b) => new Date(b.run_at).getTime() - new Date(a.run_at).getTime(),
      )
      .map((run) => {
        const params = run.params;
        return {
          id: run.run_id,
          type: run.type,
          runAt: run.run_at,
          columnName:
            params != null &&
            "column_name" in params &&
            typeof params.column_name === "string"
              ? params.column_name
              : undefined,
        };
      });
  }, [runs, node.data.name]);

  const handleViewAnalysisRun = useCallback(
    (runId: string) => showRunId(runId, false),
    [showRunId],
  );

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
          {
            showForm: true,
            submitOnSelection: true,
            trackProps: { source: "lineage_model_node" },
          },
        );
      },

      onAddSchemaDiffClick: async () => {
        const check = await createSchemaDiffCheck(
          { node_id: node.id },
          apiClient,
        );
        router.push(`${basePath}/checks/?id=${check.check_id}`);
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

  const wholeModelFlags = lineageViewCtx
    ? pickWholeModelFlags(node.id, lineageViewCtx)
    : { isWholeModelChanged: false, isWholeModelImpacted: false };

  return (
    <BaseNodeView
      node={node}
      onCloseNode={onCloseNode}
      openRequest={openRequest}
      onOpenRequestConsumed={onOpenRequestConsumed}
      isSingleEnv={isSingleEnv}
      featureToggles={featureToggles}
      isWholeModelChanged={wholeModelFlags.isWholeModelChanged}
      isWholeModelImpacted={wholeModelFlags.isWholeModelImpacted}
      newCllExperience={lineageViewCtx?.newCllExperience ?? false}
      isImpacted={impactedNodeIds?.has(node.id) ?? false}
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
      // Row count text rendered inline on the Row Count button
      rowCountDisplay={rowCountDisplay}
      recentAnalysisRuns={recentAnalysisRuns}
      onViewAnalysisRun={handleViewAnalysisRun}
      // Notification for single env
      NotificationComponent={OssNotificationComponent}
      // Connection popover wrapper
      ConnectionPopoverWrapper={SetupConnectionPopover}
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
            impactingNodeIds={impactingNodeIds}
            impactedNodeIds={impactedNodeIds}
          />
        ) : undefined
      }
    />
  );
}
