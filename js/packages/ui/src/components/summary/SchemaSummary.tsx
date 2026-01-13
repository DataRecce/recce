"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import type { LineageGraph, LineageGraphNode } from "../../contexts";
import { mergeKeysWithStatus } from "../../utils";
import { ResourceTypeTag, RowCountDiffTag } from "../lineage";
import { SchemaView } from "../schema";

interface SchemaDiffCardProps {
  title: string;
  node: LineageGraphNode;
}

function SchemaDiffCard({ node, ...props }: SchemaDiffCardProps) {
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
            <ResourceTypeTag data={{ resourceType: node.data.resourceType }} />
            {node.data.resourceType === "model" && (
              <RowCountDiffTag node={node} />
            )}
          </Stack>
        }
      />
      <CardContent>
        <Box sx={{ display: "flex" }}>
          <SchemaView
            base={node.data.data.base}
            current={node.data.data.current}
          />
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
    const columnDiffStatus = mergeKeysWithStatus(
      Object.keys(node.data.data.base?.columns ?? {}),
      Object.keys(node.data.data.current?.columns ?? {}),
    );
    const isSchemaChanged = !Object.values(columnDiffStatus).every(
      (el) => el === undefined,
    );
    // We only want to show nodes that have real schema changes.
    // It doesn't include added or deleted model.
    if (isSchemaChanged && node.data.data.base && node.data.data.current)
      changedNodes.push(node);
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
