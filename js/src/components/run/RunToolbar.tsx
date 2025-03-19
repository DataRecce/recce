import { WarningIcon } from "@chakra-ui/icons";
import { Box, Flex, Spacer, VStack } from "@chakra-ui/react";
import { RunResultViewProps } from "./types";

interface DiffViewOptions {
  changed_only?: boolean;
}

interface RunToolbarProps<PT, RT, VO> extends RunResultViewProps<PT, RT, VO> {
  warnings?: string[];
  children?: React.ReactNode;
}

export const RunToolbar = <PT, RT>({
  warnings,
  children,
}: RunToolbarProps<PT, RT, DiffViewOptions>) => {
  return (
    <Flex
      borderBottom="1px solid lightgray"
      justifyContent="flex-end"
      gap="5px"
      alignItems="center"
      px="10px"
      bg={warnings && warnings.length > 0 ? "orange.100" : "inherit"}>
      <VStack alignItems="flex-start" spacing={0}>
        {warnings?.map((warning, idx) => (
          <Box key={idx}>
            <WarningIcon color="orange.600" /> {warning}
          </Box>
        ))}
      </VStack>
      <Spacer minHeight="32px" />
      {children}
    </Flex>
  );
};
