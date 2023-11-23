import { PUBLIC_API_URL } from "@/const";
import {
  LineageGraph,
  buildLineageGraph,
  highlightPath,
  toReactflow,
} from "./lineagediff";
import { Box, Flex, Icon, Tooltip, useDisclosure } from "@chakra-ui/react";
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
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { GraphNode } from "./GraphNode";
import GraphEdge from "./GraphEdge";
import { getIconForChangeStatus } from "./styles";
import { NodeView } from "./NodeView";

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
  return node?.style?.backgroundColor || ("lightgray" as string);
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
  const reactflow = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [lineageGraph, setLineageGraph] = useState<LineageGraph>();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [errorStep, setErrorStep] = useState<string>();

  const [selected, setSelected] = useState<string>();

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
      const lineagGraph = buildLineageGraph(
        responseBase.data,
        responseCurrent.data
      );
      const [nodes, edges] = toReactflow(lineagGraph);
      layout(nodes, edges);
      setLineageGraph(lineagGraph);
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
  }, [setNodes, setEdges, reactflow]);

  useEffect(() => {
    queryLineage();
  }, []);

  const onNodeMouseEnter = (event: React.MouseEvent, node: Node) => {
    if (lineageGraph) {
      const [newNodes, newEdges] = highlightPath(
        lineageGraph,
        nodes,
        edges,
        node.id
      );

      setNodes(newNodes);
      setEdges(newEdges);
    }
  };

  const onNodeMouseLeave = (event: React.MouseEvent, node: Node) => {
    if (lineageGraph) {
      const [newNodes, newEdges] = highlightPath(
        lineageGraph,
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
    return <>Loading lineage data</>;
  }

  if (error) {
    return <>Fail to load lineage data: {error}</>;
  }

  return (
    <Flex width="100%" height="calc(100vh - 42px)">
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
          minZoom={0.1}
          fitView={true}
        >
          <Background color="#ccc" />
          <Controls showInteractive={false} position="top-right" />
          <Panel position="bottom-left">
            <ChangeStatusLegend />
          </Panel>
          <MiniMap nodeColor={nodeColor} nodeStrokeWidth={3} />
        </ReactFlow>
      </Box>

      {selected && lineageGraph?.nodes[selected] && (
        <Box flex="0 0 500px" borderLeft="solid 1px lightgray" height="100%">
          <NodeView node={lineageGraph?.nodes[selected]}></NodeView>
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
