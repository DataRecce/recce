import _ from "lodash";
import { ReactNode } from "react";
import { PiWarning } from "react-icons/pi";
import { Box, Flex, Spacer, VStack } from "@/components/ui/mui";
import { RunResultViewProps } from "./types";

export interface DiffViewOptions {
  changed_only?: boolean;
}

interface RunToolbarProps<VO> extends RunResultViewProps<VO> {
  warnings?: string[];
  children?: ReactNode;
}

export const RunToolbar = ({
  warnings,
  children,
}: RunToolbarProps<DiffViewOptions>) => {
  return (
    <Flex
      borderBottom="1px solid lightgray"
      justifyContent="flex-end"
      gap="5px"
      alignItems="center"
      px="10px"
      bg={warnings && warnings.length > 0 ? "amber.100" : "inherit"}
    >
      <VStack alignItems="flex-start" gap={0}>
        {warnings?.map((warning) => (
          <Box key={_.uniqueId(`-${warning}`)}>
            <PiWarning color="amber.600" /> {warning}
          </Box>
        ))}
      </VStack>
      <Spacer minHeight="32px" />
      {children}
    </Flex>
  );
};
