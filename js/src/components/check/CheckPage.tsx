import "react-data-grid/lib/styles.css";
import React, { useState } from "react";
import { Check, useListChecks } from "@/lib/api/checks";
import {
  Box,
  Flex,
  VStack,
  Text,
  Divider,
  useMediaQuery,
  Center,
  Checkbox,
} from "@chakra-ui/react";
import { CheckDetail } from "./CheckDetail";

const ChecklistItem = ({
  check,
  selected,
  onSelect,
}: {
  check: Check;
  selected: boolean;
  onSelect: (check: Check) => void;
}) => (
  <Flex
    width="100%"
    p="10px 20px"
    cursor="pointer"
    _hover={{ bg: "gray.200" }}
    bg={selected ? "gray.100" : "inherit"}
    onClick={() => onSelect(check)}
    gap="5px"
  >
    <Checkbox checked></Checkbox>
    {check.name}
  </Flex>
);

export const CheckPage = () => {
  const [selectedItem, setSelectedItem] = useState<Check | null>(null);
  const [isLargerThan768px] = useMediaQuery("(min-width: 768px)");
  const checks = useListChecks();

  if (checks.isFetching) {
    return <>Loading</>;
  }

  if (checks.isError) {
    return <>Error: {checks.error.message}</>;
  }

  if (checks.data === undefined || (checks.data && checks.data.length == 0)) {
    return <Center h="100%">No checks</Center>;
  }

  const handleSelectItem = (check: Check) => {
    setSelectedItem(check);
  };

  return (
    <Flex height="100%">
      <Box flex="0 0 400px" borderRight="lightgray solid 1px" height="100%">
        <VStack spacing={0}>
          {checks.data.map((check) => (
            <ChecklistItem
              key={check.check_id}
              check={check}
              selected={check === selectedItem}
              onSelect={handleSelectItem}
            />
          ))}
        </VStack>
      </Box>
      <Box flex="1" height="100%" width="calc(100% - 400px)">
        {selectedItem && <CheckDetail checkId={selectedItem.check_id} />}
      </Box>
    </Flex>
  );
};
