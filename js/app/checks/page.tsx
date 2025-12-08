"use client";

import {
  Box,
  Center,
  Flex,
  Separator,
  Spinner,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import React, {
  ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { StateImporter } from "@/components/app/StateImporter";
import { CheckDetail } from "@/components/check/CheckDetail";
import { CheckEmptyState } from "@/components/check/CheckEmptyState";
import { CheckList } from "@/components/check/CheckList";
import { HSplit } from "@/components/split/Split";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { listChecks, reorderChecks } from "@/lib/api/checks";
import { useRecceCheckContext } from "@/lib/hooks/RecceCheckContext";
import { useAppLocation } from "@/lib/hooks/useAppRouter";

/**
 * Wrapper component that handles the Suspense boundary for useSearchParams
 */
export default function CheckPageWrapper(): ReactNode {
  return (
    <Suspense fallback={<CheckPageLoading />}>
      <CheckPageContent />
    </Suspense>
  );
}

/**
 * Loading fallback - shows minimal UI while search params are being read
 */
function CheckPageLoading(): ReactNode {
  return (
    <HSplit style={{ height: "100%" }} minSize={50} sizes={[20, 80]}>
      <Box
        borderRight="lightgray solid 1px"
        height="100%"
        style={{ contain: "size" }}
      >
        <Center h="100%">
          <Spinner size="sm" />
        </Center>
      </Box>
      <Box>
        <Center h="100%">
          <Spinner size="sm" />
        </Center>
      </Box>
    </HSplit>
  );
}

function CheckPageContent(): ReactNode {
  const [, setLocation] = useAppLocation();
  const searchParams = useSearchParams();
  const checkId = searchParams.get("id");
  const { latestSelectedCheckId, setLatestSelectedCheckId } =
    useRecceCheckContext();
  const queryClient = useQueryClient();
  const selectedItem = checkId;

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

  // Memoized validation to avoid duplicate checks.some() calls
  const isValidSelection = useMemo(
    () =>
      selectedItem && checks?.some((check) => check.check_id === selectedItem),
    [selectedItem, checks],
  );

  useEffect(() => {
    if (status !== "success" || checks.length === 0) {
      return;
    }

    if (!isValidSelection) {
      // No selection or invalid selection - redirect to a valid check
      // First try latestSelectedCheckId if it's valid
      const isValidLatestSelectedCheckId =
        latestSelectedCheckId &&
        checks.some((check) => check.check_id === latestSelectedCheckId);

      if (isValidLatestSelectedCheckId) {
        setLocation(`/checks/?id=${latestSelectedCheckId}`, { replace: true });
      } else {
        // Fall back to the first check
        setLocation(`/checks/?id=${checks[0].check_id}`, { replace: true });
      }
    }
  }, [status, isValidSelection, checks, setLocation, latestSelectedCheckId]);

  if (isLoading) {
    return null;
  }

  if (error) {
    return (
      <Box>
        Error: <span className="no-track-pii-safe">{error.message}</span>
      </Box>
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
        {isValidSelection && selectedItem && (
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
