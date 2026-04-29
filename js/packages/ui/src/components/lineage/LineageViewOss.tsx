"use client";

import type { Check, ServerInfoResult } from "../../api";
import {
  type CllInput,
  type ColumnLineageData,
  cacheKeys,
  createLineageDiffCheck,
  createSchemaDiffCheck,
  getCll,
  isHistogramDiffRun,
  isProfileDiffRun,
  isTopKDiffRun,
  isValueDiffDetailRun,
  isValueDiffRun,
  type LineageDiffViewOptions,
  select,
} from "../../api";
import {
  LineageViewContext,
  useLineageGraphContext,
  useRecceActionContext,
  useRecceInstanceContext,
  useRecceServerFlag,
} from "../../contexts";
import {
  isLineageGraphColumnNode,
  isLineageGraphNode,
  type LineageGraph,
  type LineageGraphColumnNode,
  type LineageGraphEdge,
  type LineageGraphNode,
  type LineageGraphNodes,
  type LineageViewContextType,
} from "../../contexts/lineage/types";
import {
  type NodeColumnSetMap,
  selectDownstream,
  selectUpstream,
  union,
} from "../../contexts/lineage/utils";
import {
  IGNORE_SCREENSHOT_CLASS,
  useApiConfig,
  useRun,
  useThemeColors,
} from "../../hooks";
import { useMultiNodesActionOss as useMultiNodesAction } from "../../hooks/useMultiNodesActionOss";
import useValueDiffAlertDialog from "../../hooks/useValueDiffAlertDialogOss";
import {
  trackCopyToClipboard,
  trackMultiNodesAction,
} from "../../lib/api/track";
import "../../styles";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  getNodesBounds,
  MiniMap,
  Node,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import React, {
  forwardRef,
  Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiCopy } from "react-icons/fi";
import { HttpError } from "../../lib/fetchClient";
import { colors } from "../../theme";
import { LineageViewNotification } from "../notifications";
import { HSplit, toaster } from "../ui";
import { ActionControlOss } from "./ActionControlOss";
import { ColumnLevelLineageControlOss } from "./ColumnLevelLineageControlOss";
import { computeColumnLineage } from "./computeColumnLineage";
import { computeImpactedColumns } from "./computeImpactedColumns";
import { computeIsImpacted } from "./computeIsImpacted";
import {
  EXPLORE_MIN_ZOOM,
  edgeTypes,
  FIT_VIEW_PADDING,
  getNodeColor,
  initialNodes,
  LEGIBLE_MIN_ZOOM,
  nodeTypes,
} from "./config";
import {
  useLineageCopyToClipboard,
  useNavToCheck,
  usePublishedImpactSets,
  useResizeObserver,
  useTrackLineageRender,
} from "./hooks";
import {
  LineageViewContextMenu,
  useLineageViewContextMenu,
} from "./LineageViewContextMenuOss";
import { LineageLegend } from "./legend";
import { toReactFlow } from "./lineage";
import { NodeViewOss as NodeView } from "./NodeViewOss";
import type { NodeChangeStatus } from "./nodes/LineageNode";
import { patchLineageFromCll } from "./patchLineageDiffFromCll";
import SetupConnectionBanner from "./SetupConnectionBannerOss";
import { BaseEnvironmentSetupNotification } from "./SingleEnvironmentQueryView";
import {
  LineageViewError,
  LineageViewLoading,
  LineageViewNoChanges,
} from "./states";
import { LineageViewTopBarOss as LineageViewTopBar } from "./topbar/LineageViewTopBarOss";

/** Hide MiniMap when node count exceeds this threshold to reduce DOM pressure */
export const MINIMAP_NODE_THRESHOLD = 500;

/**
 * Compute impacted node IDs and column IDs in a single pass over the CLL data.
 *
 * The expensive part is `computeImpactedColumns` (DFS over parent_map), so we
 * run it once and thread the result into per-node checks.
 */
function computeImpactedSets(
  lineageGraph: LineageGraph,
  cll: ColumnLineageData,
): { nodeIds: Set<string>; columnIds: Set<string> } {
  const columnIds = computeImpactedColumns(cll);
  const nodeIds = new Set<string>();
  for (const nodeId of Object.keys(lineageGraph.nodes)) {
    const node = lineageGraph.nodes[nodeId];
    if (
      computeIsImpacted(
        nodeId,
        cll,
        node.data.changeStatus as NodeChangeStatus,
        columnIds,
      )
    ) {
      nodeIds.add(nodeId);
    }
  }
  return { nodeIds, columnIds };
}

/**
 * Compute column ancestry if we're in column mode with valid input.
 *
 * @param impactedColumns - Pre-computed impacted column set. Avoids a
 *   redundant DFS when the caller already has it (e.g. from computeImpactedSets).
 */
function maybeComputeLineage(
  newCllExperience: boolean,
  cll: ColumnLineageData | undefined,
  cllInput: CllInput | undefined,
  impactedColumns?: Set<string>,
) {
  return newCllExperience && cll && cllInput?.node_id && cllInput?.column
    ? computeColumnLineage(
        cll,
        cllInput.node_id,
        cllInput.column,
        impactedColumns ?? new Set<string>(),
      )
    : undefined;
}

export interface LineageViewProps {
  viewOptions?: LineageDiffViewOptions;
  interactive?: boolean;
  weight?: number;
  height?: number;

  // to be removed
  // viewMode?: "changed_models" | "all"; // deprecated
  filterNodes?: (key: string, node: LineageGraphNode) => boolean;
}

export interface LineageViewRef {
  copyToClipboard: () => void;
}

/**
 * Fetch CLL data and patch the lineage diff cache with change data.
 *
 * This is the shared core of CLL fetching used by both the initial layout
 * effect and refreshLayout. The caller provides the resolved changeAnalysis
 * value (from ref or state) so this function has no closure concerns.
 */
