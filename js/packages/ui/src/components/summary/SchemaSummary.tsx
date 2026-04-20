"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getModelInfo } from "../..";
import type { LineageGraph, LineageGraphNode } from "../../contexts";
import { useApiConfig } from "../../hooks";
import { NodeTag, RowCountDiffTag } from "../lineage";
import { SchemaView } from "../schema";

interface SchemaDiffCardProps {
  title: string;
  node: LineageGraphNode;
}

function SchemaDiffCard({ node, ...props }: SchemaDiffCardProps) {
  const { apiClient } = useApiConfig();

  const { data: modelDetailData, isLoading } = useQuery({
    queryKey: ["modelDetail", node.id],
    queryFn: () => getModelInfo(node.id, apiClient),
    enabled: !!apiClient,
    staleTime: 5 * 60 * 1000,
  });
  const modelDetail = modelDetailData?.model;

  return (
    <Card sx={{ maxWidth: 500 }}>
      <CardHeader
        title={
          <Typography sx={{ fontSize: 18, fontWeight: "bold" }}>
            {props.title}
          </Typography>
        }
        subheader={
          <Stack direction="row" spacing="8px" sx={{ p: "16px" }}>
            <NodeTag
              resourceType={node.data.resourceType}
              materialized={node.data.materialized}
            />
            {node.data.resourceType === "model" && (
              <RowCountDiffTag node={node} />
            )}
          </Stack>
        }
      />
      <CardContent>
        <Box sx={{ display: "flex" }}>
          {isLoading ? (
            <Skeleton variant="rectangular" width="100%" height={100} />
          ) : (
            <SchemaView
              base={
                modelDetail?.base && Object.keys(modelDetail.base).length > 0
                  ? {
                      id: node.id,
                      unique_id: node.id,
                      name: node.data.name,
                      ...modelDetail.base,
                    }
                  : undefined
              }
              current={
                modelDetail?.current &&
                Object.keys(modelDetail.current).length > 0
                  ? {
                      id: node.id,
                      unique_id: node.id,
                      name: node.data.name,
                      ...modelDetail.current,
                    }
                  : undefined
              }
              columnChanges={node.data.change?.columns}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function listChangedNodes(lineageGraph: LineageGraph) {
  const changedNodes: LineageGraphNode[] = [];
  const allNodes = lineageGraph.nodes;
  lineageGraph.modifiedSet.forEach((nodeId) => {
    const node = allNodes[nodeId];
    if (
      node.data.change?.columns &&
      Object.keys(node.data.change.columns).length > 0
    ) {
      changedNodes.push(node);
    }
  });
  return changedNodes;
}

export interface SchemaSummaryProps {
  lineageGraph: LineageGraph;
}

export function SchemaSummary({ lineageGraph }: SchemaSummaryProps) {
  const [changedNodes, setChangedNodes] = useState<LineageGraphNode[]>([]);

  useEffect(() => {
    setChangedNodes(listChangedNodes(lineageGraph));
  }, [lineageGraph]);

  return (
    <>
      <Box
        sx={{
          width: "100%",
          pb: "10px",
          mb: "20px",
          mt: "20px",
        }}
      >
        <Typography variant="h5" sx={{ fontSize: 24 }}>
          Schema Summary
        </Typography>
      </Box>
      <Box sx={{ width: "100%", pb: "10px", mb: "20px" }}>
        {changedNodes.length === 0 ? (
          <Typography sx={{ fontSize: 18, color: "grey.600" }}>
            No schema changes detected.
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
              gap: "2vw",
              p: "2.5vw",
              width: "100%",
              bgcolor: "lightgray",
            }}
          >
            {changedNodes.map((node) => {
              return (
                <SchemaDiffCard
                  key={node.id}
                  title={node.data.name}
                  node={node}
                />
              );
            })}
          </Box>
        )}
      </Box>
    </>
  );
}
