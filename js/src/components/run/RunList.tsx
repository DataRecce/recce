import "react-data-grid/lib/styles.css";
import React from "react";
import { Check, updateCheck } from "@/lib/api/checks";
import {
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Icon,
  VStack,
  Text,
  IconButton,
  Spacer,
  Badge,
} from "@chakra-ui/react";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import _ from "lodash";
import { FaCheckCircle } from "react-icons/fa";
import { TbChecklist } from "react-icons/tb";
import { IconType } from "react-icons";
import { findByRunType } from "../run/registry";
import { Run } from "@/lib/api/types";
import { listRuns } from "@/lib/api/runs";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { formatDistanceToNow } from "date-fns";
import { RepeatIcon } from "@chakra-ui/icons";

const RunListItem = ({ run }: { run: Run }) => {
  const relativeTime = run?.run_at
    ? formatDistanceToNow(new Date(run.run_at), { addSuffix: true })
    : null;

  const icon: IconType = findByRunType(run.type)?.icon || TbChecklist;

  return (
    <Flex
      direction="column"
      width="100%"
      p="5px 20px"
      borderBottom="solid 1px lightgray"
      cursor="pointer"
      _hover={{ bg: "gray.200" }}
    >
      <Flex onClick={() => {}} alignItems="center" gap="12px">
        <Icon as={icon} />
        <Box
          flex="1"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          overflow="hidden"
          fontSize="12pt"
          fontWeight="bold"
        >
          {
            //first 8 characters of run_id
            `<run name>_${run.run_id.slice(0, 8).toUpperCase()}`
          }
        </Box>
        <Box
          backgroundColor="blue.50"
          textColor="blue.500"
          fontSize="10pt"
          fontWeight={500}
          padding="5px"
          borderRadius="5px"
        >
          {"<type>"}
        </Box>

        <Icon color="green" as={FaCheckCircle} />
      </Flex>
      <Flex justifyContent="start">
        <Text fontWeight={500} color="green.400">
          Successful
        </Text>
        <Text color="gray.500"> • {relativeTime}</Text>
      </Flex>
    </Flex>
  );
};

export const RunList = () => {
  const {
    data: runs,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: cacheKeys.runs(),
    queryFn: async () => {
      // wait 2 sec
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return await listRuns();
    },
  });
  const { showRunId } = useRecceActionContext();
  const handleRunClick = (runId: string) => () => {
    showRunId(runId);
  };

  return (
    <VStack spacing="0" overflow={"auto"}>
      <HStack width="100%" paddingInline="20px">
        <Box>History</Box>
        <Spacer />
        <IconButton
          variant={"unstyled"}
          icon={<RepeatIcon />}
          aria-label="Search database"
          onClick={() => {
            refetch();
          }}
        />
      </HStack>

      <Divider />
      {(runs || []).map((run, index) => {
        return (
          <Flex w="full" onClick={handleRunClick(run.run_id)}>
            <RunListItem key={run.run_id} run={run} />
          </Flex>
        );
      })}
    </VStack>
  );
};
