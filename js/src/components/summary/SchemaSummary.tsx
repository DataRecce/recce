import {
  Card,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import { LineageGraph, LineageGraphNode } from "../lineage/lineage";
import { ResourceTypeTag, RowCountDiffTag } from "../lineage/NodeTag";
import { SchemaView } from "../schema/SchemaView";

interface SchemaDiffCardProps {
  title: string;
  node: LineageGraphNode;
}

function SchemaDiffCard({ node, ...props }: SchemaDiffCardProps) {
  return (
    <Card.Root maxWidth={"500px"}>
      <Card.Header>
        <Card.Title fontSize={18}>{props.title}</Card.Title>
        <Card.Description>
          <HStack gap={"8px"} p={"16px"}>
            <ResourceTypeTag node={node} />
            {node.data.resourceType === "model" && (
              <RowCountDiffTag node={node} />
            )}
          </HStack>
        </Card.Description>
      </Card.Header>
      <Card.Body>
        <Flex>
          <SchemaView
            base={node.data.data.base}
            current={node.data.data.current}
          />
        </Flex>
      </Card.Body>
    </Card.Root>
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

export interface Props {
  lineageGraph: LineageGraph;
}

export function SchemaSummary({ lineageGraph }: Props) {
  const [changedNodes, setChangedNodes] = useState<LineageGraphNode[]>([]);

  useEffect(() => {
    setChangedNodes(listChangedNodes(lineageGraph));
  }, [lineageGraph]);

  return (
    <>
      <Flex
        w={"100%"}
        paddingBottom="10px"
        marginBottom="20px"
        marginTop="20px"
      >
        <Heading fontSize={24}>Schema Summary</Heading>
      </Flex>
      <Flex w={"100%"} paddingBottom="10px" marginBottom="20px">
        {changedNodes.length === 0 ? (
          <>
            <Text fontSize={18} color={"gray"}>
              No schema changes detected.
            </Text>
          </>
        ) : (
          <>
            <SimpleGrid
              minChildWidth="400px"
              gap={"2vw"}
              padding={"2.5vw"}
              width={"100%"}
              backgroundColor={"lightgray"}
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
            </SimpleGrid>
          </>
        )}
      </Flex>
    </>
  );
}
