import { AddIcon, WarningIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Checkbox,
  Flex,
  IconButton,
  Spacer,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { RunResultViewProps } from "./types";
import { Run } from "@/lib/api/types";

interface DiffViewOptions {
  changed_only?: boolean;
}

interface RunToolbarProps<PT, RT, VO> extends RunResultViewProps<PT, RT, VO> {
  warnings?: string[];
  onAddToChecklist?: (run: Run<PT, RT>) => void;
}

export const RunToolbar = <PT, RT>({
  run,
  warnings,
  viewOptions,
  onAddToChecklist,
  onViewOptionsChanged,
}: RunToolbarProps<PT, RT, DiffViewOptions>) => {
  const toggleChangedOnly = () => {
    const changedOnly = !viewOptions?.changed_only;
    if (onViewOptionsChanged) {
      onViewOptionsChanged({ ...viewOptions, changed_only: changedOnly });
    }
  };

  return (
    <Flex
      borderBottom="1px solid lightgray"
      justifyContent="flex-end"
      gap="5px"
      alignItems="center"
      px="10px"
      bg={warnings && warnings.length > 0 ? "orange.100" : "inherit"}
    >
      <VStack alignItems="flex-start" spacing={0}>
        {warnings &&
          warnings.map((warning, idx) => (
            <Box key={idx}>
              <WarningIcon color="orange.600" /> {warning}
            </Box>
          ))}
      </VStack>
      <Spacer minHeight="32px" />
      <Checkbox
        isChecked={viewOptions?.changed_only}
        onChange={toggleChangedOnly}
      >
        Changed only
      </Checkbox>
      {onAddToChecklist && (
        <Button
          marginBlock="5px"
          size="sm"
          colorScheme="blue"
          onClick={() => onAddToChecklist(run)}
        >
          Add to Checklist
        </Button>
      )}
    </Flex>
  );
};
