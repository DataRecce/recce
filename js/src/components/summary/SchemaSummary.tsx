import { Card, CardProps, CardBody, CardHeader, Flex, Heading, SimpleGrid, Text } from "@chakra-ui/react";
import { DefaultLineageGraphSets, LineageGraphNode } from "../lineage/lineage";
import { SchemaView } from "../schema/SchemaView";
import { mergeColumns } from "../schema/schema";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import { useEffect, useState } from "react";

interface SchemaDiffCardProps {
  node: LineageGraphNode;
}

function SchemaDiffCard({
  node,
  ...props
 }: CardProps & SchemaDiffCardProps) {
  return (
  <Card maxWidth={'500px'}>
    <CardHeader>
      <Heading fontSize={18}>{props.title}</Heading>
      <Text fontSize={14} color={'gray'}>{node.resourceType}</Text>
    </CardHeader>
    <CardBody>
      <Flex>
        <SchemaView base={node.data.base} current={node.data.current} />
      </Flex>
    </CardBody>
  </Card>
  );
}

function listChangedNodes(lineageGraphSets: DefaultLineageGraphSets) {
  const changedNodes: LineageGraphNode[] = [];
  const allNodes = lineageGraphSets.all.nodes;
  lineageGraphSets.modifiedSet.forEach((nodeId) => {
    const node = allNodes[nodeId];
    const columnDiffStatus = mergeKeysWithStatus( Object.keys(node.data.base?.columns || {}),  Object.keys(node.data.current?.columns || {}));
    const isSchemaChanged = !Object.values(columnDiffStatus).every(el => el === undefined);

    // We only want to show nodes that have schema changes
    if (isSchemaChanged)
      changedNodes.push(node);
  })
  return changedNodes;
}

export interface Props {
  lineageGraphSets: DefaultLineageGraphSets
}

export function SchemaSummary({ lineageGraphSets }: Props) {
  const [changedNodes, setChangedNodes] = useState<LineageGraphNode[]>([]);

  useEffect(() => {
    setChangedNodes(listChangedNodes(lineageGraphSets));
  }, [lineageGraphSets]);

  return (<>
    <Flex w={'100%'} paddingBottom="10px" marginBottom="20px" marginTop="20px" >
      <Heading fontSize={24}>Schema Summary</Heading>
    </Flex>
    <Flex w={'100%'} paddingBottom="10px" marginBottom="20px">
    {(changedNodes.length === 0) ? (
      <>
        <Text fontSize={18} color={'gray'}>No schema changes detected.</Text>
      </>
    ):(
      <>

        <SimpleGrid
          minChildWidth='500px'
          spacing={'2vw'}
          padding={'2.5vw'}
          width={'100%'}
          backgroundColor={'lightgray'}
        >
          {changedNodes.map((node) => {
            return <SchemaDiffCard key={node.id} title={node.name} node={node} />;
          })}
        </SimpleGrid>

      </>
    )}
    </Flex>
  </>);
}
