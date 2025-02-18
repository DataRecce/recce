import {
  LineageGraphNode,
  cleanUpNodes,
  deselectNodes,
  highlightNodes,
  layout,
  selectAllNodes,
  selectDownstream,
  selectImpactRadius,
  selectNode,
  selectNodes,
  selectSingleNode,
  selectUpstream,
  toReactflow,
} from "./lineage";
import {
  Box,
  Flex,
  Icon,
  Text,
  Spinner,
  HStack,
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
import {
  IGNORE_SCREENSHOT_CLASS,
  useCopyToClipboard,
} from "@/lib/hooks/ScreenShot";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";

import { union } from "./graph";
import {
  createLineageDiffCheck,
  LineageDiffViewOptions,
} from "@/lib/api/lineagecheck";
import { ChangeStatusLegend } from "./ChangeStatusLegend";
import { HSplit } from "../split/Split";
import { select } from "@/lib/api/select";
import { AxiosError } from "axios";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import {
  LineageViewContext,
  LineageViewContextType,
} from "./LineageViewContext";
import { useMultiNodesAction } from "./useMultiNodesAction";
import { createSchemaDiffCheck } from "@/lib/api/schemacheck";
import { useLocation } from "wouter";
import { Check } from "@/lib/api/checks";
import useValueDiffAlertDialog from "./useValueDiffAlertDialog";
import { trackBreakingChange, trackMultiNodesAction } from "@/lib/api/track";
import { PresetCheckRecommendation } from "./PresetCheckRecommendation";
import { BreakingChangeSwitch } from "./BreakingChangeSwitch";

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
};
const edgeTypes = {
  customEdge: GraphEdge,
};
const nodeColor = (node: Node) => {
  return node?.data?.changeStatus
    ? getIconForChangeStatus(node?.data?.changeStatus).color
    : ("lightgray" as string);
};

