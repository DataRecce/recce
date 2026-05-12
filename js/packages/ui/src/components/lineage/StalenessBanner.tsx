"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState } from "react";
import { MdInfo } from "react-icons/md";
import { isSessionBaseOutdated, refreshSessionBase } from "../../api";
import { useLineageGraphContext } from "../../contexts";
import { useApiConfig, useServerInfo } from "../../hooks";
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
  // State-backed ref so MUI Popover gets a re-render after the banner DOM
  // commits. A plain useRef does not trigger a re-render, so FirstTimePopover
  // would receive anchorEl=null on first render and stay closed even after
  // its internal setOpen(true) fires. See PR #1366 review.
  const [bannerEl, setBannerEl] = useState<HTMLDivElement | null>(null);

  // Subscribe to session_staleness via the shared useServerInfo hook so this
  // banner tracks any future options (staleTime/enabled) added in
  // LineageGraphAdapter without drift. React Query deduplicates by key.
  const { data: staleness } = useServerInfo({
    select: (d) => d.session_staleness,
  });

  // Track previous staleness to detect the true→false transition.
  // Note: this ref is component-local, so it does NOT survive remounts. If the
  // user navigates away after clicking Refresh and the WS event arrives while a
  // different route is mounted, the success toast is skipped on return (the
  // cache is correct: banner hidden, no error). Accepted limitation for slice 2.
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
      await refreshSessionBase(apiClient);
      // Do NOT clear refreshing here — WS metadata_updated → query invalidate →
      // useQuery subscription updates staleness → outdated flips to false →
      // the useEffect above clears it.
      // The 30s timeout handles the fallback if WS never arrives.
    } catch {
      // If the timeout already fired, it already toasted — skip the second toast.
      if (!timeoutRef.current) return;
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
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
      ref={setBannerEl}
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
          {noSharedBase
            ? "This PR's base snapshot may be out of date, and no shared base is currently configured for this project. Comparisons may not reflect current state."
            : "Production data has changed since this PR's base was captured. Comparisons may not reflect current state."}
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
      <FirstTimePopover anchorEl={bannerEl} />
    </Box>
  );
}
