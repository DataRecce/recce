import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Center,
  Checkbox,
  Flex,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Spacer,
  Textarea,
} from "@chakra-ui/react";
import SqlEditor from "../query/SqlEditor";
import { QueryDiffDataGrid } from "../query/QueryDiffDataGrid";
import { useEffect, useState } from "react";

interface CheckDetailProps {
  checkId: string;
}

import { DeleteIcon } from "@chakra-ui/icons";
import { CheckBreadcrumb } from "./CheckBreadcrumb";
import { VscKebabVertical } from "react-icons/vsc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check, getCheck, updateCheck } from "@/lib/api/checks";
import { QueryDiffResult } from "@/lib/api/adhocQuery";

export const CheckDetail = ({ checkId }: CheckDetailProps) => {
  const queryClient = useQueryClient();
  const {
    isLoading,
    error,
    data: check,
  } = useQuery({
    queryKey: cacheKeys.check(checkId),
    queryFn: () => getCheck(checkId),
  });

  const { mutate } = useMutation({
    mutationFn: (check: Partial<Check>) => updateCheck(checkId, check),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cacheKeys.check(checkId) });
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });

  if (isLoading) {
    return <Center h="100%">Loading</Center>;
  }

  if (error) {
    return <Center h="100%">Error: {error.message}</Center>;
  }

  const handleCheck: React.ChangeEventHandler = (event) => {
    const isChecked: boolean = (event.target as any).checked;
    mutate({ is_checked: isChecked });
  };

  return (
    <Flex height="100%" width="100%" maxHeight="100%" direction="column">
      <Flex p="8px 16px" alignItems="center">
        <CheckBreadcrumb
          name={check?.name || ""}
          setName={(name) => {
            mutate({ name });
          }}
        />
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<Icon as={VscKebabVertical} />}
            variant="ghost"
          />
          <MenuList>
            <MenuItem icon={<DeleteIcon />}>Delete</MenuItem>
          </MenuList>
        </Menu>
        <Spacer />
        <Checkbox isChecked={check?.is_checked} onChange={handleCheck}>
          Check
        </Checkbox>
      </Flex>

      <Accordion defaultIndex={[]} allowToggle>
        <AccordionItem>
          <AccordionButton>
            <Box as="span" textAlign="left">
              description
            </Box>
            <AccordionIcon />
          </AccordionButton>

          <AccordionPanel pb={4}>
            <Textarea width="100%" height="400px"></Textarea>
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem>
          <AccordionButton>
            query
            <AccordionIcon />
          </AccordionButton>

          <AccordionPanel>
            <Box height="400px" width="100%" border="lightgray 1px solid ">
              <SqlEditor value={(check?.params as any).sql_template} />
            </Box>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>

      <Box flex="1" style={{ contain: "size" }}>
        <QueryDiffDataGrid
          isFetching={false}
          result={check?.last_run?.result}
          primaryKeys={(check?.params as QueryDiffResult).primary_keys || []}
        />
      </Box>
    </Flex>
  );
};
