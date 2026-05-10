"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { MdInfo } from "react-icons/md";
import {
  cacheKeys,
  getServerInfo,
  isSessionBaseOutdated,
  type ServerInfoResult,
  type SessionStaleness,
} from "../../api";
import { useLineageGraphContext } from "../../contexts";
import { useApiConfig } from "../../hooks";
import { toaster } from "../ui/Toaster";
import { FirstTimePopover } from "./FirstTimePopover";

/** Milliseconds before clearing the refreshing spinner if no WS event arrives. */
const REFRESH_TIMEOUT_MS = 30_000;

/**
 * Yellow info banner shown when the PR session's frozen-snapshot base is
 * outdated relative to the project's current shared base.
 *
 * Cloud-mode only (gated via LineageGraphContext.cloudMode).
 * Hidden for OSS / legacy sessions (staleness undefined or source_session_id null).
 *
 * Subscribes directly to the lineage query cache so banner updates reactively
 * when LineageGraphAdapter invalidates the cache on WS `metadata_updated` —
 * even across React.memo() boundaries.
 */
export function StalenessBanner() {
  const { cloudMode } = useLineageGraphContext();
  const { apiClient } = useApiConfig();
  const [refreshing, setRefreshing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to session_staleness via useQuery using the same key/queryFn as
  // LineageGraphAdapter. React Query deduplicates the request — no extra network
  // round-trip occurs. The select keeps re-renders scoped to staleness changes only.
  const { data: staleness } = useQuery({
    queryKey: cacheKeys.lineage(),
    queryFn: () => getServerInfo(apiClient),
    select: (d: ServerInfoResult) => d.session_staleness,
  });

  // Track previous staleness to detect the true→false transition.
  const prevOutdated = useRef<boolean | null>(null);

  const outdated = staleness != null ? isSessionBaseOutdated(staleness) : false;

  // Toast when staleness clears (transition true → false).
  useEffect(() => {
    if (prevOutdated.current === true && !outdated) {
      toaster.success({
        description:
          "Base refreshed. If you've saved checks in this session, you may want to re-run them against the new base.",
        duration: 8000,
        closable: true,
      });
      // Clear refreshing state since the WS event arrived.
      setRefreshing(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
    prevOutdated.current = outdated;
  }, [outdated]);

  // Cleanup timeout on unmount.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!cloudMode) return null;
  if (!staleness) return null;
  if (!outdated) return null;

  const noSharedBase = staleness.current_base_session_id === null;

  const handleRefresh = async () => {
    setRefreshing(true);

    // 30s timeout fallback: if the WS event never arrives, clear spinner + show error.
    timeoutRef.current = setTimeout(() => {
      setRefreshing(false);
      toaster.error({
        description: "Refresh failed — try again.",
        duration: 5000,
        closable: true,
      });
      timeoutRef.current = null;
    }, REFRESH_TIMEOUT_MS);

    try {
      await apiClient.post("/api/refresh-base");
      // Do NOT clear refreshing here — WS metadata_updated → query invalidate →
      // useQuery subscription updates staleness → outdated flips to false →
      // the useEffect above clears it.
      // The 30s timeout handles the fallback if WS never arrives.
    } catch {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setRefreshing(false);
      toaster.error({
        description: "Refresh failed — try again.",
        duration: 5000,
        closable: true,
      });
    }
  };

  return (
    <Box
      ref={bannerRef}
      role="status"
      sx={{
        bgcolor: "warning.light",
        borderBottom: 1,
        borderColor: "warning.main",
        px: 2,
        py: 0.75,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <MdInfo color="inherit" size={16} />
        <Typography variant="body2" sx={{ flex: 1 }}>
          Production data has changed since this PR&apos;s base was captured.
          Comparisons may not reflect current state.
        </Typography>
        <Tooltip
          title={
            noSharedBase ? "No shared base configured for this project." : ""
          }
          disableHoverListener={!noSharedBase}
        >
          <span>
            <Button
              size="small"
              variant="outlined"
              onClick={() => void handleRefresh()}
              disabled={refreshing || noSharedBase}
              startIcon={
                refreshing ? <CircularProgress size={12} /> : undefined
              }
              sx={{ whiteSpace: "nowrap" }}
            >
              {refreshing ? "Refreshing…" : "Refresh base"}
            </Button>
          </span>
        </Tooltip>
      </Stack>
      <FirstTimePopover anchorEl={bannerRef.current} />
    </Box>
  );
}
