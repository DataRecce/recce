"use client";

import type { Check } from "../../api";
import {
  type CllInput,
  type ColumnLineageData,
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
} from "../../contexts";
import {
  isLineageGraphColumnNode,
  isLineageGraphNode,
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
import { useMutation } from "@tanstack/react-query";
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
import { AxiosError } from "axios";
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
import { colors } from "../../theme";
import { LineageViewNotification } from "../notifications";
import { HSplit, toaster } from "../ui";
import { ActionControlOss } from "./ActionControlOss";
import { ColumnLevelLineageControlOss } from "./ColumnLevelLineageControlOss";
import { edgeTypes, getNodeColor, initialNodes, nodeTypes } from "./config";
import {
  useLineageCopyToClipboard,
  useNavToCheck,
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
import SetupConnectionBanner from "./SetupConnectionBannerOss";
import { BaseEnvironmentSetupNotification } from "./SingleEnvironmentQueryView";
import {
  LineageViewError,
  LineageViewLoading,
  LineageViewNoChanges,
} from "./states";
import { LineageViewTopBarOss as LineageViewTopBar } from "./topbar/LineageViewTopBarOss";

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

export function PrivateLineageView(
  { interactive = false, ...props }: LineageViewProps,
  ref: Ref<LineageViewRef>,
) {
  const { isDark } = useThemeColors();
  const { apiClient } = useApiConfig();
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
    retchLineageGraph,
    isLoading,
    error,
    refetchRunsAggregated,
  } = useLineageGraphContext();

  const { featureToggles, singleEnv } = useRecceInstanceContext();
  const { runId, showRunId, closeRunResult, runAction, isRunResultOpen } =
    useRecceActionContext();
  const { run } = useRun(runId);

  const [viewOptions, setViewOptions] = useState<LineageDiffViewOptions>({
    ...props.viewOptions,
  });

  const trackLineageRender = useTrackLineageRender();

  const cllHistory = useRef<(CllInput | undefined)[]>([]).current;

  const [cll, setCll] = useState<ColumnLineageData | undefined>(undefined);
  const actionGetCll = useMutation({
    mutationFn: (input: CllInput) => getCll(input, apiClient),
  });
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
   * This fixes DRC-2623 where clicking between columns caused graph reflow
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
   * Highlighted nodes: the nodes that are highlighted. The behavior of highlighting depends on the select mode
   *
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

      let cll: ColumnLineageData | undefined;
      if (viewOptions.column_level_lineage) {
        try {
          cll = await actionGetCll.mutateAsync(
            viewOptions.column_level_lineage,
          );
        } catch (e) {
          if (e instanceof AxiosError) {
            const e2 = e as AxiosError<{ detail?: string }>;
            toaster.create({
              title: "Column Level Lineage error",
              description: e2.response?.data.detail ?? e.message,
              type: "error",
              closable: true,
            });
            return;
          }
        }
      }

      const [nodes, edges, nodeColumnSetMap] = await toReactFlow(lineageGraph, {
        selectedNodes: filteredNodeIds,
        cll: cll,
      });
      setNodes(nodes);
      setEdges(edges);
      setNodeColumSetMap(nodeColumnSetMap);
      setCll(cll);

      // TODO : code smell: vioates DRY. This really shouldn't hit both here and below

      // Track lineage view render
      trackLineageRender(
        nodes,
        viewOptions.view_mode ?? "changed_models",
        viewOptions.column_level_lineage?.change_analysis ?? false,
        !!viewOptions.column_level_lineage?.column,
        !!focusedNodeId || !!run,
      );
    };

    void t();
    // Intentionally only run when lineageGraph changes (initial load/refetch).
    // viewOptions changes are handled separately by handleViewOptionsChanged.
    // Other dependencies (setNodes, setEdges, actionGetCll) are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineageGraph]);

  const onNodeViewClosed = () => {
    setFocusedNodeId(undefined);
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
        await reactFlow.fitView({ nodes, duration: 200 });
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

    // Preserve positions when:
    // 1. CLL is being turned OFF (previous exists but new one is undefined)
    // 2. Switching between columns (both previous and new have CLL) - DRC-2623 fix
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
    } else {
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
    } else if (selectMode === "action_result") {
      const action = multiNodeAction.actionState.actions[node.id];
      if (action.run?.run_id) {
        showRunId(action.run.run_id);
      }
      setFocusedNodeId(node.id);
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
        if (e instanceof AxiosError) {
          const e2 = e as AxiosError<{ detail?: string }>;
          toaster.create({
            title: "Select node error",
            description: e2.response?.data.detail ?? e.message,
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
        cll = await actionGetCll.mutateAsync(
          newViewOptions.column_level_lineage,
        );
      } catch (e) {
        if (e instanceof AxiosError) {
          const e2 = e as AxiosError<{ detail?: string }>;
          toaster.create({
            title: "Column Level Lineage error",
            description: e2.response?.data.detail ?? e.message,
            type: "error",
            closable: true,
          });
          return;
        }
      }
    }

    // Capture positions if preservePositions is true
    let existingPositions: Map<string, { x: number; y: number }> | undefined;
    if (preservePositions) {
      existingPositions = getNodePositions();
    }

    const [newNodes, newEdges, newNodeColumnSetMap] = await toReactFlow(
      lineageGraph,
      {
        selectedNodes,
        cll,
        existingPositions,
      },
    );
    setNodes(newNodes);
    setEdges(newEdges);
    setNodeColumSetMap(newNodeColumnSetMap);
    setCll(cll);

    // Track lineage view render
    trackLineageRender(
      newNodes,
      newViewOptions.view_mode ?? "changed_models",
      newViewOptions.column_level_lineage?.change_analysis ?? false,
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
        void reactFlow.fitView({ nodes: newNodes, duration: 200 });
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
      ["query_diff", "query", "row_count"].includes(runResultType)
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
        } else if (isLineageGraphNode(node) && focusedNode !== node.data.data) {
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
      if (!lineageGraph) {
        return false;
      }

      const node =
        nodeId in lineageGraph.nodes ? lineageGraph.nodes[nodeId] : undefined;

      if (viewOptions.column_level_lineage?.change_analysis) {
        const cll = viewOptions.column_level_lineage;

        if (cll.node_id && !cll.column) {
          return cll.node_id === nodeId && !!node?.data.changeStatus;
        } else {
          return !!node?.data.changeStatus;
        }
      }

      return false;
    },
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
    return <LineageViewError error={error} onRetry={retchLineageGraph} />;
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
      <HSplit
        sizes={focusedNode ? [70, 30] : [100, 0]}
        minSize={focusedNode ? 400 : 0}
        gutterSize={focusedNode ? 5 : 0}
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
                await reactFlow.fitView();
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
            minZoom={0.1}
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
                {isModelsChanged && <LineageLegend variant="changeStatus" />}
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
            <MiniMap
              nodeColor={getNodeColor}
              nodeStrokeWidth={3}
              zoomable
              pannable
              bgColor={isDark ? colors.neutral[800] : undefined}
              maskColor={
                isDark ? `${colors.neutral[900]}99` : `${colors.neutral[100]}99`
              }
            />
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
            <NodeView node={focusedNode} onCloseNode={onNodeViewClosed} />
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
