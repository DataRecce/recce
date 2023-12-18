import { PUBLIC_API_URL } from "../../lib/const";
import {
  LineageGraph,
  buildDefaultLineageGraphSets,
  highlightPath,
  toReactflow,
} from "./lineage";
import {
  Box,
  Flex,
  Icon,
  Tooltip,
  Text,
  Spinner,
  useToast,
  Modal,
  useDisclosure,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from "@chakra-ui/react";
import axios, { AxiosError } from "axios";
import React, { useCallback, useEffect, useState } from "react";
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
  useReactFlow,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { GraphNode } from "./GraphNode";
import GraphEdge from "./GraphEdge";
import { getIconForChangeStatus } from "./styles";
import { FiDownloadCloud, FiRefreshCw, FiList } from "react-icons/fi";
import { NodeView } from "./NodeView";
import { toPng } from "html-to-image";
import path from "path";
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import SummaryView from "../summary/SummaryView";

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
  const [webSocket, setWebSocket] = useState<WebSocket>();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [lineageGraph, setLineageGraph] = useState<LineageGraph>();
  const [modifiedSet, setModifiedSet] = useState<string[]>();
  const { setLineageGraphSets } = useLineageGraphsContext();
  const { isOpen, onOpen, onClose } = useDisclosure();


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [errorStep, setErrorStep] = useState<string>();

  const [selected, setSelected] = useState<string>();
  const [viewMode, setViewMode] = useState<"changed_models" | "all">(
    "changed_models"
  );

  const { getViewport } = useReactFlow();
  const artifactsUpdatedToast = useToast();

  const queryLineage = useCallback(async () => {
    let step = "current";

    try {
      setLoading(true);
      const responseCurrent = await axios.get(
        `${PUBLIC_API_URL}/api/lineage?base=0`
      );
      if (responseCurrent.status !== 200) {
        throw new Error("error");
      }

      step = "base";
      const responseBase = await axios.get(
        `${PUBLIC_API_URL}/api/lineage?base=1`
      );
      if (responseBase.status !== 200) {
        throw new Error("error");
      }
      const defaultLineageGraphs = buildDefaultLineageGraphSets(
        responseBase.data,
        responseCurrent.data
      );
      setLineageGraphSets(defaultLineageGraphs);

      const lineageGraph =
        viewMode === "changed_models"
          ? defaultLineageGraphs.changed
          : defaultLineageGraphs.all;
      const modifiedSet = defaultLineageGraphs.modifiedSet;
      const [nodes, edges] = toReactflow(
        lineageGraph,
        defaultLineageGraphs.modifiedSet
      );
      layout(nodes, edges);
      setLineageGraph(lineageGraph);
      setModifiedSet(modifiedSet);
      setNodes(nodes);
      setEdges(edges);

      setError(undefined);
      setErrorStep(undefined);
    } catch (err: any) {
      if (err instanceof AxiosError) {
        const detail = err?.response?.data?.detail;
        if (detail) {
          setError(detail);
        } else {
          setError(err?.message);
        }
      } else {
        setError(err?.message);
      }
      setErrorStep(step);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges, viewMode, setLineageGraphSets]);

  useEffect(() => {
    queryLineage();
  }, [queryLineage]);

  useEffect(() => {
    function httpUrlToWebSocketUrl(url: string): string {
      return url.replace(/(http)(s)?\:\/\//, "ws$2://");
    }
    const ws = new WebSocket(`${httpUrlToWebSocketUrl(PUBLIC_API_URL)}/api/ws`);
    setWebSocket(ws);
    ws.onopen = () => {
      ws.send("ping"); // server will respond with 'pong'
    };
    ws.onmessage = (event) => {
      if (event.data === "pong") {
        return;
      }
      try {
        const data = JSON.parse(event.data);
        if (data.command === "refresh") {
          const { eventType, srcPath } = data.event;
          const [targetName, fileName] = srcPath.split("/").slice(-2);
          const name = path.parse(fileName).name;
          artifactsUpdatedToast({
            description: `Detected ${targetName} ${name} ${eventType}`,
            status: "info",
            variant: "left-accent",
            position: "bottom-right",
            duration: 5000,
            isClosable: true,
          });
          queryLineage();
        }
      } catch (err) {
        console.error(err);
      }
    };
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [artifactsUpdatedToast, queryLineage]);

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
    setSelected(node.id);
  };

  if (loading) {
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
            <ChangeStatusLegend />
          </Panel>
          <Panel position="top-left">
            <Text fontSize="xl" color="grey" opacity={0.5}>
              {viewModeTitle[viewMode]}
            </Text>
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
      {selected && lineageGraph?.nodes[selected] && (
        <Box flex="0 0 500px" borderLeft="solid 1px lightgray" height="100%">
          <NodeView
            node={lineageGraph?.nodes[selected]}
            onCloseNode={() => {
              setSelected(undefined);
            }}
          />
        </Box>
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
