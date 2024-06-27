import { Check } from "@/lib/api/checks";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { SchemaView } from "../schema/SchemaView";
import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { select } from "@/lib/api/select";
import { HSplit } from "../split/Split";
import { Box, Center, Flex, Icon, List, ListItem } from "@chakra-ui/react";
import { LineageGraphNode } from "../lineage/lineage";
import { useMemo, useState } from "react";
import {
  getIconForChangeStatus,
  getIconForResourceType,
} from "../lineage/styles";
import { IconType } from "react-icons";
import { isSchemaChanged } from "../schema/schemaDiff";
import { findByRunType } from "../run/registry";

interface SchemaDiffViewProps {
  check: Check;
}

export interface SchemaDiffParams {
  node_id?: string;
  select?: string;
  exclude?: string;
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
  const { icon } = getIconForResourceType(node.resourceType);

  return (
    <Flex
      width="100%"
      fontSize="10pt"
      p="5px 8px"
      cursor="pointer"
      _hover={{ bg: "gray.200" }}
      bg={selected ? "gray.100" : "inherit"}
      onClick={() => onSelect(node.id)}
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
        {node.name}
      </Box>

      {schemaChanged && (
        <Icon
          as={findByRunType("schema_diff")?.icon}
          color={getIconForChangeStatus("modified").color}
        />
      )}
    </Flex>
  );
};

export function SchemaDiffView({ check }: SchemaDiffViewProps) {
  const { lineageGraph } = useLineageGraphContext();
  const params = check.params as SchemaDiffParams;

  const queryKey = [...cacheKeys.check(check.check_id), "select"];

  const { isLoading, error, refetch, data } = useQuery({
    queryKey,
    queryFn: async () =>
      select({ select: params?.select, exclude: params?.exclude }),
    refetchOnMount: true,
    enabled: !params?.node_id,
  });

  const [nodes, changedNodes] = useMemo(() => {
    const selectedNodes: LineageGraphNode[] = [];
    const changedNodes: string[] = [];

    if (params?.node_id) {
      const node = lineageGraph?.nodes[params.node_id];
      if (node) {
        selectedNodes.push(node);
      }
    } else {
      for (const nodeId of data?.nodes || []) {
        const node = lineageGraph?.nodes[nodeId];
        if (node) {
          selectedNodes.push(node);
        }
      }
    }

    // filter that the resourec_type is mode,seed, source, or snapshot
    const filteredNodes = selectedNodes.filter(
      (node) =>
        node.resourceType === "model" ||
        node.resourceType === "seed" ||
        node.resourceType === "source" ||
        node.resourceType === "snapshot"
    );

    for (const node of filteredNodes) {
      if (
        isSchemaChanged(node.data.base?.columns, node.data.current?.columns)
      ) {
        changedNodes.push(node.id);
      }
    }

    //sort the selectedNodes from schemaChange and node name
    filteredNodes.sort((a, b) => {
      if (changedNodes.includes(a.id) && !changedNodes.includes(b.id)) {
        return -1;
      }
      if (!changedNodes.includes(a.id) && changedNodes.includes(b.id)) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });

    return [filteredNodes, changedNodes];
  }, [params?.node_id, data?.nodes, lineageGraph]);

  const [selected, setSelected] = useState<number>(0);

  if (isLoading) {
    return (
      <Center bg="rgb(249,249,249)" height="100%">
        Loading...
      </Center>
    );
  } else if (error) {
    return (
      <Center bg="rgb(249,249,249)" height="100%">
        Error: {error?.message}
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
          base={node.data.base}
          current={node.data.current}
          enableScreenshot={true}
        />
        <List overflow="auto">
          {nodes.map((node, i) => (
            <NodelistItem
              key={i}
              node={node}
              schemaChanged={changedNodes.includes(node.id)}
              selected={i === selected}
              onSelect={() => {
                const index = i;
                setSelected(index);
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
