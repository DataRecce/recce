"use client";

import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import { useQuery } from "@tanstack/react-query";
import React, { forwardRef, useMemo, useState } from "react";
import type { IconType } from "react-icons";
import type { LineageGraphNode } from "../..";
import { HSplit, isSchemaChanged } from "../..";
import { type Check, cacheKeys, select } from "../../api";
import { useLineageGraphContext } from "../../contexts";
import { useApiConfig, useIsDark } from "../../hooks";
import type { DataGridHandle } from "../../primitives";
import {
  getIconForChangeStatus,
  getIconForResourceType,
  type IconComponent,
} from "../lineage";
import { findByRunType } from "../run";
import { SchemaView } from "../schema";

interface SchemaDiffViewProps {
  check: Check;
}

export interface SchemaDiffParams {
  node_id?: string | string[];
  select?: string;
  exclude?: string;
  view_mode?: "all" | "changed_models";
  packages?: string[];
}

const NodelistItem = ({
  node,
  selected,
  onSelect,
  schemaChanged,
  isDark,
}: {
  node: LineageGraphNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  schemaChanged: boolean;
  isDark: boolean;
}) => {
  const { icon } = getIconForResourceType(node.data.resourceType);
  const { base, current } = node.data.data;

  let statusIcon: IconComponent | IconType | undefined;
  let statusColor: string | undefined;

  if (schemaChanged) {
    statusIcon = findByRunType("schema_diff").icon;
    statusColor = getIconForChangeStatus("modified").color;
  } else if (!base && current) {
    statusIcon = getIconForChangeStatus("added").icon;
    statusColor = getIconForChangeStatus("added").color;
  } else if (base && !current) {
    statusIcon = getIconForChangeStatus("removed").icon;
    statusColor = getIconForChangeStatus("removed").color;
  }

  return (
    <ListItem disablePadding>
      <Box
        sx={{
          display: "flex",
          width: "100%",
          fontSize: "10pt",
          p: "5px 8px",
          cursor: "pointer",
          "&:hover": { bgcolor: isDark ? "grey.700" : "grey.200" },
          bgcolor: selected ? (isDark ? "grey.800" : "grey.100") : "inherit",
          alignItems: "center",
          gap: "5px",
        }}
        onClick={() => {
          onSelect(node.id);
        }}
      >
        {icon && <Box component={icon} />}
        <Box
          sx={{
            flex: 1,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {node.data.name}
        </Box>

        {statusIcon && statusColor && (
          <Box component={statusIcon} sx={{ color: statusColor }} />
        )}
      </Box>
    </ListItem>
  );
};

export function PrivateSchemaDiffView(
  { check }: SchemaDiffViewProps,
  ref: React.Ref<DataGridHandle>,
) {
  const isDark = useIsDark();
  const { apiClient } = useApiConfig();
  const { lineageGraph } = useLineageGraphContext();
  const params = check.params as SchemaDiffParams;

  const queryKey = [...cacheKeys.check(check.check_id), "select"];

  const { isLoading, error, data } = useQuery({
    queryKey,
    queryFn: async () =>
      select(
        {
          select: params.select,
          exclude: params.exclude,
          packages: params.packages,
          view_mode: params.view_mode,
        },
        apiClient,
      ),
    refetchOnMount: true,
    enabled: !params.node_id,
  });

  const [nodes, changedNodes] = useMemo(() => {
    const selectedNodes: LineageGraphNode[] = [];
    const changedNodes: string[] = [];
    const addedNodes: string[] = [];
    const removedNodes: string[] = [];

    if (params.node_id) {
      const nodeIds =
        params.node_id instanceof Array ? params.node_id : [params.node_id];
      for (const nodeId of nodeIds) {
        const node = lineageGraph?.nodes[nodeId];
        if (node) {
          selectedNodes.push(node);
        }
      }
    } else {
      for (const nodeId of data?.nodes ?? []) {
        const node = lineageGraph?.nodes[nodeId];
        if (node) {
          selectedNodes.push(node);
        }
      }
    }

    // filter that the resourec_type is mode,seed, source, or snapshot
    const filteredNodes = selectedNodes.filter(
      (node) =>
        node.data.resourceType === "model" ||
        node.data.resourceType === "seed" ||
        node.data.resourceType === "source" ||
        node.data.resourceType === "snapshot",
    );

    for (const node of filteredNodes) {
      if (
        isSchemaChanged(
          node.data.data.base?.columns,
          node.data.data.current?.columns,
        )
      ) {
        changedNodes.push(node.id);
      } else if (!node.data.data.base && node.data.data.current) {
        addedNodes.push(node.id);
      } else if (node.data.data.base && !node.data.data.current) {
        removedNodes.push(node.id);
      }
    }
    function sortScore(node: LineageGraphNode) {
      if (changedNodes.includes(node.id)) {
        return 3;
      }
      if (addedNodes.includes(node.id)) {
        return 2;
      }
      if (removedNodes.includes(node.id)) {
        return 1;
      }
      return 0;
    }

    //sort the selectedNodes from schemaChange and node name
    filteredNodes.sort((a, b) => {
      const scoreA = sortScore(a);
      const scoreB = sortScore(b);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      } else {
        return a.data.name.localeCompare(b.data.name);
      }
    });

    return [filteredNodes, changedNodes];
  }, [params.node_id, data?.nodes, lineageGraph]);

  const [selected, setSelected] = useState<number>(0);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: isDark ? "grey.900" : "grey.50",
          height: "100%",
        }}
      >
        Loading...
      </Box>
    );
  } else if (error) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: isDark ? "grey.900" : "grey.50",
          height: "100%",
        }}
        className="no-track-pii-safe"
      >
        Error: {error.message}
      </Box>
    );
  } else if (nodes.length == 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: isDark ? "grey.900" : "grey.50",
          height: "100%",
        }}
      >
        No nodes matched
      </Box>
    );
  } else if (selected < nodes.length) {
    const node = nodes[selected];
    return (
      <HSplit sizes={[80, 20]} minSize={30} style={{ height: "100%" }}>
        <SchemaView
          base={node.data.data.base}
          current={node.data.data.current}
          enableScreenshot={true}
          showMenu={false}
          ref={ref}
        />
        <List
          sx={{
            overflow: "auto",
            bgcolor: "background.paper",
            listStyle: "none",
          }}
        >
          {nodes.map((node, i) => (
            <NodelistItem
              key={node.id}
              node={node}
              schemaChanged={changedNodes.includes(node.id)}
              selected={i === selected}
              isDark={isDark}
              onSelect={() => {
                setSelected(i);
              }}
            />
          ))}
        </List>
      </HSplit>
    );
  }

  // TODO: handle the edge case where the node is not found
  return <></>;
}

export const SchemaDiffView = forwardRef(PrivateSchemaDiffView);
