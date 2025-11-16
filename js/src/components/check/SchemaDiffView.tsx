import { Box, Center, Flex, Icon, List } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import React, { forwardRef, useMemo, useState } from "react";
import { DataGridHandle } from "react-data-grid";
import { IconType } from "react-icons";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check } from "@/lib/api/checks";
import { select } from "@/lib/api/select";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { LineageGraphNode } from "../lineage/lineage";
import {
  getIconForChangeStatus,
  getIconForResourceType,
} from "../lineage/styles";
import { findByRunType } from "../run/registry";
import { SchemaView } from "../schema/SchemaView";
import { isSchemaChanged } from "../schema/schemaDiff";
import { HSplit } from "../split/Split";

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
}: {
  node: LineageGraphNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  schemaChanged: boolean;
}) => {
  const { icon } = getIconForResourceType(node.data.resourceType);
  const { base, current } = node.data.data;

  let statusIcon: IconType | undefined;
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
    <List.Item>
      <Flex
        width="100%"
        fontSize="10pt"
        p="5px 8px"
        cursor="pointer"
        _hover={{ bg: "gray.200" }}
        bg={selected ? "gray.100" : "inherit"}
        onClick={() => {
          onSelect(node.id);
        }}
        alignItems="center"
        gap="5px"
      >
        <Icon as={icon} />
        <Box
          flex="1"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          overflow="hidden"
        >
          {node.data.name}
        </Box>

        {statusIcon && statusColor && (
          <Icon as={statusIcon} color={statusColor} />
        )}
      </Flex>
    </List.Item>
  );
};

export function PrivateSchemaDiffView(
  { check }: SchemaDiffViewProps,
  ref: React.Ref<DataGridHandle>,
) {
  const { lineageGraph } = useLineageGraphContext();
  const params = check.params as SchemaDiffParams;

  const queryKey = [...cacheKeys.check(check.check_id), "select"];

  const { isLoading, error, data } = useQuery({
    queryKey,
    queryFn: async () =>
      select({
        select: params.select,
        exclude: params.exclude,
        packages: params.packages,
        view_mode: params.view_mode,
      }),
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
      <Center bg="rgb(249,249,249)" height="100%">
        Loading...
      </Center>
    );
  } else if (error) {
    return (
      <Center bg="rgb(249,249,249)" height="100%" className="no-track-pii-safe">
        Error: {error.message}
      </Center>
    );
  } else if (nodes.length == 0) {
    return (
      <Center bg="rgb(249,249,249)" height="100%">
        No nodes matched
      </Center>
    );
  } else if (selected < nodes.length) {
    const node = nodes[selected];
    return (
      <HSplit sizes={[80, 20]} minSize={30} style={{ height: "100%" }}>
        <SchemaView
          base={node.data.data.base}
          current={node.data.data.current}
          enableScreenshot={true}
          ref={ref}
        />
        <List.Root
          overflow="auto"
          backgroundColor="white"
          as="ul"
          listStyle="none"
        >
          {nodes.map((node, i) => (
            <NodelistItem
              key={node.id}
              node={node}
              schemaChanged={changedNodes.includes(node.id)}
              selected={i === selected}
              onSelect={() => {
                setSelected(i);
              }}
            />
          ))}
        </List.Root>
      </HSplit>
    );
  }

  // TODO: handle the edge case where the node is not found
  return <></>;
}

export const SchemaDiffView = forwardRef(PrivateSchemaDiffView);
