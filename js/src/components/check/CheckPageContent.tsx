import { HSplit } from "@datarecce/ui";
import { cacheKeys, listChecks, reorderChecks } from "@datarecce/ui/api";
import { StateImporter } from "@datarecce/ui/components/app";
import {
  CheckEmptyStateOss as CheckEmptyState,
  CheckListOss as CheckList,
} from "@datarecce/ui/components/check";
import { CheckDetailOss as CheckDetail } from "@datarecce/ui/components/check/CheckDetailOss";
import { useApiConfig, useRecceCheckContext } from "@datarecce/ui/hooks";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function CheckPageContent(): ReactNode {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const borderColor = isDark ? "grey.700" : "grey.300";
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkId = searchParams.get("id");
  const { latestSelectedCheckId, setLatestSelectedCheckId } =
    useRecceCheckContext();
  const queryClient = useQueryClient();
  const { apiClient } = useApiConfig();
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
    queryFn: () => listChecks(apiClient),
    refetchOnMount: true,
  });

  const handleSelectItem = useCallback(
    (checkId: string) => {
      router.push(`/checks/?id=${checkId}`);
    },
    [router.push],
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
      reorderChecks(order, apiClient),
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
      Boolean(
        selectedItem &&
          checks?.some((check) => check.check_id === selectedItem),
      ),
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
        router.replace(`/checks/?id=${latestSelectedCheckId}`);
      } else {
        // Fall back to the first check
        router.replace(`/checks/?id=${checks[0].check_id}`);
      }
    }
  }, [
    status,
    isValidSelection,
    checks,
    latestSelectedCheckId, // Fall back to the first check
    router.replace,
  ]);

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
          sx={{
            borderRight: "1px solid",
            borderRightColor: borderColor,
            height: "100%",
          }}
          style={{ contain: "size" }}
        >
          <Stack
            sx={{ height: "100%", alignItems: "stretch" }}
            style={{ contain: "strict" }}
            spacing={0}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                p: "0px 10px",
              }}
            >
              <StateImporter checksOnly />
            </Box>
            <Divider />
            <Box
              sx={{
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Box sx={{ textAlign: "center", color: "grey.500" }}>
                No checks
              </Box>
            </Box>
          </Stack>
        </Box>
        <Box>
          <Box
            sx={{
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CheckEmptyState />
          </Box>
        </Box>
      </HSplit>
    );
  }

  return (
    <HSplit style={{ height: "100%" }} minSize={50} sizes={[20, 80]}>
      <Box
        sx={{
          borderRight: "1px solid",
          borderRightColor: borderColor,
          height: "100%",
        }}
        style={{ contain: "size" }}
      >
        <Stack
          sx={{ height: "100%", alignItems: "stretch" }}
          style={{ contain: "strict" }}
          spacing={0}
        >
          <Box
            sx={{ display: "flex", justifyContent: "flex-end", p: "0px 10px" }}
          >
            <StateImporter checksOnly />
          </Box>
          <Divider />
          <CheckList
            checks={orderedChecks}
            selectedItem={selectedItem}
            onCheckSelected={handleSelectItem}
            onChecksReordered={handleDragEnd}
          />
        </Stack>
      </Box>
      <Box sx={{ height: "100%" }}>
        {/* isValidSelection already checks selectedItem, but TS needs explicit check for type narrowing */}
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
