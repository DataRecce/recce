import "react-data-grid/lib/styles.css";
import React, { useState } from "react";
import { Check, listChecks, updateCheck } from "@/lib/api/checks";
import { Box, Flex, VStack, Center, Checkbox } from "@chakra-ui/react";
import { CheckDetail } from "./CheckDetail";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const ChecklistItem = ({
  check,
  selected,
  onSelect,
}: {
  check: Check;
  selected: boolean;
  onSelect: (check: Check) => void;
}) => {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationKey: cacheKeys.check(check.check_id),
    mutationFn: updateCheck,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });

  const handleChange: React.ChangeEventHandler = (event) => {
    const isChecked: boolean = (event.target as any).checked;
    mutate({ check_id: check.check_id, isChecked });
  };

  return (
    <Flex
      width="100%"
      p="10px 20px"
      cursor="pointer"
      _hover={{ bg: "gray.200" }}
      bg={selected ? "gray.100" : "inherit"}
      onClick={() => onSelect(check)}
      gap="5px"
    >
      <Center
        onClick={(e) => {
          e.stopPropagation;
        }}
      >
        <Checkbox isChecked={check.isChecked} onChange={handleChange} />
      </Center>
      {check.name}
    </Flex>
  );
};

export const CheckPage = () => {
  const [selectedItem, setSelectedItem] = useState<Check | null>(null);
  const {
    isFetching,
    error,
    data: checks,
  } = useQuery({
    queryKey: cacheKeys.checks(),
    queryFn: listChecks,
    refetchOnMount: true,
  });

  if (isFetching) {
    return <>Loading</>;
  }

  if (error) {
    return <>Error: {error.message}</>;
  }

  if (!checks?.length) {
    return <Center h="100%">No checks</Center>;
  }

  const handleSelectItem = (check: Check) => {
    setSelectedItem(check);
  };

  return (
    <Flex height="100%">
      <Box flex="0 0 400px" borderRight="lightgray solid 1px" height="100%">
        <VStack spacing={0}>
          {checks.map((check) => (
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
