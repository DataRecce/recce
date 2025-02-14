import "react-data-grid/lib/styles.css";
import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  createSimpleCheck,
  listChecks,
  reorderChecks,
} from "@/lib/api/checks";
import { Box, Center, Divider, Flex, VStack } from "@chakra-ui/react";
import { CheckDetail } from "./CheckDetail";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import _ from "lodash";
import { Route, Switch, useLocation, useRoute } from "wouter";
import { CheckList } from "./CheckList";
import { buildDescription, buildTitle } from "./check";
import { stripIndents } from "common-tags";
import { HSplit } from "../split/Split";
import { StateImporter } from "../app/StateImporter";

export const CheckPage = () => {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/checks/:checkId");
  const queryClient = useQueryClient();
  const selectedItem = params?.checkId;

  const {
    isLoading,
    error,
    data: checks,
    status,
    refetch: refetchCheckList,
  } = useQuery({
    queryKey: cacheKeys.checks(),
    queryFn: listChecks,
    refetchOnMount: true,
  });

  const handleSelectItem = useCallback(
    (checkId: string) => {
      setLocation(`/checks/${checkId}`);
    },
    [setLocation]
  );

  const [orderedChecks, setOrderedChecks] = useState(checks || []);
  const { mutate: changeChecksOrder } = useMutation({
    mutationFn: (order: { source: number; destination: number }) =>
      reorderChecks(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });

  const handleDragEnd = useCallback(
    (source: number, destination: number) => {
      const updatedItems = [...orderedChecks];
      const [reorderedItem] = updatedItems.splice(source, 1);
      updatedItems.splice(destination, 0, reorderedItem);

      changeChecksOrder({
        source,
        destination,
      });

      setOrderedChecks(updatedItems);
    },
    [orderedChecks, setOrderedChecks, changeChecksOrder]
  );

  const addToChecklist = useCallback(async () => {
    const check = await createSimpleCheck();
    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });

    handleSelectItem(check.check_id);
  }, [queryClient, handleSelectItem]);

  useEffect(() => {
    if (status !== "success") {
      return;
    }

    if (!selectedItem && checks.length > 0) {
      setLocation(`/checks/${checks[0].check_id}`);
    }

    setOrderedChecks(checks);
  }, [status, selectedItem, checks, setOrderedChecks, setLocation]);

  if (isLoading) {
    return <></>;
  }

  if (error) {
    return <>Error: {error.message}</>;
  }

  if (!checks?.length) {
    return (
      <Center h="100%">
        <Box>No checks</Box>
      </Center>
    );
  }

  return (
    <HSplit style={{ height: "100%" }} minSize={50} sizes={[20, 80]}>
      <Box
        borderRight="lightgray solid 1px"
        height="100%"
        style={{ contain: "size" }}
      >
        <VStack
          spacing={0}
          h="100%"
          style={{ contain: "strict" }}
          alignItems="stretch"
        >
          <Flex justifyContent="right" padding="0px 10px">
            <StateImporter checksOnly />
          </Flex>
          <Divider />
          <CheckList
            checks={orderedChecks}
            selectedItem={selectedItem}
            onCheckSelected={handleSelectItem}
            onChecksReordered={handleDragEnd}
          />
        </VStack>
      </Box>
      <Box height="100%">
        <Switch>
          <Route path="/checks/:checkId">
            {(params) => {
              return (
                <CheckDetail
                  key={params.checkId}
                  checkId={params.checkId}
                  refreshCheckList={refetchCheckList}
                />
              );
            }}
          </Route>
        </Switch>
      </Box>
    </HSplit>
  );
};

function buildMarkdown(checks: Check[]) {
  const checkItems = checks.map((check) => {
    return stripIndents`
    <details><summary>${buildTitle(check)}</summary>

    ${buildDescription(check)}

    </details>`;
  });

  return checkItems.join("\n\n");
}
