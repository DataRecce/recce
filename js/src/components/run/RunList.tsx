import "react-data-grid/lib/styles.css";
import React from "react";
import { Check, updateCheck } from "@/lib/api/checks";
import { Box, Divider, Flex, Icon, VStack } from "@chakra-ui/react";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import _ from "lodash";
import { FaCheckCircle } from "react-icons/fa";
import { TbChecklist } from "react-icons/tb";
import { IconType } from "react-icons";
import { findByRunType } from "../run/registry";
import { Run } from "@/lib/api/types";
import { listRuns } from "@/lib/api/runs";

const RunListItem = ({ run }: { run: Run }) => {
  const queryClient = useQueryClient();
  const runId = run.run_id!;

  const icon: IconType = findByRunType(run.type)?.icon || TbChecklist;

  return (
    <Flex
      width="100%"
      p="10px 20px"
      cursor="pointer"
      _hover={{ bg: "gray.200" }}
      onClick={() => {}}
      alignItems="center"
      gap="5px"
    >
      <Icon as={icon} />
      <Box
        flex="1"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
        overflow="hidden"
      >
        {run.run_id}
      </Box>

      <Icon color="green" as={FaCheckCircle} />
    </Flex>
  );
};

export const RunList = () => {
  const {
    data: runs,
    isLoading,
    error,
  } = useQuery({
    queryKey: cacheKeys.runs(),
    queryFn: listRuns,
  });

  return (
    <VStack spacing="0" overflow={"auto"}>
      <Box>History</Box>

      <Divider />
      {(runs || []).map((run, index) => {
        return (
          <Flex w="full">
            <RunListItem key={run.run_id} run={run} />
          </Flex>
        );
      })}
    </VStack>
  );
};
