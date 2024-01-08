import { PUBLIC_API_URL } from "../../lib/const";
import {
  LineageGraph,
  cleanUpSelectedNodes,
  highlightPath,
  selectDownstream,
  selectNode,
  selectNodes,
  selectUpstream,
  toReactflow,
} from "./lineage";
import {
  Box,
  Flex,
  Icon,
  Tooltip,
  Text,
  Spinner,
  Modal,
  useDisclosure,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
  HStack,
  Button,
  VStack,
  Menu,
  MenuList,
  MenuItem,
  Center,
} from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  useEdgesState,
  useNodesState,
  Controls,
  MiniMap,
  Panel,
  Background,
  ReactFlowProvider,
  ControlButton,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { GraphNode } from "./GraphNode";
import GraphEdge from "./GraphEdge";
import { getIconForChangeStatus } from "./styles";
import { FiDownloadCloud, FiRefreshCw, FiList } from "react-icons/fi";
import { BiArrowFromBottom, BiArrowToBottom } from "react-icons/bi";
import { NodeView } from "./NodeView";
import { toPng } from "html-to-image";
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import SummaryView from "../summary/SummaryView";
import { NodeSelector } from "./NodeSelector";

const layout = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 300;
  const nodeHeight = 36;

  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });
};

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

const viewModeTitle = {
  all: "All",
  changed_models: "Changed Models",
};

function ChangeStatusLegend() {
  const CHANGE_STATUS_MSGS: {
    [key: string]: [string, string];
  } = {
    added: ["Added", "Added resource"],
    removed: ["Removed", "Removed resource"],
    modified: ["Modified", "Modified resource"],
  };

  return (
    <Box
      bg="white"
      padding="12px"
      borderWidth="1px"
      borderColor="gray.200"
      fontSize="sm"
    >
      {Object.entries(CHANGE_STATUS_MSGS).map(([key, [label, tip]]) => {
        const { icon, color } = getIconForChangeStatus(key as any);

        return (
          <Tooltip label={tip} key={key}>
            <Flex alignItems="center" gap="6px" marginBottom="2px">
              <Icon color={color} as={icon} /> {label}
            </Flex>
          </Tooltip>
        );
      })}
    </Box>
  );
}

