import { PUBLIC_API_URL } from "@/const";
import { buildLineageGraph, toReactflow } from "@/lineagediff";
import { Box } from "@chakra-ui/react";
import axios, { AxiosError } from "axios";
import React, { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  useEdgesState,
  useNodesState,
  Position,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";

const layout = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 172;
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

export default function LineageView() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [errorStep, setErrorStep] = useState<string>();

  const [base, setBase] = useState<any>();
  const [current, setCurrent] = useState<any>();

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

      setBase(responseBase.data);
      setCurrent(responseCurrent.data);

      const lineagGraph = buildLineageGraph(
        responseBase.data,
        responseCurrent.data
      );
      const [nodes, edges] = toReactflow(lineagGraph);
      layout(nodes, edges);
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
  }, []);

  useEffect(() => {
    queryLineage();
  }, []);

  return (
    <Box width="100%" height="calc(100vh - 74px)">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      />
    </Box>
  );
}
