import {
  LineageGraphNode,
  cleanUpNodes,
  highlightNodes,
  layout,
  selectDownstream,
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

export interface LineageViewProps {
  viewOptions?: LineageDiffViewOptions;
  interactive?: boolean;
  weight?: number;
  height?: number;

  // to be removed
  viewMode?: "changed_models" | "all";
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

export function _LineageView(
  { ...props }: LineageViewProps,
  ref: Ref<LineageViewRef>
) {
  const reactFlow = useReactFlow();
  const refReactFlow = useRef<HTMLDivElement>(null);
  const { successToast, failToast } = useClipBoardToast();
  const {
    copyToClipboard,
    ImageDownloadModal,
    ref: copyRef,
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

  const [viewOptions, setViewOptions] = useState<LineageDiffViewOptions>(
    props.viewOptions || {}
  );

  const {
    lineageGraph,
    retchLineageGraph,
    isLoading,
    error,
    refetchRunsAggregated,
  } = useLineageGraphContext();

  const { showRunId, closeRunResult, runAction } = useRecceActionContext();

  // Expose the function to the parent via the ref
  useImperativeHandle(ref, () => ({
    copyToClipboard,
  }));

  /**
   * View mode
   * - all: show all nodes
   * - changed_models: show only changed models
   */
  const viewMode: "all" | "changed_models" =
    viewOptions.view_mode || props.viewMode || "changed_models";

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

  const [isContextMenuRendered, setIsContextMenuRendered] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
    selectedNode?: Node;
  }>({ x: 0, y: 0 });

  const toast = useToast();

  useLayoutEffect(() => {
    const t = async () => {
      let selectedNodes: string[] | undefined = undefined;

      if (!lineageGraph) {
        return;
      }

      if (viewOptions.select || viewOptions.exclude) {
        try {
          const result = await select({
            select: viewOptions.select,
            exclude: viewOptions.exclude,
          });
          selectedNodes = result.nodes;
        } catch (e) {}
      }

      const [nodes, edges] = toReactflow(
        lineageGraph,
        viewOptions,
        selectedNodes
      );

      layout(nodes, edges);
      setNodes(nodes);
      setEdges(edges);
    };

    t();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNodes, setEdges, lineageGraph]);

  const onNodeMouseEnter = (event: React.MouseEvent, node: Node) => {
    if (!lineageGraph) {
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

  const onNodeMouseLeave = (event: React.MouseEvent, node: Node) => {
    if (!lineageGraph) {
      return;
    }

    const nodeSet = selectDownstream(lineageGraph, lineageGraph.modifiedSet);

    const [newNodes, newEdges] = highlightNodes(
      Array.from(nodeSet),
      nodes,
      edges
    );

    setNodes(newNodes);
    setEdges(newEdges);
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

  useResizeObserver(refReactFlow, async () => {
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
    if (props.interactive === false) return;
    closeContextMenu();
    if (selectMode === "single") {
      if (!selectedNode) {
        centerNode(node);
      }
      setNodes(selectSingleNode(node.id, nodes));
    } else if (selectMode === "action_result") {
      if (node.data.action?.run?.run_id) {
        showRunId(node.data.action?.run?.run_id);
      }
      centerNode(node);
      setNodes(selectSingleNode(node.id, nodes));
    } else {
      const newNodes = selectNode(node.id, nodes);
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

    const [newNodes, newEdges] = toReactflow(
      lineageGraph,
      newViewOptions,
      selectedNodes
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

  const multiNodeAction = useMultiNodesAction(selectedNodes, {
    onActionStarted: () => {
      setSelectMode("action_result");
    },
    onActionNodeUpdated: handleActionNodeUpdated,
    onActionCompleted: () => {},
  });

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

  const selectParentNodes = () => {
    const selectedNode = contextMenuPosition.selectedNode;
    if (
      selectMode !== "multi" ||
      selectedNode === undefined ||
      lineageGraph === undefined
    )
      return;

    const selectedNodeId = selectedNode.id;
    const upstream = selectUpstream(lineageGraph, [selectedNodeId]);
    const newNodes = selectNodes([...upstream], nodes);
    setNodes(newNodes);
  };

  const selectChildNodes = () => {
    const selectedNode = contextMenuPosition.selectedNode;
    if (
      selectMode !== "multi" ||
      selectedNode === undefined ||
      lineageGraph === undefined
    )
      return;

    const selectedNodeId = selectedNode.id;
    const downstream = selectDownstream(lineageGraph, [selectedNodeId]);
    const newNodes = selectNodes([...downstream], nodes);
    setNodes(newNodes);
  };

  const closeContextMenu = () => {
    setIsContextMenuRendered(false);
    setContextMenuPosition({ x: 0, y: 0 });
  };

  const onNodeContextMenu = (event: React.MouseEvent, node: Node) => {
    if (selectMode !== "multi") {
      return;
    }
    // Only show context menu when selectMode is action
    // Prevent native context menu from showing
    event.preventDefault();
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
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
      setNodes(selectNode(nodeId, nodes));
    }
  };
  const deselect = () => {
    setSelectMode("single");
    const newNodes = cleanUpNodes(nodes);

    setNodes(newNodes);
    closeRunResult();
    refetchRunsAggregated?.();
  };

  const contextValue: LineageViewContextType = {
    selectMode,
    nodes,
    viewOptions,
    onViewOptionsChanged: handleViewOptionsChanged,
    selectNodeMulti,
    deselect,
    runRowCountDiff: async () => {
      if (selectMode === "multi") {
        await multiNodeAction.runRowCountDiff();
      } else if (selectedNode) {
        await runAction(
          "row_count_diff",
          { node_names: [selectedNode.name] },
          { showForm: false, showLast: false }
        );
      } else {
        await runAction("row_count_diff", {
          select: viewOptions.select,
          exclude: viewOptions.exclude,
        });
      }
    },
    runValueDiff: async () => {
      if (selectMode === "multi") {
        await multiNodeAction.runValueDiff();
      } else if (selectedNode) {
        await runAction(
          "value_diff",
          {
            model: selectedNode.name,
          },
          { showForm: true, showLast: false }
        );
      }
    },
    addLineageDiffCheck: async () => {
      if (selectMode === "multi") {
        multiNodeAction.addLineageDiffCheck(viewOptions.view_mode || "all");
      } else {
        const check = await createLineageDiffCheck(viewOptions);
        if (check) {
          navToCheck(check);
        }
      }
    },
    addSchemaDiffCheck: async () => {
      if (selectNodes.length > 0) {
        multiNodeAction.addSchemaDiffCheck();
      } else {
        const check = await createSchemaDiffCheck({
          select: viewOptions.select,
          exclude: viewOptions.exclude,
        });
        if (check) {
          navToCheck(check);
        }
      }
    },
    cancel: multiNodeAction.cancel,
    actionState: multiNodeAction.actionState,
  };

  return (
    <LineageViewContext.Provider value={contextValue}>
      <HSplit
        sizes={selectedNode ? [70, 30] : [100, 0]}
        minSize={selectedNode ? 400 : 0}
        gutterSize={selectedNode ? 5 : 0}
        style={{ height: "100%", width: "100%" }}
      >
        <VStack
          ref={refReactFlow}
          divider={<StackDivider borderColor="gray.200" />}
          spacing={0}
          style={{ contain: "strict" }}
        >
          {props.interactive && <LineageViewTopBar />}
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
            maxZoom={1}
            minZoom={0.1}
            fitView={true}
            nodesDraggable={props.interactive}
            ref={copyRef}
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
              <Text fontSize="xl" color="grey" opacity={0.5}>
                {nodes.length > 0 ? "" : "No nodes"}
              </Text>
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
        </VStack>
        {selectMode === "single" && selectedNode ? (
          <Box borderLeft="solid 1px lightgray" height="100%">
            <NodeView
              node={selectedNode}
              onCloseNode={() => {
                setNodes(cleanUpNodes(nodes));
              }}
            />
          </Box>
        ) : (
          <Box></Box>
        )}
      </HSplit>
      {isContextMenuRendered && (
        // Only render context menu when select mode is action
        <Menu isOpen={true} onClose={closeContextMenu}>
          <MenuList
            style={{
              position: "absolute",
              left: `${contextMenuPosition.x}px`,
              top: `${contextMenuPosition.y}px`,
            }}
          >
            <MenuItem icon={<BiArrowFromBottom />} onClick={selectParentNodes}>
              Select parent nodes
            </MenuItem>
            <MenuItem icon={<BiArrowToBottom />} onClick={selectChildNodes}>
              Select child nodes
            </MenuItem>
          </MenuList>
        </Menu>
      )}
    </LineageViewContext.Provider>
  );
}

export const LineageView = forwardRef<LineageViewRef, LineageViewProps>(
  _LineageView
);
