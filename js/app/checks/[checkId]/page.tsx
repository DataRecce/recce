"use client";

import { Box, Center, Flex, Separator, VStack } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import React, { ReactNode, useCallback, useEffect, useState } from "react";
import { StateImporter } from "@/components/app/StateImporter";
import { CheckDetail } from "@/components/check/CheckDetail";
import { CheckEmptyState } from "@/components/check/CheckEmptyState";
import { CheckList } from "@/components/check/CheckList";
import { HSplit } from "@/components/split/Split";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { listChecks, reorderChecks } from "@/lib/api/checks";
import { useRecceCheckContext } from "@/lib/hooks/RecceCheckContext";
import { useAppLocation } from "@/lib/hooks/useAppRouter";

export default function CheckPage(): ReactNode {
  const [, setLocation] = useAppLocation();
  const params = useParams<{ checkId: string }>();
  const { latestSelectedCheckId, setLatestSelectedCheckId } =
    useRecceCheckContext();
  const queryClient = useQueryClient();
  const selectedItem = params.checkId;

  useEffect(() => {
    if (selectedItem) {
      setLatestSelectedCheckId(selectedItem);
    }
  }, [selectedItem, setLatestSelectedCheckId]);

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
      setLocation(`/checks/?id=${checkId}`);
    },
    [setLocation],
  );

  const [orderedChecks, setOrderedChecks] = useState(checks ?? []);
  const [prevChecks, setPrevChecks] = useState(checks);

  // Sync orderedChecks with checks when checks data changes (during render)
  if (checks !== prevChecks) {
    setPrevChecks(checks);
    setOrderedChecks(checks ?? []);
  }

  const { mutate: changeChecksOrder } = useMutation({
    mutationFn: (order: { source: number; destination: number }) =>
      reorderChecks(order),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
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
    [orderedChecks, changeChecksOrder],
  );

  useEffect(() => {
    if (status !== "success") {
      return;
    }

    if (!selectedItem && checks.length > 0) {
      if (latestSelectedCheckId) {
        setLocation(`/checks/?id=${latestSelectedCheckId}`);
      } else {
        // If no check is selected, select the first one by default
        setLocation(`/checks/?id=${checks[0].check_id}`);
      }
    }
  }, [status, selectedItem, checks, setLocation, latestSelectedCheckId]);

  if (isLoading) {
    return <></>;
  }

  if (error) {
    return (
      <>
        Error: <span className="no-track-pii-safe">{error.message}</span>
      </>
    );
  }

  if (!checks?.length) {
    return (
      <HSplit style={{ height: "100%" }} minSize={50} sizes={[20, 80]}>
        <Box
          borderRight="lightgray solid 1px"
          height="100%"
          style={{ contain: "size" }}
        >
          <VStack
            gap={0}
            h="100%"
            style={{ contain: "strict" }}
            alignItems="stretch"
          >
            <Flex justifyContent="flex-end" padding="0px 10px">
              <StateImporter checksOnly />
            </Flex>
            <Separator />
            <Center h="100%">
              <Box textAlign="center" color="gray.500">
                No checks
              </Box>
            </Center>
          </VStack>
        </Box>
        <Box>
          <Center h="100%">
            <CheckEmptyState />
          </Center>
        </Box>
      </HSplit>
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
          gap={0}
          h="100%"
          style={{ contain: "strict" }}
          alignItems="stretch"
        >
          <Flex justifyContent="right" padding="0px 10px">
            <StateImporter checksOnly />
          </Flex>
          <Separator />
          <CheckList
            checks={orderedChecks}
            selectedItem={selectedItem}
            onCheckSelected={handleSelectItem}
            onChecksReordered={handleDragEnd}
          />
        </VStack>
      </Box>
      <Box height="100%">
        {selectedItem && (
          <CheckDetail
            key={selectedItem}
            checkId={selectedItem}
            refreshCheckList={refetchCheckList}
          />
        )}
      </Box>
    </HSplit>
  );
}