async function fetchCllAndPatchCache(
  cllInput: CllInput,
  changeAnalysis: boolean,
  actionGetCll: {
    mutateAsync: (input: CllInput) => Promise<ColumnLineageData>;
  },
  cllCachePatchRef: React.MutableRefObject<{
    pending: boolean;
    cllData?: ColumnLineageData;
  }>,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<ColumnLineageData> {
  const cllApiInput: CllInput = {
    ...cllInput,
    change_analysis: cllInput.change_analysis ?? changeAnalysis,
  };
  const cll = await actionGetCll.mutateAsync(cllApiInput);
  if (cllApiInput.change_analysis && cll) {
    cllCachePatchRef.current = { pending: true, cllData: cll };
    queryClient.setQueryData(
      cacheKeys.lineage(),
      (old: ServerInfoResult | undefined) => {
        if (!old) return old;
        return {
          ...old,
          lineage: patchLineageFromCll(old.lineage, cll),
        };
      },
    );
  }
  return cll;
}

export function PrivateLineageView(
  { interactive = false, ...props }: LineageViewProps,
  ref: Ref<LineageViewRef>,
) {
  const { isDark } = useThemeColors();
  const { apiClient } = useApiConfig();
  const queryClient = useQueryClient();
  const reactFlow = useReactFlow();
  const refResize = useRef<HTMLDivElement>(null);
  const {
    copyToClipboard,
    ImageDownloadModal,
    ref: refReactFlow,
  } = useLineageCopyToClipboard();
  const [nodes, setNodes, onNodesChange] =
    useNodesState<LineageGraphNodes>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<LineageGraphEdge>([]);

  const {
    lineageGraph,
    refetchLineageGraph,
    isLoading,
    error,
    refetchRunsAggregated,
  } = useLineageGraphContext();

  const { featureToggles, singleEnv } = useRecceInstanceContext();
  const { data: serverFlags } = useRecceServerFlag();
  const newCllExperience = serverFlags?.new_cll_experience ?? false;
  const { runId, showRunId, closeRunResult, runAction, isRunResultOpen } =
    useRecceActionContext();
  const { run } = useRun(runId);

  const [viewOptions, setViewOptions] = useState<LineageDiffViewOptions>({
    ...props.viewOptions,
  });

  const trackLineageRender = useTrackLineageRender();

  const cllHistory = useRef<(CllInput | undefined)[]>([]).current;

  const [cll, setCll] = useState<ColumnLineageData | undefined>(undefined);
  const [changeAnalysisMode, setChangeAnalysisMode] = useState(false);
  // Ref mirror of changeAnalysisMode for reading inside useLayoutEffect
  // without adding it as a dependency (avoids re-running layout on toggle).
  const changeAnalysisModeRef = useRef(false);
  changeAnalysisModeRef.current = changeAnalysisMode;
  const actionGetCll = useMutation({
    mutationFn: (input: CllInput) => getCll(input, apiClient),
  });
  // Guard against useLayoutEffect re-entry after cache patching.
  // When setQueryData patches lineage.diff, queryServerInfo.data changes,
  // lineageGraph recomputes via useMemo, and the effect re-fires. This ref
  // tells the effect to reuse the previous CLL result instead of re-calling
  // the API and re-patching (which would loop infinitely).
  const cllCachePatchRef = useRef<{
    pending: boolean;
    cllData?: ColumnLineageData;
  }>({ pending: false });
  const [nodeColumnSetMap, setNodeColumSetMap] = useState<NodeColumnSetMap>({});

  const findNodeByName = useCallback(
    (name: string) => {
      return nodes.filter(isLineageGraphNode).find((n) => n.data.name === name);
    },
    [nodes],
  );

  // Expose the function to the parent via the ref
  useImperativeHandle(ref, () => ({
    copyToClipboard,
  }));

  const isModelsChanged = useMemo(() => {
    return !!(lineageGraph && lineageGraph.modifiedSet.length > 0);
  }, [lineageGraph]);

  /**
   * View mode
   * - all: show all nodes
   * - changed_models: show only changed models
   */
  const viewMode = viewOptions.view_mode ?? "changed_models";
  const filteredNodeIds: string[] = useMemo(() => {
    return nodes
      .filter((node) => node.type === "lineageGraphNode")
      .map((node) => node.id);
  }, [nodes]);
  const filteredNodes = useMemo(() => {
    if (!lineageGraph) {
      return [];
    }

    return filteredNodeIds.map((nodeId) => lineageGraph.nodes[nodeId]);
  }, [lineageGraph, filteredNodeIds]);

  /**
   * Focused node: the node that is currently focused. Show the NodeView when a node is focused
   */
  const [focusedNodeId, setFocusedNodeId] = useState<string>();
  const focusedNode = focusedNodeId
    ? lineageGraph?.nodes[focusedNodeId]
    : undefined;

  /**
   * Stack of previously focused node ids, used by the Lineage tab's "back"
   * button and breadcrumb. Only the panel's own navigation pushes here —
   * clicking a node on the canvas clears it (fresh context).
   */
  const [focusedHistory, setFocusedHistory] = useState<string[]>([]);

  /**
   * Select mode: the behavior of clicking on nodes
   * - (undefined): no selection
   * - selecting: selecting nodes
   * - action_result: take action on selected nodes
   */
  const [selectMode, setSelectMode] = useState<"selecting" | "action_result">();
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const selectedNodes = useMemo(() => {
    if (!lineageGraph) {
      return [];
    }

    const nodeIds = Array.from(selectedNodeIds);
    return nodeIds.map((nodeId) => lineageGraph.nodes[nodeId]);
  }, [lineageGraph, selectedNodeIds]);
  const multiNodeAction = useMultiNodesAction(
    selectedNodes.length > 0 ? selectedNodes : filteredNodes,
    {
      onActionStarted: () => {
        setSelectMode("action_result");
      },
      onActionNodeUpdated: (updated: LineageGraphNode) => {
        // trigger a re-render by updating the nodes
        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === updated.id) {
              return {
                ...node,
              };
            }
            return node;
          }),
        );
      },
      onActionCompleted: () => {
        return void 0;
      },
    },
  );

  /**
   * Helper to extract node positions for preserving layout.
   *
   * IMPORTANT: We read positions from React Flow's internal store via getNodes()
   * rather than from React state. This ensures we capture the actual rendered
   * positions, which may differ from React state due to:
   * - fitView adjustments
   * - Node measuring/resizing
   * - Internal React Flow position updates
   *
   * This fixes where clicking between columns caused graph reflow
   * because React state positions were stale relative to what React Flow rendered.
   */
  const getNodePositions = useCallback(() => {
    const positions = new Map<string, { x: number; y: number }>();
    // Get nodes directly from React Flow's internal store, not React state
    const currentNodes = reactFlow.getNodes();
    for (const node of currentNodes) {
      // Only capture parent node positions, not column nodes
      if (!node.parentId && node.position) {
        positions.set(node.id, { x: node.position.x, y: node.position.y });
      }
    }
    return positions;
  }, [reactFlow]);

  /**
   * Highlighted nodes — controls which nodes are fully opaque vs dimmed.
   * "Is this node part of the current CLL response / selection at all?"
   *
   * This is distinct from impactedNodeIds, which answers a narrower question:
   * "Does this node trace upstream to a *changed* column?" A node can be
   * highlighted (it participates in the CLL graph) but not impacted (none of
   * its columns have upstream changes). impactedNodeIds drives the amber
   * border; highlighted drives the opacity.
   *
   * Behavior by mode:
   * - Default: nodes in the impact radius, or all nodes if the impact radius is not available
   * - Focus: upstream/downstream nodes of the focused node
   * - Multi-select: nodes in the impact radius, or all nodes if the impact radius is not available
   * - Action Result: selected nodes
   */
  const highlighted = useMemo<Set<string>>(() => {
    if (!lineageGraph) {
      return new Set<string>();
    }

    let highlightedModels: Set<string> = new Set<string>();
    if (cll) {
      for (const [nodeId, node] of Object.entries(cll.current.nodes)) {
        if (node.impacted !== false) {
          highlightedModels.add(nodeId);
        }
      }
      for (const columnId of Object.keys(cll.current.columns)) {
        highlightedModels.add(columnId);
      }
    } else if (selectMode === "action_result") {
      const nodeIds = Object.keys(multiNodeAction.actionState.actions);
      highlightedModels = new Set(nodeIds);
    } else if (focusedNode) {
      highlightedModels = union(
        selectUpstream(lineageGraph, [focusedNode.id]),
        selectDownstream(lineageGraph, [focusedNode.id]),
      );
    } else if (isModelsChanged) {
      highlightedModels = selectDownstream(
        lineageGraph,
        lineageGraph.modifiedSet,
      );
    } else {
      highlightedModels = new Set(filteredNodeIds);
    }

    // Add columns in the highlighted models
    return new Set<string>(highlightedModels);
  }, [
    lineageGraph,
    cll,
    selectMode,
    focusedNode,
    isModelsChanged,
    multiNodeAction.actionState.actions,
    filteredNodeIds,
  ]);

  const lineageViewContextMenu = useLineageViewContextMenu();

  const closeContextMenu = () => {
    lineageViewContextMenu.closeContextMenu();
  };

  // Guard: auto-trigger impact analysis only once per mount
  const impactAtStartupFired = useRef(false);
  const {
    impactedNodeIds,
    impactedColumnIds,
    publish: publishImpactSets,
  } = usePublishedImpactSets();

  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally only run when lineageGraph changes (initial load/refetch).
  useLayoutEffect(() => {
    const t = async () => {
      let filteredNodeIds: string[] | undefined = undefined;

      if (!lineageGraph) {
        return;
      }

      if (viewOptions.node_ids) {
        filteredNodeIds = viewOptions.node_ids;
      } else {
        const packageName = lineageGraph.manifestMetadata.current?.project_name;
        const viewMode =
          viewOptions.view_mode ?? (isModelsChanged ? "changed_models" : "all");

        const newViewOptions: LineageDiffViewOptions = {
          view_mode: viewMode,
          packages: packageName ? [packageName] : undefined,
          ...props.viewOptions,
        };

        try {
          const result = await select(
            {
              select: newViewOptions.select,
              exclude: newViewOptions.exclude,
              packages: newViewOptions.packages,
              view_mode: newViewOptions.view_mode,
            },
            apiClient,
          );
          filteredNodeIds = result.nodes;
        } catch (_) {
          // fallback behavior
          newViewOptions.view_mode = "all";
          const result = await select(
            {
              select: newViewOptions.select,
              exclude: newViewOptions.exclude,
              packages: newViewOptions.packages,
              view_mode: newViewOptions.view_mode,
            },
            apiClient,
          );
          filteredNodeIds = result.nodes;
        }

        setViewOptions(newViewOptions);
      }

      // Auto-trigger impact analysis on first load when flag is set
      let cllInput = viewOptions.column_level_lineage;
      let autoTriggered = false;
      if (
        serverFlags?.impact_at_startup &&
        !impactAtStartupFired.current &&
        !cllInput
      ) {
        impactAtStartupFired.current = true;
        autoTriggered = true;
        changeAnalysisModeRef.current = true;
        setChangeAnalysisMode(true);
        cllInput = { change_analysis: true, no_upstream: true };
        // Persist to viewOptions so the CLL survives effect re-fires
        // (e.g. when the lineageGraph cache is patched with change data)
        setViewOptions((prev) => ({
          ...prev,
          column_level_lineage: cllInput,
        }));
      }

      let cll: ColumnLineageData | undefined;
      if (cllInput) {
        if (cllCachePatchRef.current.pending) {
          // Effect re-fired because our setQueryData updated lineageGraph.
          // Reuse the previous CLL result; skip the API call and re-patch.
          cll = cllCachePatchRef.current.cllData;
          cllCachePatchRef.current = { pending: false };
        } else {
          try {
            cll = await fetchCllAndPatchCache(
              cllInput,
              changeAnalysisModeRef.current,
              actionGetCll,
              cllCachePatchRef,
              queryClient,
            );
          } catch (e) {
            if (autoTriggered) {
              // Roll back the CLL state so the UI isn't stuck in a
              // half-initialized "CLL on, no data" state.
              changeAnalysisModeRef.current = false;
              setChangeAnalysisMode(false);
              setViewOptions((prev) => ({
                ...prev,
                column_level_lineage: undefined,
              }));
              cllInput = undefined;
            }
            if (e instanceof HttpError) {
              toaster.create({
                title: "Column Level Lineage error",
                description:
                  (e.data as { detail?: string })?.detail ?? e.message,
                type: "error",
                closable: true,
              });
              return;
            }
          }
        }
      } else {
        // CLL disabled — clear any pending guard so stale data isn't reused
        // if CLL is re-enabled after a toggle-off.
        cllCachePatchRef.current = { pending: false };
      }

      // Compute impacted sets once; thread into ancestry to avoid redundant DFS.
      const impacted =
        newCllExperience && cll
          ? computeImpactedSets(lineageGraph, cll)
          : undefined;

      const [nodes, edges, nodeColumnSetMap] = await toReactFlow(lineageGraph, {
        selectedNodes: filteredNodeIds,
        cll: cll,
        newCllExperience,
        columnAncestry: maybeComputeLineage(
          newCllExperience,
          cll,
          cllInput,
          impacted?.columnIds,
        ),
      });
      setNodes(nodes);
      setEdges(edges);
      setNodeColumSetMap(nodeColumnSetMap);
      setCll(cll);

      // Snapshot impacted sets during impact analysis so they stay stable
      // when the user clicks a column (which returns column-scoped CLL data).
      if (impacted && cllInput?.change_analysis && !cllInput?.column) {
        publishImpactSets(impacted);
      }

      // Track lineage view render
      trackLineageRender(
        nodes,
        viewOptions.view_mode ?? "changed_models",
        changeAnalysisModeRef.current,
        !!cllInput?.column,
        !!focusedNodeId || !!run,
      );
    };

    void t();
    // Runs when lineageGraph changes (initial load/refetch), and also when
    // impact_at_startup flag arrives (may load after lineageGraph).
    // viewOptions changes are handled separately by handleViewOptionsChanged.
    // Other dependencies (setNodes, setEdges, actionGetCll) are stable.
    // changeAnalysisModeRef is a ref to avoid stale closure issues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineageGraph, serverFlags?.impact_at_startup]);

  const onNodeViewClosed = () => {
    setFocusedNodeId(undefined);
    setFocusedHistory([]);
  };

  /**
   * Navigate the Model Detail panel to a different node without touching the
   * canvas. The canvas is only re-centered on explicit request (via the
   * crosshair icon in the Lineage tab's focus card). The current focus is
   * pushed onto focusedHistory so the "back" button can return to it.
   */
  const navigateToNode = (nodeId: string) => {
    if (!lineageGraph?.nodes[nodeId]) return;
    if (focusedNodeId && focusedNodeId !== nodeId) {
      setFocusedHistory((h) => [...h, focusedNodeId]);
    }
    setFocusedNodeId(nodeId);
  };

  const navigateBack = () => {
    if (focusedHistory.length === 0) return;
    const previous = focusedHistory[focusedHistory.length - 1];
    if (!lineageGraph?.nodes[previous]) return;
    setFocusedNodeId(previous);
    setFocusedHistory((h) => h.slice(0, -1));
  };

  /**
   * Jump back to a specific entry in the focused history (breadcrumb click).
   * Truncates everything after `index` and refocuses on the entry at `index`.
   */
  const navigateToHistoryIndex = (index: number) => {
    if (index < 0 || index >= focusedHistory.length) return;
    const target = focusedHistory[index];
    if (!lineageGraph?.nodes[target]) return;
    setFocusedNodeId(target);
    setFocusedHistory((h) => h.slice(0, index));
  };

  const centerFocusedNode = () => {
    if (!focusedNodeId) return;
    void centerNode(focusedNodeId);
  };

  const centerNode = async (nodeId: string) => {
    let node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }

    if (node.parentId) {
      const parentId = node.parentId;
      node = nodes.find((n) => n.id === parentId) ?? node;
    }

    if (node.measured != null) {
      const { width, height } = node.measured;
      if (width && height) {
        const x = node.position.x + width / 2;
        const y = node.position.y + height / 2;
        const zoom = reactFlow.getZoom();

        await reactFlow.setCenter(x, y, { zoom, duration: 200 });
      }
    }
  };

  const navToCheck = useNavToCheck();

  useResizeObserver(refResize, async () => {
    if (selectMode !== "selecting") {
      if (!focusedNodeId) {
        await reactFlow.fitView({
          nodes,
          duration: 200,
          padding: FIT_VIEW_PADDING,
          minZoom: LEGIBLE_MIN_ZOOM,
          maxZoom: 1,
        });
      } else {
        await centerNode(focusedNodeId);
      }
    }
  });

  const showColumnLevelLineage = async (
    columnLevelLineage?: CllInput,
    previous = false,
  ) => {
    const previousColumnLevelLineage = viewOptions.column_level_lineage;

    // Clear change analysis mode when CLL is turned off entirely.
    // In new CLL experience, impact is a one-way ratchet — never disable it.
    if (!columnLevelLineage && !newCllExperience) {
      setChangeAnalysisMode(false);
    }

    // Preserve positions when:
    // 1. CLL is being turned OFF (previous exists but new one is undefined)
    // 2. Switching between columns (both previous and new have CLL)
    // This prevents jarring graph reflow when the user clicks between columns
    const shouldPreservePositions = previousColumnLevelLineage !== undefined;

    await handleViewOptionsChanged(
      {
        ...viewOptions,
        column_level_lineage: columnLevelLineage,
      },
      false,
      shouldPreservePositions, // preserve positions when CLL was previously active
    );

    if (!previous) {
      cllHistory.push(previousColumnLevelLineage);
    }
    if (columnLevelLineage?.node_id) {
      setFocusedNodeId(columnLevelLineage.node_id);
    } else if (!columnLevelLineage) {
      // Only clear focus when CLL is turned off, not for Impact Radius
      setFocusedNodeId(undefined);
    }
  };

  const resetColumnLevelLineage = async (previous?: boolean) => {
    if (previous) {
      if (cllHistory.length === 0) {
        return;
      }
      const previousCll = cllHistory.pop();
      if (previousCll) {
        await showColumnLevelLineage(previousCll, true);
      } else {
        await showColumnLevelLineage(undefined, true);
      }
    } else if (newCllExperience && changeAnalysisMode) {
      // In new CLL experience, reset returns to Layer 2 (global impact)
      // instead of clearing CLL entirely.
      await showColumnLevelLineage(
        { change_analysis: true, no_upstream: true },
        true,
      );
    } else {
      await showColumnLevelLineage(undefined, true);
    }
  };

  const onColumnNodeClick = (
    event: React.MouseEvent,
    node: LineageGraphColumnNode,
  ) => {
    if (selectMode) {
      return;
    }

    void showColumnLevelLineage({
      node_id: node.data.node.id,
      column: node.data.column,
    });
  };

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    if (!interactive) return;
    if (!lineageGraph) {
      return;
    }

    if (isLineageGraphColumnNode(node as LineageGraphNodes)) {
      onColumnNodeClick(event, node as LineageGraphColumnNode);
      return;
    }

    closeContextMenu();
    if (!selectMode) {
      setFocusedNodeId(node.id);
      setFocusedHistory([]);
    } else if (selectMode === "action_result") {
      const action = multiNodeAction.actionState.actions[node.id];
      if (action.run?.run_id) {
        showRunId(action.run.run_id);
      }
      setFocusedNodeId(node.id);
      setFocusedHistory([]);
    } else {
      const newSet = new Set(selectedNodeIds);
      if (selectedNodeIds.has(node.id)) {
        newSet.delete(node.id);
      } else {
        newSet.add(node.id);
      }
      setSelectedNodeIds(newSet);
      if (newSet.size === 0) {
        setSelectMode(undefined);
      }
    }
  };

  const refreshLayout = async (options: {
    viewOptions?: LineageDiffViewOptions;
    fitView?: boolean;
    preservePositions?: boolean;
  }) => {
    let { viewOptions: newViewOptions = viewOptions } = options;
    const { fitView, preservePositions = false } = options;

    let selectedNodes: string[] | undefined = undefined;

    if (!lineageGraph) {
      return;
    }

    const reselect =
      viewOptions.select !== newViewOptions.select ||
      viewOptions.exclude !== newViewOptions.exclude ||
      viewOptions.packages !== newViewOptions.packages ||
      viewOptions.view_mode !== newViewOptions.view_mode;

    if (reselect) {
      try {
        const result = await select(
          {
            select: newViewOptions.select,
            exclude: newViewOptions.exclude,
            packages: newViewOptions.packages,
            view_mode: newViewOptions.view_mode,
          },
          apiClient,
        );
        // focus to unfocus the model or column node
        newViewOptions = { ...newViewOptions, column_level_lineage: undefined };
        selectedNodes = result.nodes;
      } catch (e) {
        if (e instanceof HttpError) {
          toaster.create({
            title: "Select node error",
            description: (e.data as { detail?: string })?.detail ?? e.message,
            type: "error",
            closable: true,
          });
        }
        return;
      }
      setFocusedNodeId(undefined);
    } else {
      selectedNodes = nodes.map((n) => n.id);
    }

    let cll: ColumnLineageData | undefined;
    if (newViewOptions.column_level_lineage) {
      try {
        cll = await fetchCllAndPatchCache(
          newViewOptions.column_level_lineage,
          changeAnalysisMode,
          actionGetCll,
          cllCachePatchRef,
          queryClient,
        );
      } catch (e) {
        if (e instanceof HttpError) {
          toaster.create({
            title: "Column Level Lineage error",
            description: (e.data as { detail?: string })?.detail ?? e.message,
            type: "error",
            closable: true,
          });
          return;
        }
      }
    } else if (!newCllExperience) {
      // Clear change analysis mode when CLL is cleared by any path
      // (reselect, selectParentNodes, selectChildNodes, etc.)
      // In new CLL experience, impact is a one-way ratchet.
      setChangeAnalysisMode(false);
    }

    // Capture positions if preservePositions is true
    let existingPositions: Map<string, { x: number; y: number }> | undefined;
    if (preservePositions || newCllExperience) {
      existingPositions = getNodePositions();
    }

    const cllInput2 = newViewOptions.column_level_lineage;

    const impacted =
      newCllExperience && cll
        ? computeImpactedSets(lineageGraph, cll)
        : undefined;

    const [newNodes, newEdges, newNodeColumnSetMap] = await toReactFlow(
      lineageGraph,
      {
        selectedNodes,
        cll,
        existingPositions,
        newCllExperience,
        columnAncestry: maybeComputeLineage(
          newCllExperience,
          cll,
          cllInput2,
          impacted?.columnIds,
        ),
      },
    );
    setNodes(newNodes);
    setEdges(newEdges);
    setNodeColumSetMap(newNodeColumnSetMap);
    setCll(cll);

    // Snapshot impacted node and column IDs during impact analysis (see layout effect).
    if (impacted && !cllInput2?.column) {
      publishImpactSets(impacted);
    }

    // Track lineage view render
    trackLineageRender(
      newNodes,
      newViewOptions.view_mode ?? "changed_models",
      changeAnalysisMode,
      !!newViewOptions.column_level_lineage?.column,
      !!focusedNodeId || !!run,
    );

    // Close the run result view if the run result node is not in the new nodes
    if (
      run &&
      (isTopKDiffRun(run) ||
        isProfileDiffRun(run) ||
        isHistogramDiffRun(run) ||
        isValueDiffRun(run) ||
        isValueDiffDetailRun(run))
    ) {
      if (run.params?.model && !findNodeByName(run.params.model)) {
        closeRunResult();
      }
    }

    if (fitView) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      (() => {
        void reactFlow.fitView({
          nodes: newNodes,
          duration: 200,
          padding: FIT_VIEW_PADDING,
          minZoom: LEGIBLE_MIN_ZOOM,
          maxZoom: 1,
        });
      })();
    }
  };

  const handleViewOptionsChanged = async (
    newViewOptions: LineageDiffViewOptions,
    fitView = true,
    preservePositions = false,
  ) => {
    setViewOptions(newViewOptions);
    await refreshLayout({
      viewOptions: newViewOptions,
      fitView,
      preservePositions,
    });
  };

  const valueDiffAlertDialog = useValueDiffAlertDialog();

  // biome-ignore lint/correctness/useExhaustiveDependencies: handleViewOptionsChanged and onNodeClick are intentionally omitted
  useEffect(() => {
    const runResultType = run?.type;
    if (!interactive) {
      // Skip the following logic if the view is not interactive
      return;
    }
    if (!isRunResultOpen) {
      // Skip the following logic if the run result is not open
      return;
    }
    if (
      !runResultType ||
      ["query_diff", "query", "row_count", "row_count_diff"].includes(
        runResultType,
      )
    ) {
      // Skip the following logic if the run result type is not related to a node
      return;
    }

    if (!selectMode) {
      // Skip the following logic if the select mode is not single
      let selectedRunModel = undefined;
      if (
        isTopKDiffRun(run) ||
        isProfileDiffRun(run) ||
        isHistogramDiffRun(run) ||
        isValueDiffRun(run) ||
        isValueDiffDetailRun(run)
      ) {
        selectedRunModel = run.params?.model;
      }

      // Create a mock MouseEvent
      const mockEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      }) as unknown as React.MouseEvent;

      if (selectedRunModel) {
        // If the run result is related to a node, select the node to show NodeView
        const node = findNodeByName(selectedRunModel);
        if (!node) {
          // Cannot find the node in the current nodes, try to change the view mode to 'all'
          void handleViewOptionsChanged({
            ...viewOptions,
            view_mode: "all",
          });
        } else if (isLineageGraphNode(node) && focusedNode?.id !== node.id) {
          // Only select the node if it is not already selected
          onNodeClick(mockEvent, node);
        }
      } else {
        // If the run result is not related to a node, close the NodeView
        onNodeViewClosed();
      }
    }
    // handleViewOptionsChanged and onNodeClick are intentionally omitted to prevent
    // unnecessary re-runs. These functions are called conditionally within the effect
    // and don't need to trigger the effect when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    run,
    viewOptions,
    isRunResultOpen,
    selectMode,
    findNodeByName,
    focusedNode,
    interactive,
  ]);

  const selectParentNodes = (nodeId: string, degree = 1000) => {
    if (selectMode === "action_result" || lineageGraph === undefined) return;

    if (!selectMode) {
      setSelectMode("selecting");
      multiNodeAction.reset();
      if (viewOptions.column_level_lineage) {
        void handleViewOptionsChanged({
          ...viewOptions,
          column_level_lineage: undefined,
        });
      }
    }

    const upstream = selectUpstream(lineageGraph, [nodeId], degree);
    setSelectedNodeIds(union(selectedNodeIds, upstream));
  };

  const selectChildNodes = (nodeId: string, degree = 1000) => {
    if (selectMode === "action_result" || lineageGraph === undefined) return;

    if (!selectMode) {
      setSelectMode("selecting");
      multiNodeAction.reset();
      if (viewOptions.column_level_lineage) {
        void handleViewOptionsChanged({
          ...viewOptions,
          column_level_lineage: undefined,
        });
      }
    }

    const downstream = selectDownstream(lineageGraph, [nodeId], degree);
    setSelectedNodeIds(union(selectedNodeIds, downstream));
  };

  const onNodeContextMenu = (
    event: React.MouseEvent,
    node: LineageGraphNodes,
  ) => {
    if (!interactive) {
      return;
    }
    if (selectMode === "action_result") {
      return;
    }
    // Only show context menu when selectMode is action
    // Prevent native context menu from showing
    event.preventDefault();
    const reactFlowDiv = refReactFlow.current as unknown as HTMLDivElement;
    const pane = reactFlowDiv.getBoundingClientRect();
    const x = event.clientX - pane.left;
    const y = event.clientY - pane.top + reactFlowDiv.offsetTop;
    lineageViewContextMenu.showContextMenu(x, y, node);
  };

  const selectNode = (nodeId: string) => {
    if (!selectMode) {
      if (!lineageGraph) {
        return;
      }

      setSelectedNodeIds(new Set([nodeId]));
      setSelectMode("selecting");
      setFocusedNodeId(undefined);
      multiNodeAction.reset();
    } else if (selectMode === "selecting") {
      const newSelectedNodeIds = new Set(selectedNodeIds);
      if (selectedNodeIds.has(nodeId)) {
        newSelectedNodeIds.delete(nodeId);
      } else {
        newSelectedNodeIds.add(nodeId);
      }

      setSelectedNodeIds(newSelectedNodeIds);
      if (newSelectedNodeIds.size === 0) {
        setSelectMode(undefined);
      }
    }
  };
  const deselect = () => {
    setSelectMode(undefined);
    setSelectedNodeIds(new Set());
    setFocusedNodeId(undefined);
    closeRunResult();
    refetchRunsAggregated?.();
  };

  const contextValue: LineageViewContextType = {
    interactive,
    nodes,
    focusedNode,
    selectedNodes,
    viewOptions,
    showContextMenu: onNodeContextMenu,
    onViewOptionsChanged: handleViewOptionsChanged,
    selectMode,
    selectNode,
    selectParentNodes,
    selectChildNodes,
    deselect,
    impactedNodeIds,
    impactedColumnIds,
    isNodeHighlighted: (nodeId: string) => highlighted.has(nodeId),
    isNodeSelected: (nodeId: string) => selectedNodeIds.has(nodeId),
    isEdgeHighlighted: (source, target) => {
      if (!cll) {
        return highlighted.has(source) && highlighted.has(target);
      } else {
        if (!(source in cll.current.parent_map)) {
          return false;
        }
        return target in cll.current.parent_map[source];
      }
    },
    isNodeShowingChangeAnalysis: (nodeId: string) => {
      if (!lineageGraph || !changeAnalysisMode) {
        return false;
      }

      const node =
        nodeId in lineageGraph.nodes ? lineageGraph.nodes[nodeId] : undefined;

      const cll = viewOptions.column_level_lineage;
      if (cll?.node_id && !cll.column) {
        return cll.node_id === nodeId && !!node?.data.changeStatus;
      }
      return !!node?.data.changeStatus;
    },
    changeAnalysisMode,
    newCllExperience,
    setChangeAnalysisMode,
    getNodeAction: (nodeId: string) => {
      return multiNodeAction.actionState.actions[nodeId];
    },
    getNodeColumnSet: (nodeId: string) => {
      if (!(nodeId in nodeColumnSetMap)) {
        return new Set<string>();
      }

      return new Set(nodeColumnSetMap[nodeId]);
    },
    runRowCount: async () => {
      if (selectMode === "selecting") {
        await multiNodeAction.runRowCount();
        trackMultiNodesAction({ type: "row_count", selected: "multi" });
      } else if (focusedNode) {
        runAction(
          "row_count",
          { node_names: [focusedNode.data.name] },
          { showForm: false, showLast: false },
        );
        trackMultiNodesAction({ type: "row_count", selected: "single" });
      } else {
        runAction("row_count", {
          select: viewOptions.select,
          exclude: viewOptions.exclude,
          packages: viewOptions.packages,
          view_mode: viewOptions.view_mode,
        });
        trackMultiNodesAction({ type: "row_count", selected: "none" });
      }
    },
    runRowCountDiff: async () => {
      if (selectMode === "selecting") {
        await multiNodeAction.runRowCountDiff();
        trackMultiNodesAction({ type: "row_count_diff", selected: "multi" });
      } else if (focusedNode) {
        runAction(
          "row_count_diff",
          { node_names: [focusedNode.data.name] },
          { showForm: false, showLast: false },
        );
        trackMultiNodesAction({ type: "row_count_diff", selected: "single" });
      } else {
        runAction("row_count_diff", {
          select: viewOptions.select,
          exclude: viewOptions.exclude,
          packages: viewOptions.packages,
          view_mode: viewOptions.view_mode,
        });
        trackMultiNodesAction({ type: "row_count_diff", selected: "none" });
      }
    },
    runValueDiff: async () => {
      if (focusedNode) {
        runAction(
          "value_diff",
          {
            model: focusedNode.data.name,
          },
          { showForm: true, showLast: false },
        );
        trackMultiNodesAction({ type: "value_diff", selected: "single" });
      } else {
        const nodeCount =
          selectMode === "selecting"
            ? selectedNodes.length
            : filteredNodeIds.length;
        if (await valueDiffAlertDialog.confirm(nodeCount)) {
          await multiNodeAction.runValueDiff();
          trackMultiNodesAction({
            type: "value_diff",
            selected: selectMode === "selecting" ? "multi" : "none",
          });
        }
      }
    },
    addLineageDiffCheck: async () => {
      // create lineage diff check based on the current lineage view (ignoring focus/selection).
      const check = await createLineageDiffCheck(viewOptions, apiClient);
      // the mode is tracked for analytics purposes.
      let selectedMode: "multi" | "single" | "none";
      if (selectMode === "selecting") {
        selectedMode = "multi";
      } else if (focusedNode) {
        selectedMode = "single";
      } else {
        selectedMode = "none";
      }
      trackMultiNodesAction({ type: "lineage_diff", selected: selectedMode });

      if (check) {
        await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
        navToCheck(check);
      }
    },
    addSchemaDiffCheck: async () => {
      let check: Check | undefined = undefined;

      if (selectMode === "selecting") {
        if (selectedNodes.length > 0) {
          check = await multiNodeAction.addSchemaDiffCheck();
          deselect();
          trackMultiNodesAction({ type: "schema_diff", selected: "multi" });
        }
      } else if (focusedNode) {
        check = await createSchemaDiffCheck(
          {
            node_id: focusedNode.id,
          },
          apiClient,
        );
        trackMultiNodesAction({ type: "schema_diff", selected: "single" });
      } else {
        check = await createSchemaDiffCheck(
          {
            select: viewOptions.select,
            exclude: viewOptions.exclude,
            packages: viewOptions.packages,
            view_mode: viewOptions.view_mode,
          },
          apiClient,
        );
        trackMultiNodesAction({ type: "schema_diff", selected: "none" });
      }

      if (check) {
        await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
        navToCheck(check);
      }
    },
    cancel: multiNodeAction.cancel,
    actionState: multiNodeAction.actionState,

    // Column Level Lineage
    centerNode,
    cll,
    showColumnLevelLineage,
    resetColumnLevelLineage,
  };

  if (isLoading) {
    return <LineageViewLoading />;
  }

  if (error) {
    return <LineageViewError error={error} onRetry={refetchLineageGraph} />;
  }

  if (!lineageGraph || nodes == initialNodes) {
    return <></>;
  }

  if (viewMode === "changed_models" && !lineageGraph.modifiedSet.length) {
    return (
      <LineageViewNoChanges
        viewOptions={viewOptions}
        onViewOptionsChanged={handleViewOptionsChanged}
      />
    );
  }
  return (
    <LineageViewContext.Provider value={contextValue}>
      {/* Constant props to avoid react-split destroy/recreate.
           minSize={0} (was 400) lets users drag the panel smaller; the default
           snapOffset (30px) prevents it from reaching 0px in practice. */}
      <HSplit
        sizes={focusedNode ? [70, 30] : [100, 0]}
        minSize={0}
        gutterSize={5}
        className={focusedNode ? undefined : "split-gutter-hidden"}
        style={{ height: "100%", width: "100%" }}
      >
        <Stack
          ref={refResize}
          divider={<Divider sx={{ borderColor: "grey.200" }} />}
          spacing={0}
          sx={{ contain: "strict", position: "relative" }}
        >
          {interactive && (
            <>
              <LineageViewTopBar />
              {featureToggles.mode === "metadata only" && (
                <SetupConnectionBanner />
              )}
            </>
          )}
          <ReactFlow
            proOptions={{
              hideAttribution: true,
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onClick={closeContextMenu}
            onInit={async () => {
              if (isModelsChanged) {
                const changedNodes = nodes.filter(
                  (n) =>
                    isLineageGraphNode(n) && n.data.changeStatus !== undefined,
                );
                const fitTarget =
                  changedNodes.length > 0 ? changedNodes : nodes;
                await reactFlow.fitView({
                  nodes: fitTarget,
                  duration: 200,
                  padding: FIT_VIEW_PADDING,
                  minZoom: LEGIBLE_MIN_ZOOM,
                  maxZoom: 1,
                });
              } else {
                const bounds = getNodesBounds(nodes, {});
                await reactFlow.setCenter(
                  bounds.x + bounds.width / 2,
                  bounds.y + bounds.height / 2,
                  {
                    zoom: 1,
                  },
                );
              }
            }}
            maxZoom={1}
            minZoom={EXPLORE_MIN_ZOOM}
            nodesDraggable={interactive}
            ref={refReactFlow as unknown as Ref<HTMLDivElement>}
            colorMode={isDark ? "dark" : "light"}
          >
            <Background
              id="lineage-bg"
              variant={BackgroundVariant.Dots}
              color={isDark ? colors.neutral[700] : colors.neutral[300]}
              gap={20}
              size={2}
            />
            <Controls
              showInteractive={false}
              position="top-right"
              className={IGNORE_SCREENSHOT_CLASS}
              style={{
                backgroundColor: isDark ? colors.neutral[700] : undefined,
                borderColor: isDark ? colors.neutral[600] : undefined,
              }}
            >
              <ControlButton
                title="copy image"
                onClick={async () => {
                  await copyToClipboard();
                  trackCopyToClipboard({
                    type: viewMode,
                    from: "lineage_view",
                  });
                }}
                style={{
                  backgroundColor: isDark ? colors.neutral[700] : undefined,
                  color: isDark ? colors.neutral[200] : undefined,
                }}
              >
                <Box component={FiCopy} />
              </ControlButton>
            </Controls>
            <ImageDownloadModal />
            <Panel position="bottom-left">
              <Stack spacing="5px">
                {isModelsChanged && (
                  <LineageLegend
                    variant="changeStatus"
                    newCllExperience={newCllExperience}
                  />
                )}
                {viewOptions.column_level_lineage && (
                  <LineageLegend variant="transformation" />
                )}
              </Stack>
            </Panel>
            <Panel position="top-center">
              <LineageViewNotification
                notification={
                  singleEnv ? <BaseEnvironmentSetupNotification /> : null
                }
                type={"info"}
              />
            </Panel>
            <Panel position="top-left">
              <Stack spacing="5px">
                <ColumnLevelLineageControlOss action={actionGetCll} />
                {nodes.length == 0 && (
                  <Typography
                    sx={{ fontSize: "1.25rem", color: "grey", opacity: 0.5 }}
                  >
                    No nodes
                  </Typography>
                )}
              </Stack>
            </Panel>
            {nodes.length <= MINIMAP_NODE_THRESHOLD && (
              <MiniMap
                nodeColor={getNodeColor}
                nodeStrokeWidth={3}
                zoomable
                pannable
                bgColor={isDark ? colors.neutral[800] : undefined}
                maskColor={
                  isDark
                    ? `${colors.neutral[900]}99`
                    : `${colors.neutral[100]}99`
                }
              />
            )}
            {selectMode === "action_result" && (
              <Panel
                position="bottom-center"
                className={IGNORE_SCREENSHOT_CLASS}
              >
                <ActionControlOss
                  onClose={() => {
                    deselect();
                  }}
                />
              </Panel>
            )}
          </ReactFlow>
          <LineageViewContextMenu {...lineageViewContextMenu.props} />
        </Stack>
        {focusedNode ? (
          <Box
            sx={{
              borderLeft: "solid 1px",
              borderColor: "divider",
              height: "100%",
            }}
          >
            <NodeView
              node={focusedNode}
              onCloseNode={onNodeViewClosed}
              onNavigateToNode={navigateToNode}
              onBack={focusedHistory.length > 0 ? navigateBack : undefined}
              onCenterFocused={centerFocusedNode}
              historyTrail={focusedHistory}
              onJumpToHistory={navigateToHistoryIndex}
            />
          </Box>
        ) : (
          <Box></Box>
        )}
      </HSplit>
      {valueDiffAlertDialog.AlertDialog}
    </LineageViewContext.Provider>
  );
}

export const LineageViewOss = forwardRef<LineageViewRef, LineageViewProps>(
  PrivateLineageView,
);
