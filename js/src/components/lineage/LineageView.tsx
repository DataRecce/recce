import {
  LineageGraphNode,
  NodeColumnSetMap,
  layout,
  selectDownstream,
  selectUpstream,
  toReactFlow,
} from "./lineage";
import {
  Box,
  Flex,
  Icon,
  Text,
  Spinner,
  Button,
  VStack,
  Center,
  StackSeparator,
} from "@chakra-ui/react";
import React, {
  Ref,
  RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import ReactFlow, {
  Node,
  useEdgesState,
  useNodesState,
  Controls,
  MiniMap,
  Panel,
  Background,
  ControlButton,
  useReactFlow,
  getNodesBounds,
  NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { GraphNode } from "./GraphNode";
import GraphEdge from "./GraphEdge";
import { getIconForChangeStatus } from "./styles";
import { FiCopy } from "react-icons/fi";
import { NodeView } from "./NodeView";

import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";

import { ActionControl } from "./ActionControl";
import { LineageViewTopBar } from "./LineageViewTopBar";
import { IGNORE_SCREENSHOT_CLASS, useCopyToClipboard } from "@/lib/hooks/ScreenShot";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";

import { union } from "./graph";
import { createLineageDiffCheck, LineageDiffViewOptions } from "@/lib/api/lineagecheck";
import { ChangeStatusLegend } from "./ChangeStatusLegend";
import { HSplit } from "../split/Split";
import { select } from "@/lib/api/select";
import { AxiosError } from "axios";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { LineageViewContext, LineageViewContextType } from "./LineageViewContext";
import { useMultiNodesAction } from "./useMultiNodesAction";
import { createSchemaDiffCheck } from "@/lib/api/schemacheck";
import { useLocation } from "wouter";
import { Check } from "@/lib/api/checks";
import useValueDiffAlertDialog from "./useValueDiffAlertDialog";
import { trackMultiNodesAction, trackCopyToClipboard } from "@/lib/api/track";
import { PresetCheckRecommendation } from "./PresetCheckRecommendation";
import { useRun } from "@/lib/hooks/useRun";
import { GraphColumnNode } from "./GraphColumnNode";
import { ColumnLevelLineageControl } from "./ColumnLevelLineageControl";
import { ColumnLevelLineageLegend } from "./ColumnLevelLineageLegend";
import { LineageViewNotification } from "./LineageViewNotification";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { BaseEnvironmentSetupNotification } from "./SingleEnvironmentQueryView";
import { CllInput, ColumnLineageData, getCll } from "@/lib/api/cll";
import { LineageViewContextMenu, useLineageViewContextMenu } from "./LineageViewContextMenu";
import { toaster } from "@/components/ui/toaster";
import { useMutation } from "@tanstack/react-query";

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

const nodeTypes = {
  customNode: GraphNode,
  customColumnNode: GraphColumnNode,
};
const initialNodes: Node<LineageGraphNode>[] = [];
const edgeTypes = {
  customEdge: GraphEdge,
};
const nodeColor = (node: Node<LineageGraphNode>) => {
  return node.data.changeStatus
    ? getIconForChangeStatus(node.data.changeStatus).hexColor
    : ("lightgray" as string);
};

const useResizeObserver = (ref: RefObject<HTMLElement | null>, handler: () => void) => {
  const target = ref.current;
  const size = useRef({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;

        if (
          Math.abs(newHeight - size.current.height) > 10 ||
          Math.abs(newWidth - size.current.width) > 10
        ) {
          if (size.current.height > 0 && newHeight > 0 && size.current.width > 0 && newWidth > 0) {
            handler();
          }
        }
        size.current = {
          width: newWidth,
          height: newHeight,
        };
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);

    if (target) {
      resizeObserver.observe(target);
    }

    return () => {
      if (target) {
        resizeObserver.unobserve(target);
      }
    };
  }, [target, size, handler]);
};

const useNavToCheck = () => {
  const [, setLocation] = useLocation();
  const navToCheck = useCallback(
    (check: Check) => {
      if (check.check_id) {
        setLocation(`/checks/${check.check_id}`);
      }
    },
    [setLocation],
  );
  return navToCheck;
};

export function PrivateLineageView(
  { interactive = false, ...props }: LineageViewProps,
  ref: Ref<LineageViewRef>,
) {
  const reactFlow = useReactFlow();
  const refResize = useRef<HTMLDivElement>(null);
  const { successToast, failToast } = useClipBoardToast();
  const {
    copyToClipboard,
    ImageDownloadModal,
    ref: refReactFlow,
  } = useCopyToClipboard({
    renderLibrary: "html-to-image",
    imageType: "png",
    shadowEffect: true,
    backgroundColor: "white",
    ignoreElements: (element: Element) => {
      return element.className.includes(IGNORE_SCREENSHOT_CLASS);
    },
    onSuccess: () => {
      successToast("Copied the Lineage View as an image to clipboard");
    },
    onError: (error) => {
      console.error("Error taking screenshot", error);
      failToast("Failed to copy image to clipboard", error);
    },
  });
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { lineageGraph, retchLineageGraph, isLoading, error, refetchRunsAggregated } =
    useLineageGraphContext();

  const { data: flagData } = useRecceServerFlag();
  const { runId, showRunId, closeRunResult, runAction, isRunResultOpen } = useRecceActionContext();
  const { run } = useRun(runId);

  const [viewOptions, setViewOptions] = useState<LineageDiffViewOptions>({
    ...props.viewOptions,
  });

  const cllHistory = useRef<(CllInput | undefined)[]>([]).current;

  const [cll, setCll] = useState<ColumnLineageData | undefined>(undefined);
  const actionGetCll = useMutation({
    mutationFn: getCll,
  });
  const [nodeColumnSetMap, setNodeColumSetMap] = useState<NodeColumnSetMap>({});

  const findNodeByName = (name: string) => {
    return nodes.find((n) => n.data.name === name);
  };

  // Expose the function to the parent via the ref
  useImperativeHandle(ref, () => ({
    copyToClipboard,
  }));

  const isModelsChanged = useMemo(() => {
    return lineageGraph && lineageGraph.modifiedSet.length > 0 ? true : false;
  }, [lineageGraph]);

  /**
   * View mode
   * - all: show all nodes
   * - changed_models: show only changed models
   */
  const viewMode = viewOptions.view_mode ?? "changed_models";
  const filteredNodeIds: string[] = useMemo(() => {
    return nodes.filter((node) => node.type === "customNode").map((node) => node.id);
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
  const focusedNode = focusedNodeId ? lineageGraph?.nodes[focusedNodeId] : undefined;

  /**
   * Select mode: the behavior of clicking on nodes
   * - (undefined): no selection
   * - selecting: selecting nodes
   * - action_result: take action on selected nodes
   */
  const [selectMode, setSelectMode] = useState<"selecting" | "action_result">();
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
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
      onActionCompleted: () => {},
    },
  );

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
      highlightedModels = selectDownstream(lineageGraph, lineageGraph.modifiedSet);
    } else {
      highlightedModels = new Set(filteredNodeIds);
    }

    // Add columns in the highlighted models
    const resultSet = new Set<string>(highlightedModels);
    return resultSet;
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
        const viewMode = viewOptions.view_mode ?? (isModelsChanged ? "changed_models" : "all");

        const newViewOptions: LineageDiffViewOptions = {
          view_mode: viewMode,
          packages: packageName ? [packageName] : undefined,
          ...props.viewOptions,
        };

        try {
          const result = await select({
            select: newViewOptions.select,
            exclude: newViewOptions.exclude,
            packages: newViewOptions.packages,
            view_mode: newViewOptions.view_mode,
          });
          filteredNodeIds = result.nodes;
        } catch (_) {
          // fallback behavior
          newViewOptions.view_mode = "all";
          const result = await select({
            select: newViewOptions.select,
            exclude: newViewOptions.exclude,
            packages: newViewOptions.packages,
            view_mode: newViewOptions.view_mode,
          });
          filteredNodeIds = result.nodes;
        }

        setViewOptions(newViewOptions);
      }

      let cll: ColumnLineageData | undefined;
      if (viewOptions.column_level_lineage) {
        try {
          cll = await actionGetCll.mutateAsync(viewOptions.column_level_lineage);
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

      const [nodes, edges, nodeColumnSetMap] = toReactFlow(lineageGraph, {
        selectedNodes: filteredNodeIds,
        cll: cll,
      });
      layout(nodes, edges);
      setNodes(nodes);
      setEdges(edges);
      setNodeColumSetMap(nodeColumnSetMap);
      setCll(cll);
    };

    void t();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineageGraph]);

  const onNodeViewClosed = () => {
    setFocusedNodeId(undefined);
  };

  const centerNode = (nodeId: string) => {
    let node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }

    if (node.parentId) {
      const parentId = node.parentId;
      node = nodes.find((n) => n.id === parentId) ?? node;
    }

    if (node.width && node.height) {
      const x = node.position.x + node.width / 2;
      const y = node.position.y + node.height / 2;
      const zoom = reactFlow.getZoom();

      reactFlow.setCenter(x, y, { zoom, duration: 200 });
    }
  };

  const navToCheck = useNavToCheck();

  useResizeObserver(refResize, () => {
    if (selectMode !== "selecting") {
      if (!focusedNodeId) {
        reactFlow.fitView({ nodes, duration: 200 });
      } else {
        centerNode(focusedNodeId);
      }
    }
  });

  const showColumnLevelLineage = async (columnLevelLineage?: CllInput, previous = false) => {
    const previousColumnLevelLineage = viewOptions.column_level_lineage;

    await handleViewOptionsChanged(
      {
        ...viewOptions,
        column_level_lineage: columnLevelLineage,
      },
      false,
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

  const onColumnNodeClick = (event: React.MouseEvent, node: Node) => {
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

    if (node.type === "customColumnNode") {
      onColumnNodeClick(event, node);
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
  }) => {
    const { viewOptions: newViewOptions = viewOptions, fitView } = options;

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
        const result = await select({
          select: newViewOptions.select,
          exclude: newViewOptions.exclude,
          packages: newViewOptions.packages,
          view_mode: newViewOptions.view_mode,
        });
        // focus to unfocus the model or column node
        newViewOptions.column_level_lineage = undefined;
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
        cll = await actionGetCll.mutateAsync(newViewOptions.column_level_lineage);
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

    const [newNodes, newEdges, newNodeColumnSetMap] = toReactFlow(lineageGraph, {
      selectedNodes,
      cll,
    });
    setNodes(newNodes);
    setEdges(newEdges);
    setNodeColumSetMap(newNodeColumnSetMap);
    setCll(cll);

    // Close the run result view if the run result node is not in the new nodes
    if (run?.params?.model && !findNodeByName(run.params.model)) {
      closeRunResult();
    }

    if (fitView) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      (() => {
        reactFlow.fitView({ nodes: newNodes, duration: 200 });
      })();
    }
  };

  const handleViewOptionsChanged = async (
    newViewOptions: LineageDiffViewOptions,
    fitView = true,
  ) => {
    setViewOptions(newViewOptions);
    await refreshLayout({
      viewOptions: newViewOptions,
      fitView,
    });
  };

  const handleBreakingChangeEnabledChanged = async (enabled: boolean) => {};

  const valueDiffAlertDialog = useValueDiffAlertDialog();

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
    if (!runResultType || ["query_diff", "query", "row_count"].includes(runResultType)) {
      // Skip the following logic if the run result type is not related to a node
      return;
    }

    if (!selectMode) {
      // Skip the following logic if the select mode is not single
      const selectedRunModel = run.params?.model;
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
        } else if (focusedNode !== node.data) {
          // Only select the node if it is not already selected
          onNodeClick(mockEvent, node);
        }
      } else {
        // If the run result is not related to a node, close the NodeView
        onNodeViewClosed();
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, viewOptions, isRunResultOpen, selectMode]);

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

  const closeContextMenu = () => {
    lineageViewContextMenu.closeContextMenu();
  };

  const onNodeContextMenu = (event: React.MouseEvent, node: Node | NodeProps) => {
    if (!interactive) {
      return;
    }
    if (selectMode === "action_result") {
      return;
    }
    // Only show context menu when selectMode is action
    // Prevent native context menu from showing
    event.preventDefault();
    const reactFlowDiv = refReactFlow.current as HTMLDivElement;
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

      const node = nodeId in lineageGraph.nodes ? lineageGraph.nodes[nodeId] : undefined;

      if (viewOptions.column_level_lineage?.change_analysis) {
        const cll = viewOptions.column_level_lineage;

        if (cll.node_id && !cll.column) {
          return cll.node_id === nodeId && !!node?.changeStatus;
        } else {
          return !!node?.changeStatus;
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
          { node_names: [focusedNode.name] },
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
          { node_names: [focusedNode.name] },
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
            model: focusedNode.name,
          },
          { showForm: true, showLast: false },
        );
        trackMultiNodesAction({ type: "value_diff", selected: "single" });
      } else {
        const nodeCount =
          selectMode === "selecting" ? selectedNodes.length : filteredNodeIds.length;
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
      let check: Check | undefined = undefined;
      if (selectMode === "selecting") {
        check = await multiNodeAction.addLineageDiffCheck();
        deselect();
        trackMultiNodesAction({ type: "lineage_diff", selected: "multi" });
      } else if (!focusedNode) {
        check = await createLineageDiffCheck(viewOptions);
        trackMultiNodesAction({ type: "lineage_diff", selected: "none" });
      }

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
        check = await createSchemaDiffCheck({
          node_id: focusedNode.id,
        });
        trackMultiNodesAction({ type: "schema_diff", selected: "single" });
      } else {
        check = await createSchemaDiffCheck({
          select: viewOptions.select,
          exclude: viewOptions.exclude,
          packages: viewOptions.packages,
          view_mode: viewOptions.view_mode,
        });
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
    return (
      <Flex width="100%" height="100%" alignItems="center" justifyContent="center">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Center h="100%">
        <VStack>
          <Box>
            Failed to load lineage data. This could be because the server has been terminated or
            there is a network error.
          </Box>
          <Box>[Reason: {error}]</Box>
          <Button
            colorPalette="blue"
            onClick={() => {
              if (retchLineageGraph) {
                retchLineageGraph();
              }
            }}>
            Retry
          </Button>
        </VStack>
      </Center>
    );
  }

  if (!lineageGraph || nodes == initialNodes) {
    return <></>;
  }

  if (viewMode === "changed_models" && !lineageGraph.modifiedSet.length) {
    return (
      <Center h="100%">
        <VStack>
          <>No change detected</>
          <Button
            colorPalette="blue"
            onClick={async () => {
              await handleViewOptionsChanged({
                ...viewOptions,
                view_mode: "all",
              });
            }}>
            Show all nodes
          </Button>
        </VStack>
      </Center>
    );
  }
  return (
    <LineageViewContext.Provider value={contextValue}>
      <HSplit
        sizes={focusedNode ? [70, 30] : [100, 0]}
        minSize={focusedNode ? 400 : 0}
        gutterSize={focusedNode ? 5 : 0}
        style={{ height: "100%", width: "100%" }}>
        <VStack
          ref={refResize}
          separator={<StackSeparator borderColor="gray.200" />}
          gap={0}
          style={{ contain: "strict" }}
          position="relative">
          {interactive && (
            <>
              <LineageViewTopBar />
              <PresetCheckRecommendation />
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
            onInit={() => {
              if (isModelsChanged) {
                reactFlow.fitView();
              } else {
                const bounds = getNodesBounds(nodes);
                reactFlow.setCenter(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, {
                  zoom: 1,
                });
              }
            }}
            maxZoom={1}
            minZoom={0.1}
            nodesDraggable={interactive}
            ref={refReactFlow}>
            <Background color="#ccc" />
            <Controls
              showInteractive={false}
              position="top-right"
              className={IGNORE_SCREENSHOT_CLASS}>
              <ControlButton
                title="copy image"
                onClick={async () => {
                  await copyToClipboard();
                  trackCopyToClipboard({ type: viewMode, from: "lineage_view" });
                }}>
                <Icon as={FiCopy} />
              </ControlButton>
            </Controls>
            <ImageDownloadModal />
            <Panel position="bottom-left">
              <Flex direction="column" gap="5px">
                {isModelsChanged && <ChangeStatusLegend />}
                {viewOptions.column_level_lineage && <ColumnLevelLineageLegend />}
              </Flex>
            </Panel>
            <Panel position="top-center">
              <LineageViewNotification
                notification={
                  flagData?.single_env_onboarding ? <BaseEnvironmentSetupNotification /> : null
                }
                type={"info"}
              />
            </Panel>
            <Panel position="top-left">
              <Flex direction="column" gap="5px">
                <ColumnLevelLineageControl action={actionGetCll} />
                {nodes.length == 0 && (
                  <Text fontSize="xl" color="grey" opacity={0.5}>
                    No nodes
                  </Text>
                )}
              </Flex>
            </Panel>
            <MiniMap nodeColor={nodeColor} nodeStrokeWidth={3} zoomable pannable />
            {selectMode === "action_result" && (
              <Panel position="bottom-center" className={IGNORE_SCREENSHOT_CLASS}>
                <ActionControl
                  onClose={() => {
                    deselect();
                  }}
                />
              </Panel>
            )}
          </ReactFlow>
          <LineageViewContextMenu {...lineageViewContextMenu.props} />
        </VStack>
        {focusedNode ? (
          <Box borderLeft="solid 1px lightgray" height="100%">
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

export const LineageView = forwardRef<LineageViewRef, LineageViewProps>(PrivateLineageView);