const useResizeObserver = (
  ref: RefObject<HTMLElement>,
  handler: () => void
) => {
  const target = ref?.current;
  const size = useRef({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (let entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;

        if (
          Math.abs(newHeight - size.current.height) > 10 ||
          Math.abs(newWidth - size.current.width) > 10
        ) {
          if (
            size.current.height > 0 &&
            newHeight > 0 &&
            size.current.width > 0 &&
            newWidth > 0
          ) {
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
    [setLocation]
  );
  return navToCheck;
};

export function PrivateLineageView(
  { interactive = false, ...props }: LineageViewProps,
  ref: Ref<LineageViewRef>
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
      if (
        typeof className === "string" &&
        className.includes(IGNORE_SCREENSHOT_CLASS)
      ) {
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
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const {
    lineageGraph,
    retchLineageGraph,
    isLoading,
    error,
    refetchRunsAggregated,
  } = useLineageGraphContext();

  const { showRunId, closeRunResult, runAction } = useRecceActionContext();

  const [viewOptions, setViewOptions] = useState<LineageDiffViewOptions>({
    ...props.viewOptions,
  });

  // Expose the function to the parent via the ref
  useImperativeHandle(ref, () => ({
    copyToClipboard,
  }));

  const isModelsChanged = useMemo(() => {
    return lineageGraph && lineageGraph?.modifiedSet?.length > 0 ? true : false;
  }, [lineageGraph]);

  /**
   * View mode
   * - all: show all nodes
   * - changed_models: show only changed models
   */
  const viewMode: "all" | "changed_models" =
    viewOptions.view_mode || "changed_models";

  /**
   * Select mode: the behavior of clicking on nodes
   * - single: single-select mode
   * - multi: multi-select mode
   * - action_result: show node action result view
   */
  const [selectMode, setSelectMode] = useState<
    "single" | "multi" | "action_result"
  >("single");

  const selectedNode: LineageGraphNode = useMemo(() => {
    if (selectMode === "single") {
      return nodes.find((node) => node.data.isSelected)?.data;
    } else {
      return undefined;
    }
  }, [selectMode, nodes]);
  const selectedNodes: LineageGraphNode[] = useMemo(() => {
    return nodes
      .filter((node) => node.data.isSelected)
      .map((node) => node.data);
  }, [nodes]);
  const filteredNodes: LineageGraphNode[] = useMemo(() => {
    return nodes.map((node) => node.data);
  }, [nodes]);

  const [isContextMenuRendered, setIsContextMenuRendered] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
    selectedNode?: Node;
  }>({ x: 0, y: 0 });

  const [breakingChangeEnabled, setBreakingChangeEnabled] = useState(false);

  const toast = useToast();

  useLayoutEffect(() => {
    const t = async () => {
      let selectedNodes: string[] | undefined = undefined;

      if (!lineageGraph) {
        return;
      }

      if (viewOptions.node_ids) {
        selectedNodes = viewOptions.node_ids;
      } else {
        const packageName = lineageGraph.manifestMetadata.current?.project_name;
        const viewMode = viewOptions.view_mode
          ? viewOptions.view_mode
          : isModelsChanged
          ? "changed_models"
          : "all";

        const newViewOptions: LineageDiffViewOptions = {
          view_mode: viewMode,
          packages: packageName ? [packageName] : undefined,
          ...props.viewOptions,
        };
        setViewOptions(newViewOptions);

        const result = await select({
          select: newViewOptions.select,
          exclude: newViewOptions.exclude,
          packages: newViewOptions.packages,
          view_mode: newViewOptions.view_mode,
        });
        selectedNodes = result.nodes;
      }

      let [nodes, edges] = toReactflow(lineageGraph, selectedNodes);
      let nodeSet = selectAllNodes(lineageGraph);
      if (isModelsChanged) {
        nodeSet = selectImpactRadius(lineageGraph, breakingChangeEnabled);
      }
      [nodes, edges] = highlightNodes(Array.from(nodeSet), nodes, edges);

      layout(nodes, edges);
      setNodes(nodes);
      setEdges(edges);
    };

    t();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineageGraph]);

  const onNodeMouseEnter = (event: React.MouseEvent, node: Node) => {
    if (!lineageGraph) {
      return;
    }

    if (selectedNode) {
      return;
    }

    if (selectMode !== "single") {
      return;
    }

    const nodeSet = union(
      selectUpstream(lineageGraph, [node.id]),
      selectDownstream(lineageGraph, [node.id])
    );

    const [newNodes, newEdges] = highlightNodes(
      Array.from(nodeSet),
      nodes,
      edges
    );

    setNodes(newNodes);
    setEdges(newEdges);
  };

  interface ResetNodeStyleProps {
    deselect?: boolean;
    breakingChangeEnabled?: boolean;
  }

  const resetImpactRadiusStyles = (props?: ResetNodeStyleProps) => {
    const { deselect = false, breakingChangeEnabled = false } = props || {};
    if (!lineageGraph) {
      return;
    }

    const nodeSet = selectImpactRadius(lineageGraph, breakingChangeEnabled);
    const [newNodes, newEdges] = highlightNodes(
      Array.from(nodeSet),
      nodes,
      edges
    );

    setNodes(cleanUpNodes(deselect ? deselectNodes(newNodes) : newNodes));
    setEdges(newEdges);
  };

  const resetAllNodeStyles = (prop?: ResetNodeStyleProps) => {
    const { deselect = false } = prop || {};
    if (!lineageGraph) {
      return;
    }

    const nodeSet = selectAllNodes(lineageGraph);
    const [newNodes, newEdges] = highlightNodes(
      Array.from(nodeSet),
      nodes,
      edges
    );

    setNodes(cleanUpNodes(deselect ? deselectNodes(newNodes) : newNodes));
    setEdges(newEdges);
  };

  const onNodeMouseLeave = (event: React.MouseEvent, node: Node) => {
    if (selectedNode) {
      return;
    }
    if (selectMode === "action_result") {
      return;
    }

    if (isModelsChanged) {
      resetImpactRadiusStyles();
    } else {
      resetAllNodeStyles();
    }
  };

  const onNodeViewClosed = () => {
    if (isModelsChanged) {
      resetImpactRadiusStyles({ deselect: true });
    } else {
      resetAllNodeStyles({ deselect: true });
    }
  };

  const centerNode = async (node: Node) => {
    if (node.width && node.height) {
      const x = node.position.x + node.width / 2;
      const y = node.position.y + node.height / 2;
      const zoom = reactFlow.getZoom();

      reactFlow.setCenter(x, y, { zoom, duration: 200 });
    }
  };

  const navToCheck = useNavToCheck();

  useResizeObserver(refResize, async () => {
    if (selectMode === "single" || selectMode === "action_result") {
      const selectedNode = nodes.find((node) => node.data.isSelected);
      if (selectedNode) {
        centerNode(selectedNode);
      } else {
        reactFlow.fitView({ nodes, duration: 200 });
      }
    }
  });

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    if (interactive === false) return;
    if (!lineageGraph) {
      return;
    }

    closeContextMenu();
    if (selectMode === "single") {
      if (!selectedNode) {
        centerNode(node);
      }
      const nodeSet = union(
        selectUpstream(lineageGraph, [node.id]),
        selectDownstream(lineageGraph, [node.id])
      );

      const [newNodes, newEdges] = highlightNodes(
        Array.from(nodeSet),
        nodes,
        edges
      );

      setNodes(selectSingleNode(node.id, newNodes));
      setEdges(newEdges);
    } else if (selectMode === "action_result") {
      if (node.data.action?.run?.run_id) {
        showRunId(node.data.action?.run?.run_id);
      }
      centerNode(node);
      setNodes(selectSingleNode(node.id, nodes));
    } else {
      let newNodes = selectNode(node.id, nodes);
      if (!newNodes.find((n) => n.data.isSelected)) {
        setSelectMode("single");
        newNodes = cleanUpNodes(newNodes);
      }
      setNodes(newNodes);
    }
  };

  const handleActionNodeUpdated = useCallback(
    (node: LineageGraphNode) => {
      setNodes((prevNodes) => {
        const newNodes = prevNodes.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: node,
            };
          } else {
            return n;
          }
        });
        return newNodes;
      });
    },
    [setNodes]
  );

  const handleViewOptionsChanged = async (
    newViewOptions: LineageDiffViewOptions
  ) => {
    let selectedNodes: string[] | undefined = undefined;

    if (!lineageGraph) {
      return;
    }

    try {
      const result = await select({
        select: newViewOptions.select,
        exclude: newViewOptions.exclude,
        packages: newViewOptions.packages,
        view_mode: newViewOptions.view_mode,
      });
      selectedNodes = result.nodes;
    } catch (e) {
      if (e instanceof AxiosError) {
        toast({
          title: "Select node error",
          description: e.response?.data?.detail || e.message,
          status: "error",
          isClosable: true,
          position: "bottom-right",
        });
      }
      return;
    }

    let [newNodes, newEdges] = toReactflow(lineageGraph, selectedNodes);
    const nodeSet = selectImpactRadius(lineageGraph, breakingChangeEnabled);
    [newNodes, newEdges] = highlightNodes(
      Array.from(nodeSet),
      newNodes,
      newEdges
    );
    layout(newNodes, newEdges);
    setNodes(newNodes);
    setEdges(newEdges);
    setViewOptions(newViewOptions);

    await new Promise((resolve) => setTimeout(resolve, 1));
    await (async () => {
      reactFlow.fitView({ nodes: newNodes, duration: 200 });
    })();
  };

  const multiNodeAction = useMultiNodesAction(
    selectMode === "multi" ? selectedNodes : filteredNodes,
    {
      onActionStarted: () => {
        setSelectMode("action_result");
      },
      onActionNodeUpdated: handleActionNodeUpdated,
      onActionCompleted: () => {},
    }
  );

  const valueDiffAlertDialog = useValueDiffAlertDialog();

  if (isLoading) {
    return (
      <Flex
        width="100%"
        height="100%"
        alignItems="center"
        justifyContent="center"
      >
        <Spinner size="xl" />
      </Flex>
    );
  }

  const selectParentNodes = (degree = 1000) => {
    const selectedNode = contextMenuPosition.selectedNode;
    if (
      selectMode === "action_result" ||
      selectedNode === undefined ||
      lineageGraph === undefined
    )
      return;

    if (selectMode === "single") {
      setNodes(cleanUpNodes(nodes, true));
      setSelectMode("multi");
      multiNodeAction.reset();
    }

    const selectedNodeId = selectedNode.id;
    const upstream = selectUpstream(lineageGraph, [selectedNodeId], degree);
    const newNodes = selectNodes([...upstream], nodes, selectMode === "single");
    setNodes(newNodes);
  };

  const selectChildNodes = (degree = 1000) => {
    const selectedNode = contextMenuPosition.selectedNode;
    if (
      selectMode === "action_result" ||
      selectedNode === undefined ||
      lineageGraph === undefined
    )
      return;

    if (selectMode === "single") {
      setNodes(cleanUpNodes(nodes, true));
      setSelectMode("multi");
      multiNodeAction.reset();
    }

    const selectedNodeId = selectedNode.id;
    const downstream = selectDownstream(lineageGraph, [selectedNodeId], degree);
    const newNodes = selectNodes(
      [...downstream],
      nodes,
      selectMode === "single"
    );
    setNodes(newNodes);
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
    const offsetTop = (refReactFlow.current as any).offsetTop;
    setContextMenuPosition({
      x: event.clientX - pane.left,
      y: event.clientY - pane.top + offsetTop,
      selectedNode: node,
    });
    setIsContextMenuRendered(true);
  };

  if (error) {
    return (
      <Center h="100%">
        <VStack>
          <Box>
            Failed to load lineage data. This could be because the server has
            been terminated or there is a network error.
          </Box>
          <Box>[Reason: {error}]</Box>
          <Button
            colorScheme="blue"
            onClick={() => {
              retchLineageGraph && retchLineageGraph();
            }}
          >
            Retry
          </Button>
        </VStack>
      </Center>
    );
  }

  if (viewMode === "changed_models" && !lineageGraph?.modifiedSet?.length) {
    return (
      <Center h="100%">
        <VStack>
          <>No change detected</>
          <Button
            colorScheme="blue"
            onClick={() => {
              handleViewOptionsChanged({ ...viewOptions, view_mode: "all" });
            }}
          >
            Show all nodes
          </Button>
        </VStack>
      </Center>
    );
  }

  const selectNodeMulti = (nodeId: string) => {
    if (selectMode !== "multi") {
      if (!lineageGraph) {
        return;
      }

      const nodeSet = selectDownstream(lineageGraph, lineageGraph.modifiedSet);
      let [newNodes, newEdges] = highlightNodes(
        Array.from(nodeSet),
        nodes,
        edges
      );
      newNodes = cleanUpNodes(newNodes, true);
      newNodes = selectSingleNode(nodeId, newNodes);
      setNodes(newNodes);
      setEdges(newEdges);

      setSelectMode("multi");
      multiNodeAction.reset();
    } else {
      let newNodes = selectNode(nodeId, nodes);
      if (!newNodes.find((n) => n.data.isSelected)) {
        setSelectMode("single");
        newNodes = cleanUpNodes(newNodes);
      }
      setNodes(newNodes);
    }
  };
  const deselect = () => {
    setSelectMode("single");
    const newNodes = cleanUpNodes(deselectNodes(nodes));

    setNodes(newNodes);
    closeRunResult();
    refetchRunsAggregated?.();
  };

  const contextValue: LineageViewContextType = {
    interactive,
    selectMode,
    nodes,
    viewOptions,
    onViewOptionsChanged: handleViewOptionsChanged,
    selectNodeMulti,
    deselect,
    advancedImpactRadius: breakingChangeEnabled,
    setAdvancedImpactRadius: setBreakingChangeEnabled,
    runRowCount: async () => {
      if (selectMode === "multi") {
        await multiNodeAction.runRowCount();
        trackMultiNodesAction({ type: "row_count", selected: "multi" });
      } else if (selectedNode) {
        await runAction(
          "row_count",
          { node_names: [selectedNode.name] },
          { showForm: false, showLast: false }
        );
        trackMultiNodesAction({ type: "row_count", selected: "single" });
      } else {
        await runAction("row_count", {
          select: viewOptions.select,
          exclude: viewOptions.exclude,
          packages: viewOptions.packages,
          view_mode: viewOptions.view_mode,
        });
        trackMultiNodesAction({ type: "row_count", selected: "none" });
      }
    },
    runRowCountDiff: async () => {
      if (selectMode === "multi") {
        await multiNodeAction.runRowCountDiff();
        trackMultiNodesAction({ type: "row_count_diff", selected: "multi" });
      } else if (selectedNode) {
        await runAction(
          "row_count_diff",
          { node_names: [selectedNode.name] },
          { showForm: false, showLast: false }
        );
        trackMultiNodesAction({ type: "row_count_diff", selected: "single" });
      } else {
        await runAction("row_count_diff", {
          select: viewOptions.select,
          exclude: viewOptions.exclude,
          packages: viewOptions.packages,
          view_mode: viewOptions.view_mode,
        });
        trackMultiNodesAction({ type: "row_count_diff", selected: "none" });
      }
    },
    runValueDiff: async () => {
      if (selectedNode) {
        await runAction(
          "value_diff",
          {
            model: selectedNode.name,
          },
          { showForm: true, showLast: false }
        );
        trackMultiNodesAction({ type: "value_diff", selected: "single" });
      } else {
        const nodeCount =
          selectMode === "multi" ? selectedNodes.length : filteredNodes.length;
        if (await valueDiffAlertDialog.confirm(nodeCount)) {
          await multiNodeAction.runValueDiff();
          trackMultiNodesAction({
            type: "value_diff",
            selected: selectMode === "multi" ? "multi" : "none",
          });
        }
      }
    },
    addLineageDiffCheck: async () => {
      let check: Check | undefined = undefined;
      if (selectMode === "multi") {
        check = await multiNodeAction.addLineageDiffCheck();
        deselect();
        trackMultiNodesAction({ type: "lineage_diff", selected: "multi" });
      } else if (!selectedNode) {
        check = await createLineageDiffCheck(viewOptions);
        trackMultiNodesAction({ type: "lineage_diff", selected: "none" });
      }

      if (check) {
        navToCheck(check);
      }
    },
    addSchemaDiffCheck: async () => {
      let check: Check | undefined = undefined;

      if (selectMode === "multi") {
        if (selectedNodes.length > 0) {
          check = await multiNodeAction.addSchemaDiffCheck();
          deselect();
          trackMultiNodesAction({ type: "schema_diff", selected: "multi" });
        }
      } else if (selectedNode) {
        check = await createSchemaDiffCheck({
          node_id: selectedNode.id,
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
  };

  if (!lineageGraph) {
    return <></>;
  }

  if (Object.keys(lineageGraph.nodes).length > 0 && nodes.length === 0) {
    return <></>;
  }

  return (
    <LineageViewContext.Provider value={contextValue}>
      <HSplit
        sizes={selectedNode ? [70, 30] : [100, 0]}
        minSize={selectedNode ? 400 : 0}
        gutterSize={selectedNode ? 5 : 0}
        style={{ height: "100%", width: "100%" }}
      >
        <VStack
          ref={refResize}
          divider={<StackDivider borderColor="gray.200" />}
          spacing={0}
          style={{ contain: "strict" }}
          position="relative"
        >
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
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onNodeContextMenu={onNodeContextMenu}
            onClick={closeContextMenu}
            onInit={() => {
              if (isModelsChanged) {
                reactFlow.fitView();
              } else {
                const bounds = getNodesBounds(nodes);
                reactFlow.setCenter(
                  bounds.x + bounds.width / 2,
                  bounds.y + bounds.height / 2,
                  { zoom: 1 }
                );
              }
            }}
            maxZoom={1}
            minZoom={0.1}
            nodesDraggable={interactive}
            ref={refReactFlow}
          >
            <Background color="#ccc" />
            <Controls
              showInteractive={false}
              position="top-right"
              className={IGNORE_SCREENSHOT_CLASS}
            >
              <ControlButton
                title="copy image"
                onClick={async () => {
                  copyToClipboard();
                }}
              >
                <Icon as={FiCopy} />
              </ControlButton>
            </Controls>
            <ImageDownloadModal />
            <Panel position="bottom-left">
              <HStack>
                <ChangeStatusLegend />
              </HStack>
            </Panel>
            <Panel position="top-left">
              <Flex direction="column">
                <BreakingChangeSwitch
                  enabled={breakingChangeEnabled}
                  onChanged={(enabled) => {
                    setBreakingChangeEnabled(enabled);
                    resetImpactRadiusStyles({ breakingChangeEnabled: enabled });
                    trackBreakingChange({ enabled });
                  }}
                />
                {nodes.length == 0 && (
                  <Text fontSize="xl" color="grey" opacity={0.5}>
                    No nodes
                  </Text>
                )}
              </Flex>
            </Panel>
            <MiniMap
              nodeColor={nodeColor}
              nodeStrokeWidth={3}
              zoomable
              pannable
            />
            {selectMode === "action_result" && (
              <Panel
                position="bottom-center"
                className={IGNORE_SCREENSHOT_CLASS}
              >
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
                }}
              >
                <MenuItem
                  icon={<BiArrowFromBottom />}
                  onClick={() => {
                    selectParentNodes(1);
                  }}
                >
                  Select parent nodes
                </MenuItem>
                <MenuItem
                  icon={<BiArrowToBottom />}
                  onClick={() => {
                    selectChildNodes(1);
                  }}
                >
                  Select child nodes
                </MenuItem>
                <MenuDivider></MenuDivider>
                <MenuItem
                  icon={<BiArrowFromBottom />}
                  onClick={() => {
                    selectParentNodes();
                  }}
                >
                  Select all upstream nodes
                </MenuItem>
                <MenuItem
                  icon={<BiArrowToBottom />}
                  onClick={() => {
                    selectChildNodes();
                  }}
                >
                  Select all downstream nodes
                </MenuItem>
              </MenuList>
            </Menu>
          )}
        </VStack>
        {selectMode === "single" && selectedNode ? (
          <Box borderLeft="solid 1px lightgray" height="100%">
            <NodeView node={selectedNode} onCloseNode={onNodeViewClosed} />
          </Box>
        ) : (
          <Box></Box>
        )}
      </HSplit>
      {valueDiffAlertDialog.AlertDialog}
    </LineageViewContext.Provider>
  );
}

export const LineageView = forwardRef<LineageViewRef, LineageViewProps>(
  PrivateLineageView
);
