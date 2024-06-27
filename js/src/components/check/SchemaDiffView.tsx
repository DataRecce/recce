import { Check } from "@/lib/api/checks";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { SchemaView } from "../schema/SchemaView";
import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { select } from "@/lib/api/select";
import { HSplit } from "../split/Split";
import { Box, Center, Flex, Icon, List, ListItem } from "@chakra-ui/react";
import { LineageGraphNode } from "../lineage/lineage";
import { useState } from "react";
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
}: {
  node: LineageGraphNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
}) => {
  const { icon } = getIconForResourceType(node.resourceType);
  const schemaChanged = isSchemaChanged(
    node.data.base?.columns,
    node.data.current?.columns
  );

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

  let nodes: LineageGraphNode[] = [];
  const [selected, setSelected] = useState<number>(0);

  if (params?.node_id) {
    const node = lineageGraph?.nodes[params.node_id];
    if (node) {
      nodes.push(node);
    }
  } else {
    for (const nodeId of data?.nodes || []) {
      const node = lineageGraph?.nodes[nodeId];
      if (node) {
        nodes.push(node);
      }
    }
  }

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
      <HSplit sizes={[80, 20]} minSize={200} style={{ height: "100%" }}>
        <SchemaView
          base={node.data.base}
          current={node.data.current}
          enableScreenshot={true}
        />
        <List>
          {nodes.map((node, i) => (
            <NodelistItem
              key={i}
              node={node}
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