function _LineageView() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [lineageGraph, setLineageGraph] = useState<LineageGraph>();
  const [modifiedSet, setModifiedSet] = useState<string[]>();
  const { lineageGraphSets, isLoading, error } = useLineageGraphsContext();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [selectMode, setSelectMode] = useState<"detail" | "action">("detail");
  const [selected, setSelected] = useState<string>();
  const [viewMode, setViewMode] = useState<"changed_models" | "all">(
    "changed_models"
  );

  const [isContextMenuRendered, setIsContextMenuRendered] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
    selectedNode?: Node;
  }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!lineageGraphSets) {
      return;
    }

    const lineageGraph =
      viewMode === "changed_models"
        ? lineageGraphSets.changed
        : lineageGraphSets.all;
    const modifiedSet = lineageGraphSets.modifiedSet;
    const [nodes, edges] = toReactflow(
      lineageGraph,
      lineageGraphSets.modifiedSet
    );
    layout(nodes, edges);
    setLineageGraph(lineageGraph);
    setModifiedSet(modifiedSet);
    setNodes(nodes);
    setEdges(edges);
  }, [setNodes, setEdges, viewMode, lineageGraphSets]);

  const onNodeMouseEnter = (event: React.MouseEvent, node: Node) => {
    if (lineageGraph && modifiedSet !== undefined) {
      const [newNodes, newEdges] = highlightPath(
        lineageGraph,
        modifiedSet,
        nodes,
        edges,
        node.id
      );

      setNodes(newNodes);
      setEdges(newEdges);
    }
  };

  const onNodeMouseLeave = (event: React.MouseEvent, node: Node) => {
    if (lineageGraph && modifiedSet !== undefined) {
      const [newNodes, newEdges] = highlightPath(
        lineageGraph,
        modifiedSet,
        nodes,
        edges,
        null
      );
      setNodes(newNodes);
      setEdges(newEdges);
    }
  };

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    closeContextMenu();
    if (selectMode === "action") {
      const newNodes = selectNode(node.id, nodes);
      setNodes(newNodes);
    } else {
      setSelected(node.id);
    }
  };

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
      selectMode !== "action" ||
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
      selectMode !== "action" ||
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
    if (selectMode !== "action") {
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

  const onDownloadImage = () => {
    // const { x, y, zoom } = getViewport();
    const reactFlowViewport = document.querySelector(".react-flow__viewport");
    if (reactFlowViewport?.parentElement) {
      toPng(reactFlowViewport?.parentElement, {
        backgroundColor: "#ffffff00",
        width: reactFlowViewport?.parentElement.clientWidth,
        height: reactFlowViewport?.parentElement.clientHeight,
        style: {
          width: `${reactFlowViewport?.parentElement.clientWidth}`,
          height: `${reactFlowViewport?.parentElement.clientHeight}`,
          // transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        },
      }).then((dataUrl) => {
        const a = document.createElement("a");
        a.setAttribute("download", "recce-lineage.png");
        // a.setAttribute('filename', 'recce-lineage.png');
        a.setAttribute("target", "_blank");
        a.setAttribute("href", dataUrl);
        a.click();
      });
    }
  };

  if (error) {
    return <>Fail to load lineage data: {error}</>;
  }

  if (
    viewMode === "changed_models" &&
    (modifiedSet === undefined || modifiedSet?.length === 0)
  ) {
    return (
      <Center h="100%">
        <VStack>
          <>No change detected</>
          <Button
            colorScheme="blue"
            onClick={() => {
              setViewMode("all");
            }}
          >
            Show all nodes
          </Button>
        </VStack>
      </Center>
    );
  }

  return (
    <Flex width="100%" height="100%">
      <Box flex="1 0 0px">
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
        >
          <Background color="#ccc" />
          <Controls showInteractive={false} position="top-right">
            <ControlButton
              title="switch mode"
              onClick={() => {
                setViewMode(viewMode === "all" ? "changed_models" : "all");
                const newNodes = cleanUpSelectedNodes(nodes);
                setNodes(newNodes);
              }}
            >
              <Icon as={FiRefreshCw} />
            </ControlButton>
            <ControlButton title="download image" onClick={onDownloadImage}>
              <Icon as={FiDownloadCloud} />
            </ControlButton>
            <ControlButton title="summary" onClick={onOpen}>
              <Icon as={FiList} />
            </ControlButton>
          </Controls>
          <Panel position="bottom-left">
            <HStack>
              <ChangeStatusLegend />
              <Box p={2} flex="0 1 160px" fontSize="14px">
                <Text color="gray" mb="2px">
                  Actions
                </Text>
                <VStack spacing={1} align="baseline">
                  <Button
                    size="xs"
                    variant="outline"
                    isDisabled={selectMode === "action"}
                    onClick={() => {
                      const newMode =
                        selectMode === "detail" ? "action" : "detail";
                      const newNodes = cleanUpSelectedNodes(nodes);
                      setNodes(newNodes);
                      setSelectMode(newMode);
                    }}
                  >
                    Select Models
                  </Button>
                </VStack>
              </Box>
            </HStack>
          </Panel>
          <Panel position="top-left">
            <Text fontSize="xl" color="grey" opacity={0.5}>
              {viewModeTitle[viewMode]}
            </Text>
          </Panel>
          <Panel position="bottom-center">
            <NodeSelector
              nodes={nodes.map((node) => node.data)}
              isOpen={selectMode === "action"}
              onClose={() => {
                setSelectMode("detail");
                const newNodes = cleanUpSelectedNodes(nodes);
                setNodes(newNodes);
              }}
            />
          </Panel>
          <MiniMap nodeColor={nodeColor} nodeStrokeWidth={3} />
        </ReactFlow>
      </Box>
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent overflowY="auto" height="80%">
          <ModalCloseButton />
          <ModalBody>
            <SummaryView />
          </ModalBody>
        </ModalContent>
      </Modal>
      {selectMode === "detail" && selected && lineageGraph?.nodes[selected] && (
        <Box flex="0 0 500px" borderLeft="solid 1px lightgray" height="100%">
          <NodeView
            node={lineageGraph?.nodes[selected]}
            onCloseNode={() => {
              setSelected(undefined);
            }}
          />
        </Box>
      )}
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
    </Flex>
  );
}

export default function LineageView() {
  return (
    <ReactFlowProvider>
      <_LineageView />
    </ReactFlowProvider>
  );
}
