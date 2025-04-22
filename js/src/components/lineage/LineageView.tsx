import {
  LineageGraphNode,
  NodeColumnSetMap,
  layout,
  selectDownstream,
  selectUpstream,
  toReactflow,
} from "./lineage";
import {
  Box,
  Flex,
  Icon,
  Text,
  Spinner,
  Button,
  VStack,
  Menu,
  MenuList,
  MenuItem,
  Center,
  StackDivider,
  useToast,
  MenuDivider,
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
} from "reactflow";
import "reactflow/dist/style.css";
import { GraphNode } from "./GraphNode";
import GraphEdge from "./GraphEdge";
import { getIconForChangeStatus } from "./styles";
import { FiCopy } from "react-icons/fi";
import { BiArrowFromBottom, BiArrowToBottom } from "react-icons/bi";
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
import {
  trackBreakingChange,
  trackMultiNodesAction,
  trackColumnLevelLineage,
} from "@/lib/api/track";
import { PresetCheckRecommendation } from "./PresetCheckRecommendation";
import { BreakingChangeSwitch } from "./BreakingChangeSwitch";
import { useRun } from "@/lib/hooks/useRun";
import { GraphColumnNode } from "./GraphColumnNode";
import { ColumnLevelLineageControl } from "./ColumnLevelLineageControl";
import { ColumnLevelLineageLegend } from "./ColumnLevelLineageLegend";
import { LineageViewNotification } from "./LineageViewNotification";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { BaseEnvironmentSetupNotification } from "./SingleEnvironmentQueryView";
import { ColumnLineageData, getCll } from "@/lib/api/cll";

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
    ? getIconForChangeStatus(node.data.changeStatus).color
    : ("lightgray" as string);
};

