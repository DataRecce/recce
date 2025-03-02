import {
  Card,
  CardProps,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  SimpleGrid,
  Text,
  HStack,
  Tooltip,
  Tag,
  TagLeftIcon,
  TagLabel,
  SkeletonText,
} from "@chakra-ui/react";
import { LineageGraph, LineageGraphNode } from "../lineage/lineage";
import { SchemaView } from "../schema/SchemaView";
import { mergeColumns } from "../schema/schema";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import { useEffect, useState } from "react";
import { ResourceTypeTag, RowCountDiffTag } from "../lineage/NodeTag";

interface SchemaDiffCardProps {
  node: LineageGraphNode;
}

function SchemaDiffCard({ node, ...props }: CardProps & SchemaDiffCardProps) {
  return (
    <Card maxWidth={"500px"}>
      <CardHeader>
        <Heading fontSize={18}>{props.title}</Heading>
        <HStack spacing={"8px"} p={"16px"}>
          <ResourceTypeTag node={node} />
          {node.resourceType === "model" && <RowCountDiffTag node={node} />}
        </HStack>
      </CardHeader>
      <CardBody>
        <Flex>
          <SchemaView base={node.data.base} current={node.data.current} />
        </Flex>
      </CardBody>
    </Card>
  );
}

function listChangedNodes(lineageGraph: LineageGraph) {
  const changedNodes: LineageGraphNode[] = [];
  const allNodes = lineageGraph.nodes;
  lineageGraph.modifiedSet.forEach((nodeId) => {
    const node = allNodes[nodeId];
    const columnDiffStatus = mergeKeysWithStatus(
      Object.keys(node.data.base?.columns || {}),
      Object.keys(node.data.current?.columns || {}),
    );
    const isSchemaChanged = !Object.values(columnDiffStatus).every((el) => el === undefined);
    // We only want to show nodes that have real schema changes.
    // It doesn't include added or deleted model.
    if (isSchemaChanged && node.data.base && node.data.current) changedNodes.push(node);
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
      <Flex w={"100%"} paddingBottom="10px" marginBottom="20px" marginTop="20px">
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
              spacing={"2vw"}
              padding={"2.5vw"}
              width={"100%"}
              backgroundColor={"lightgray"}>
              {changedNodes.map((node) => {
                return <SchemaDiffCard key={node.id} title={node.name} node={node} />;
              })}
            </SimpleGrid>
          </>
        )}
      </Flex>
    </>
  );
}
