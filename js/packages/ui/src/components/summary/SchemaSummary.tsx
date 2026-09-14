"use client";

import MuiAlert from "@mui/material/Alert";
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
import {
  type LineageGraph,
  type LineageGraphNode,
  useLineageGraphContext,
} from "../../contexts";
import { useApiConfig } from "../../hooks";
import { NodeTag, RowCountDiffTag } from "../lineage";
import { SchemaView } from "../schema";
import { formatUncheckedNodeText } from "../schema/formatSchemaCoverage";

interface SchemaDiffCardProps {
  title: string;
  node: LineageGraphNode;
}

function affectedCatalogs(lineageGraph: LineageGraph): string {
  const baseStatus = lineageGraph.artifactHealth?.base?.status;
  const currentStatus = lineageGraph.artifactHealth?.current?.status;
  const baseIncomplete =
    baseStatus != null && !["complete", "not_applicable"].includes(baseStatus);
  const currentIncomplete =
    currentStatus != null &&
    !["complete", "not_applicable"].includes(currentStatus);
  if (baseIncomplete && currentIncomplete) return "base and current catalogs";
  if (baseIncomplete) return "base catalog";
  if (currentIncomplete) return "current catalog";
  return "affected base/current catalogs";
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
          <Typography sx={{ fontSize: "1.125rem", fontWeight: "bold" }}>
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
                      // /api/models/ does not return resource_type.
                      resource_type: node.data.resourceType,
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
                      resource_type: node.data.resourceType,
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
  const { envInfo } = useLineageGraphContext();
  // Same reason as SchemaView: `dbt docs generate` and catalog.json do not
  // exist in SQLMesh, so that remediation cannot be followed there. An
  // unidentified adapter keeps the dbt wording.
  const usesDbtCatalog = envInfo?.adapterType !== "sqlmesh";

  useEffect(() => {
    setChangedNodes(listChangedNodes(lineageGraph));
  }, [lineageGraph]);

  const schemaCoverage = lineageGraph.schemaCoverage ?? {
    status: "unknown",
    unchecked_nodes: [],
    unchecked_node_count: 0,
    more: false,
  };
  const comparisonIncomplete = schemaCoverage.status !== "complete";

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
        <Typography variant="h5" sx={{ fontSize: "1.5rem" }}>
          Schema Summary
        </Typography>
      </Box>
      <Box sx={{ width: "100%", pb: "10px", mb: "20px" }}>
        {comparisonIncomplete && (
          <MuiAlert
            severity="warning"
            aria-label="Incomplete schema comparison"
            sx={{ fontSize: "0.875rem", mb: 2 }}
          >
            Schema comparison incomplete.{" "}
            {formatUncheckedNodeText(schemaCoverage)}{" "}
            {usesDbtCatalog ? (
              <>
                Regenerate the {affectedCatalogs(lineageGraph)} with{" "}
                <code>dbt docs generate</code>
                {", then rerun the comparison."}
              </>
            ) : (
              "Refresh your environments so model columns are resolved, then rerun the comparison."
            )}
          </MuiAlert>
        )}
        {changedNodes.length === 0 ? (
          !comparisonIncomplete && (
            <Typography sx={{ fontSize: "1.125rem", color: "grey.600" }}>
              No schema changes detected.
            </Typography>
          )
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
