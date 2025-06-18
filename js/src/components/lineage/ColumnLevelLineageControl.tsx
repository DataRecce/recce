import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { CloseIcon, InfoOutlineIcon } from "@chakra-ui/icons";
import {
  Flex,
  Text,
  IconButton,
  Code,
  Icon,
  Link,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
} from "@chakra-ui/react";
import { useLineageViewContextSafe } from "./LineageViewContext";

interface ColumnLevelLineageControlProps {
  node: string;
  column: string;
  reset?: () => void;
}
export const ColumnLevelLineageControl = ({
  node,
  column,
  reset,
}: ColumnLevelLineageControlProps) => {
  const { lineageGraph } = useLineageGraphContext();
  const { centerNode } = useLineageViewContextSafe();

  if (!lineageGraph) {
    return <></>;
  }

  const nodeName = lineageGraph.nodes[node].name;

  const navigateToNode = () => {
    const nodeId = column ? `${node}_${column}` : node;
    centerNode(nodeId);
  };

  return (
    <Flex
      direction="row"
      alignItems="center"
      gap="5px"
      p="5px 10px"
      borderRadius="md"
      boxShadow="md"
      border="1px solid"
      borderColor="gray.200"
      bg="white"
      fontSize={"10pt"}>
      <Text>{column ? "Column Lineage" : "Impact Radius"} for</Text>
      <Code onClick={navigateToNode} cursor="pointer">
        {nodeName}
        {column ? `.${column}` : ""}
      </Code>
      <Popover trigger="hover" placement="top-start">
        <PopoverTrigger>
          <Icon boxSize="10px" as={InfoOutlineIcon} color="gray.500" cursor="pointer" />
        </PopoverTrigger>
        <PopoverContent bg="black" color="white">
          <PopoverBody fontSize="sm">
            Column-Level Lineage provides visibility into the upstream and downstream relationships
            of a column.{" "}
            <Link
              href="https://docs.datarecce.io/features/column-level-lineage/"
              target="_blank"
              textDecoration="underline">
              Learn more
            </Link>
            .
          </PopoverBody>
        </PopoverContent>
      </Popover>
      {reset && <IconButton icon={<CloseIcon />} aria-label={""} onClick={reset} size="xs" />}
    </Flex>
  );
};