const useResizeObserver = (ref: RefObject<HTMLElement>, handler: () => void) => {
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
      const className = element.className;
      if (typeof className === "string" && className.includes(IGNORE_SCREENSHOT_CLASS)) {
        return true;
      }
      return false;
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
   * Breaking Change and Column Level Lineage
   */
  const [breakingChangeEnabled, setBreakingChangeEnabled] = useState(false);
  const [nodeColumnSetMap, setNodeColumnSetMap] = useState<NodeColumnSetMap>();

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

    if (selectMode === "action_result") {
      const nodeIds = Object.keys(multiNodeAction.actionState.actions);
      return new Set(nodeIds);
    }

    if (viewOptions.column_level_lineage && nodeColumnSetMap) {
      const nodeIds = Object.entries(nodeColumnSetMap)
        .filter(([_, columnSet]) => {
          return columnSet.size > 0;
        })
        .map(([nodeId, _]) => {
          return nodeId;
        });
      return new Set(nodeIds);
    }

    if (focusedNode) {
      return union(
        selectUpstream(lineageGraph, [focusedNode.id]),
        selectDownstream(lineageGraph, [focusedNode.id]),
      );
    }

    if (isModelsChanged) {
      if (!breakingChangeEnabled) {
        return selectDownstream(lineageGraph, lineageGraph.modifiedSet);
      } else {
        return lineageGraph.impactedSet;
      }
    } else {
      return new Set(filteredNodeIds);
    }
  }, [
    lineageGraph,
    selectMode,
    viewOptions.column_level_lineage,
    nodeColumnSetMap,
    focusedNode,
    isModelsChanged,
    multiNodeAction.actionState.actions,
    breakingChangeEnabled,
    filteredNodeIds,
  ]);

  const [isContextMenuRendered, setIsContextMenuRendered] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
    selectedNode?: Node;
  }>({ x: 0, y: 0 });

  const toast = useToast();

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
        setViewOptions(newViewOptions);
        setNodeColumnSetMap(undefined);

        const result = await select({
          select: newViewOptions.select,
          exclude: newViewOptions.exclude,
          packages: newViewOptions.packages,
          view_mode: newViewOptions.view_mode,
        });
        filteredNodeIds = result.nodes;
      }

      // const [nodes, edges, nodeColumnSetMap] = toReactflow(lineageGraph, filteredNodeIds);
      const [nodes, edges, nodeColumnSetMap] = toReactflow(lineageGraph, {
        selectedNodes: filteredNodeIds,
        breakingChangeEnabled,
      });
      layout(nodes, edges);
      setNodes(nodes);
      setEdges(edges);
      setNodeColumnSetMap(nodeColumnSetMap);
    };

    void t();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineageGraph]);

  const onNodeViewClosed = () => {
    setFocusedNodeId(undefined);
  };

  const centerNode = (node: Node) => {
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
      const node = nodes.find((node) => node.id === focusedNodeId);
      if (node) {
        centerNode(node);
      } else {
        reactFlow.fitView({ nodes, duration: 200 });
      }
    }
  });

  const onColumnNodeClick = (event: React.MouseEvent, node: Node) => {
    if (selectMode) {
      return;
    }

    if (!viewOptions.column_level_lineage) {
      trackColumnLevelLineage({ action: "view", source: "changed_column" });
    } else {
      trackColumnLevelLineage({ action: "view", source: "cll_column" });
    }

    // change focused node if the side pane is open
    if (focusedNodeId) {
      setFocusedNodeId(node.parentId);
    }

    void handleViewOptionsChanged(
      {
        ...viewOptions,
        column_level_lineage: {
          node: node.data.node.id,
          column: node.data.column,
        },
      },
      false,
    );
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
    breakingChangeEnabled?: boolean;
    fitView?: boolean;
  }) => {
    const {
      breakingChangeEnabled: newBreakingChangeEnabled = breakingChangeEnabled,
      viewOptions: newViewOptions = viewOptions,
      fitView,
    } = options;

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
          toast({
            title: "Select node error",
            description: e2.response?.data.detail ?? e.message,
            status: "error",
            isClosable: true,
            position: "bottom-right",
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
        const cllResult = await getCll(
          newViewOptions.column_level_lineage.node,
          newViewOptions.column_level_lineage.column,
        );
        cll = cllResult;
      } catch (e) {
        if (e instanceof AxiosError) {
          const e2 = e as AxiosError<{ detail?: string }>;
          toast({
            title: "Column Level Lineage error",
            description: e2.response?.data.detail ?? e.message,
            status: "error",
            isClosable: true,
            position: "bottom-right",
          });
          return;
        }
      }
    }

    const [newNodes, newEdges, newNodeColumnSetMap] = toReactflow(lineageGraph, {
      selectedNodes,
      columnLevelLineage: newViewOptions.column_level_lineage,
      cll,
      breakingChangeEnabled: newBreakingChangeEnabled,
    });
    setNodes(newNodes);
    setEdges(newEdges);
    setNodeColumnSetMap(newNodeColumnSetMap);

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

  const handleBreakingChangeEnabledChanged = async (enabled: boolean) => {
    setBreakingChangeEnabled(enabled);
    setFocusedNodeId(undefined);
    await refreshLayout({
      breakingChangeEnabled: enabled,
    });
    trackBreakingChange({ enabled });
  };

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

  const selectParentNodes = (degree = 1000) => {
    const selectedNode = contextMenuPosition.selectedNode;
    if (selectMode === "action_result" || selectedNode === undefined || lineageGraph === undefined)
      return;

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

    const selectedNodeId = selectedNode.id;
    const upstream = selectUpstream(lineageGraph, [selectedNodeId], degree);
    setSelectedNodeIds(union(selectedNodeIds, upstream));
  };

  const selectChildNodes = (degree = 1000) => {
    const selectedNode = contextMenuPosition.selectedNode;
    if (selectMode === "action_result" || selectedNode === undefined || lineageGraph === undefined)
      return;

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

    const selectedNodeId = selectedNode.id;
    const downstream = selectDownstream(lineageGraph, [selectedNodeId], degree);
    setSelectedNodeIds(union(selectedNodeIds, downstream));
  };

  const closeContextMenu = () => {
    setIsContextMenuRendered(false);
    setContextMenuPosition({ x: 0, y: 0 });
  };

  const onNodeContextMenu = (event: React.MouseEvent, node: Node) => {
    if (!interactive) {
      return;
    }
    if (selectMode === "action_result") {
      return;
    }
    // Only show context menu when selectMode is action
    // Prevent native context menu from showing
    event.preventDefault();
    const pane = (refReactFlow.current as any).getBoundingClientRect();
    const offsetTop = (refReactFlow.current as any).offsetTop as number;
    setContextMenuPosition({
      x: event.clientX - pane.left,
      y: event.clientY - pane.top + offsetTop,
      selectedNode: node,
    });
    setIsContextMenuRendered(true);
  };

  const selectNode = (nodeId: string) => {
    if (!selectMode) {
      if (!lineageGraph) {
        return;
      }

      setSelectedNodeIds(new Set([nodeId]));
      setSelectMode("selecting");
      setFocusedNodeId(undefined);
      if (viewOptions.column_level_lineage) {
        void handleViewOptionsChanged({
          ...viewOptions,
          column_level_lineage: undefined,
        });
      }
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
    onViewOptionsChanged: handleViewOptionsChanged,
    selectMode,
    selectNode,
    deselect,
    breakingChangeEnabled,
    setBreakingChangeEnabled,
    isNodeHighlighted: (nodeId: string) => highlighted.has(nodeId),
    isNodeSelected: (nodeId: string) => selectedNodeIds.has(nodeId),
    isEdgeHighlighted: (source, target) => {
      if (viewOptions.column_level_lineage) {
        return false;
      }

      return highlighted.has(source) && highlighted.has(target);
    },
    getNodeAction: (nodeId: string) => {
      return multiNodeAction.actionState.actions[nodeId];
    },
    getNodeColumnSet: (nodeId: string) => {
      if (!nodeColumnSetMap) {
        return new Set();
      }

      return nodeColumnSetMap[nodeId] ?? new Set();
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
    showColumnLevelLineage: async (nodeId: string, column: string) => {
      await handleViewOptionsChanged(
        {
          ...viewOptions,
          column_level_lineage: { node: nodeId, column },
        },
        false,
      );
      setFocusedNodeId(nodeId);
    },
    resetColumnLevelLinage: () => {
      setFocusedNodeId(undefined);
      void handleViewOptionsChanged(
        {
          ...viewOptions,
          column_level_lineage: undefined,
        },
        false,
      );
    },
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
            colorScheme="blue"
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
            colorScheme="blue"
            onClick={async () => {
              await handleViewOptionsChanged({ ...viewOptions, view_mode: "all" });
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
          divider={<StackDivider borderColor="gray.200" />}
          spacing={0}
          style={{ contain: "strict" }}
          position="relative">
          {interactive && (
            <>
              <LineageViewTopBar />
              <PresetCheckRecommendation />
            </>
          )}
          <ReactFlow
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
                <BreakingChangeSwitch
                  enabled={breakingChangeEnabled}
                  onChanged={handleBreakingChangeEnabledChanged}
                />
                {viewOptions.column_level_lineage && (
                  <ColumnLevelLineageControl
                    node={viewOptions.column_level_lineage.node}
                    column={viewOptions.column_level_lineage.column}
                    reset={() => {
                      setFocusedNodeId(undefined);
                      void handleViewOptionsChanged({
                        ...viewOptions,
                        column_level_lineage: undefined,
                      });
                    }}
                  />
                )}
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
          {isContextMenuRendered && (
            // Only render context menu when select mode is action
            <Menu isOpen={true} onClose={closeContextMenu}>
              <MenuList
                fontSize="11pt"
                position="absolute"
                width="250px"
                style={{
                  left: `${contextMenuPosition.x}px`,
                  top: `${contextMenuPosition.y}px`,
                }}>
                <MenuItem
                  icon={<BiArrowFromBottom />}
                  onClick={() => {
                    selectParentNodes(1);
                  }}>
                  Select parent nodes
                </MenuItem>
                <MenuItem
                  icon={<BiArrowToBottom />}
                  onClick={() => {
                    selectChildNodes(1);
                  }}>
                  Select child nodes
                </MenuItem>
                <MenuDivider></MenuDivider>
                <MenuItem
                  icon={<BiArrowFromBottom />}
                  onClick={() => {
                    selectParentNodes();
                  }}>
                  Select all upstream nodes
                </MenuItem>
                <MenuItem
                  icon={<BiArrowToBottom />}
                  onClick={() => {
                    selectChildNodes();
                  }}>
                  Select all downstream nodes
                </MenuItem>
              </MenuList>
            </Menu>
          )}
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
