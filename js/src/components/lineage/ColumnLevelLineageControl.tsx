import { CloseIcon } from "@chakra-ui/icons";
import { Flex, Button, Text, IconButton, Code } from "@chakra-ui/react";

interface ColumnLevelLineageControlProps {
  node: string;
  column: string;
  reset: () => void;
}
export const ColumnLevelLineageControl = ({
  node,
  column,
  reset,
}: ColumnLevelLineageControlProps) => {
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
      fontSize={"10pt"}
    >
      <Text>Column Lineage for</Text>
      <Code>
        {node}.{column}
      </Code>
      <IconButton
        icon={<CloseIcon />}
        aria-label={""}
        onClick={reset}
        size="xs"
      >
        Reset
      </IconButton>
    </Flex>
  );
};
