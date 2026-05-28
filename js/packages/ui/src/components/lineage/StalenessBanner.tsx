"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import type { SxProps, Theme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import { MdInfo } from "react-icons/md";
import {
  isSessionBaseOutdated,
  refreshSessionBase,
  type SessionStaleness,
} from "../../api";
import { useLineageGraphContext } from "../../contexts";
import { useApiConfig, useServerInfo } from "../../hooks";
import { toaster } from "../ui/Toaster";
import { FirstTimePopover } from "./FirstTimePopover";

/** Milliseconds before clearing the refreshing spinner if no WS event arrives. */
const REFRESH_TIMEOUT_MS = 30_000;

/**
 * sessionStorage key prefix for `dismissible` mode. The per-session key is
 * `${PREFIX}::${sessionId}` so dismissals do not leak across PR sessions in
 * the same tab.
 */
const DISMISSED_SIGNATURE_KEY_PREFIX =
  "recce-staleness-banner-dismissed-signature";

/**
 * Toast surface used by StalenessBanner. Both shells implement this — OSS via
 * the module-singleton `toaster`, cloud via its provider-backed `useToast()`.
 */
export interface StalenessToastAdapter {
  success: (message: string, options?: { duration?: number }) => void;
  error: (message: string, options?: { duration?: number }) => void;
}

export type StalenessBannerVariant = "banner" | "card";
export type StalenessMessageVariant = "data" | "metadata";

export interface StalenessBannerProps {
  /**
   * Visual treatment.
   * - `banner` (default): full-width yellow strip with `borderBottom`.
   *   Mounted in shell chrome (OSS MainLayout).
   * - `card`: floating MUI `Paper` overlay. Used by the cloud shell.
   */
  variant?: StalenessBannerVariant;
  /**
   * When `true`, render a close icon and persist the user's dismissal in
   * sessionStorage keyed on the staleness signature, so the banner re-fires
   * on a new drift state.
   *
   * Requires `sessionId` to scope the dismissal to the current PR session.
   * Defaults to `false` (OSS persistent banner).
   */
  dismissible?: boolean;
  /**
   * Per-session key suffix for sessionStorage dismissal persistence. Required
   * when `dismissible` is true; ignored otherwise.
   */
  sessionId?: string;
  /**
   * Toast surface override. Defaults to the OSS module-singleton `toaster`.
   * Cloud passes its `useToast()` provider value wrapped to this shape.
   */
  toastAdapter?: StalenessToastAdapter;
  /**
   * When `true`, the outdated→matching success toast fires only if the user
   * clicked Refresh on this mount. Suppresses spurious "Base refreshed" toasts
   * triggered by an unrelated cache update (e.g. refresh from another tab).
   *
   * OSS defaults to `false` (existing behavior). Cloud opts in.
   */
  successToastOnlyOnUserRefresh?: boolean;
  /**
   * When `true` (default), gate the banner on
   * `useLineageGraphContext().cloudMode`. The cloud shell does not provide a
   * lineage-graph context at the mount level, so it passes `false`.
   */
  requireCloudMode?: boolean;
  /**
   * Wording for the outdated-state message.
   * - `data` (default): "Production data has changed since this PR's base was captured."
   * - `metadata`: "Production metadata has changed since this PR's base was captured."
   *
   * The no-shared-base copy is identical across both variants.
   */
  messageVariant?: StalenessMessageVariant;
  /**
   * Show the one-shot `FirstTimePopover` anchored to the banner. Defaults to
   * `true`. The cloud shell sets this to `false` (cloud-side intro is handled
   * separately or omitted by design).
   */
  showFirstTimePopover?: boolean;
  /**
   * Additional `sx` merged into the `Paper` root when `variant="card"`.
   * Typical use: shell-specific positioning offsets (`top`, `left`, etc.)
   * since the floating card sits over the work area in cloud.
   *
   * **Note**: the card variant only defaults `left: 50%` + horizontal centering.
   * Callers must position vertically via `cardSx={{ top: ... }}` to avoid the
   * card pinning to the viewport top under any sticky chrome (e.g. cloud passes
   * `top: 180` to clear its top nav).
   */
  cardSx?: SxProps<Theme>;
}

/**
 * Yellow info banner shown when the PR session's frozen-snapshot base is
 * outdated relative to the project's current shared base.
 *
 * Subscribes directly to the lineage query cache so banner updates reactively
 * when LineageGraphAdapter invalidates the cache on WS `metadata_updated` —
 * even across React.memo() boundaries.
 *
 * @see DRC-3508 for the shared-export refactor that unifies the OSS strip and
 * cloud floating-card surfaces behind one component.
 */
export function StalenessBanner({
  variant = "banner",
  dismissible = false,
  sessionId,
  toastAdapter,
  successToastOnlyOnUserRefresh = false,
  requireCloudMode = true,
  messageVariant = "data",
  showFirstTimePopover = true,
  cardSx,
}: StalenessBannerProps = {}) {
  const { cloudMode } = useLineageGraphContext();
  const { apiClient } = useApiConfig();

  // Inline ternary instead of useMemo: the result identity is already
  // caller-stable (toastAdapter when supplied, module-stable defaultToastAdapter
  // otherwise), so a memo adds no stability the caller hasn't already
  // delivered. Referential changes propagate downstream from the caller's own
  // adapter contract.
  const toast: StalenessToastAdapter = toastAdapter ?? defaultToastAdapter;

  const [refreshing, setRefreshing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // State-backed ref so MUI Popover gets a re-render after the banner DOM
  // commits. A plain useRef does not trigger a re-render, so FirstTimePopover
  // would receive anchorEl=null on first render and stay closed even after
  // its internal setOpen(true) fires. See PR #1366 review.
  const [bannerEl, setBannerEl] = useState<HTMLDivElement | null>(null);
  // True only when the user clicked Refresh on *this* mount. Used when
  // `successToastOnlyOnUserRefresh` is set, so unrelated cache transitions
  // (another tab refreshed) do not falsely claim the success toast.
  const userInitiatedRefreshRef = useRef(false);

  // Subscribe to session_staleness via the shared useServerInfo hook so this
  // banner tracks any future options (staleTime/enabled) added in
  // LineageGraphAdapter without drift. React Query deduplicates by key.
  const { data: staleness } = useServerInfo({
    select: (d) => d.session_staleness,
  });

  // Track previous staleness to detect the outdated→matching transition.
  // Note: this ref is component-local, so it does NOT survive remounts. If the
  // user navigates away after clicking Refresh and the WS event arrives while
  // a different route is mounted, the success toast is skipped on return.
  const prevOutdated = useRef<boolean | null>(null);

  const outdated = staleness != null ? isSessionBaseOutdated(staleness) : false;

  const dismissedKey =
    dismissible && sessionId
      ? `${DISMISSED_SIGNATURE_KEY_PREFIX}::${sessionId}`
      : null;

  // Lazy-init dismissed signature from sessionStorage so the dismissal
  // survives soft reloads within the same tab session.
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(
    () => readDismissedSignature(dismissedKey),
  );

  // Resync from storage whenever `dismissedKey` changes — relevant when the
  // shell preserves the layout across `[sessionId]` URL changes (Next.js App
  // Router): the lazy-init value would otherwise leak across sessions even
  // though the storage key correctly flipped to the new session.
  useEffect(() => {
    setDismissedSignature(readDismissedSignature(dismissedKey));
  }, [dismissedKey]);

  // Dev-time guard: `dismissible` without `sessionId` silently degrades to
  // in-memory dismissal (sessionStorage persistence is skipped because the
  // dismissedKey gate is null). Surface the misuse loudly in dev so callers
  // don't ship a banner that loses its dismissal state on every remount.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && dismissible && !sessionId) {
      console.warn(
        "StalenessBanner: `dismissible=true` requires `sessionId` — dismissals will not persist across remounts.",
      );
    }
  }, [dismissible, sessionId]);

  // Dev-time guard: when the caller opts out of the cloud-mode gate
  // (`requireCloudMode={false}`) they're almost certainly mounting outside
  // the OSS shell, where the module-singleton `toaster` may not have a
  // `<Toaster>` mounted to listen to. The `defaultToastAdapter` would then
  // silently no-op. Surface the missing adapter loudly in dev. Symmetric with
  // the `dismissible && !sessionId` guard above.
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      requireCloudMode === false &&
      !toastAdapter
    ) {
      console.warn(
        "StalenessBanner: `requireCloudMode={false}` without `toastAdapter` — the default adapter targets the OSS module-singleton toaster and may silently no-op outside the OSS shell.",
      );
    }
  }, [requireCloudMode, toastAdapter]);

  // Toast when staleness clears (outdated → matching transition).
  useEffect(() => {
    const transitioned = prevOutdated.current === true && !outdated;
    const userInitiatedGateSatisfied =
      !successToastOnlyOnUserRefresh || userInitiatedRefreshRef.current;
    if (transitioned && userInitiatedGateSatisfied) {
      toast.success(
        "Base refreshed. If you've saved checks in this session, you may want to re-run them against the new base.",
        { duration: 8000 },
      );
      setRefreshing(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      userInitiatedRefreshRef.current = false;
    }
    prevOutdated.current = outdated;
  }, [outdated, successToastOnlyOnUserRefresh, toast]);

  // Cleanup timeout on unmount.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (requireCloudMode && !cloudMode) return null;
  if (!staleness) return null;
  if (!outdated) return null;

  const currentSignature = stalenessSignature(staleness);
  if (dismissible && dismissedSignature === currentSignature) return null;

  const noSharedBase = staleness.current_base_session_id === null;
  const outdatedMessage =
    messageVariant === "metadata"
      ? "Production metadata has changed since this PR's base was captured. Comparisons may not reflect current state."
      : "Production data has changed since this PR's base was captured. Comparisons may not reflect current state.";
  const noSharedBaseMessage =
    "This PR's base snapshot may be out of date, and no shared base is currently configured for this project. Comparisons may not reflect current state.";

  const handleRefresh = async () => {
    userInitiatedRefreshRef.current = true;
    setRefreshing(true);

    // 30s timeout fallback: if the WS event never arrives, clear spinner + show error.
    timeoutRef.current = setTimeout(() => {
      setRefreshing(false);
      toast.error("Refresh failed — try again.", { duration: 5000 });
      timeoutRef.current = null;
      userInitiatedRefreshRef.current = false;
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
      userInitiatedRefreshRef.current = false;
      toast.error("Refresh failed — try again.", { duration: 5000 });
    }
  };

  const handleDismiss = () => {
    // Tear down any in-flight refresh so the user doesn't see a 30s-timeout
    // "Refresh failed" toast for a banner they already dismissed.
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setRefreshing(false);
    userInitiatedRefreshRef.current = false;
    if (dismissedKey) {
      try {
        sessionStorage.setItem(dismissedKey, currentSignature);
      } catch {
        // sessionStorage may throw under strict storage partitioning / quota —
        // still update in-memory state so the user's click takes effect.
      }
    }
    setDismissedSignature(currentSignature);
  };

  const messageText = noSharedBase ? noSharedBaseMessage : outdatedMessage;
  const refreshTooltipTitle = noSharedBase
    ? "No shared base configured for this project."
    : "";

  const refreshButton = (
    <Tooltip title={refreshTooltipTitle} disableHoverListener={!noSharedBase}>
      <span>
        <Button
          size="small"
          variant="outlined"
          onClick={() => void handleRefresh()}
          disabled={refreshing || noSharedBase}
          startIcon={refreshing ? <CircularProgress size={12} /> : undefined}
          sx={{ whiteSpace: "nowrap" }}
        >
          {refreshing ? "Refreshing…" : "Refresh base"}
        </Button>
      </span>
    </Tooltip>
  );

  const dismissButton = dismissible ? (
    <IconButton
      aria-label="Dismiss"
      size="small"
      onClick={handleDismiss}
      sx={{ flex: "0 0 auto" }}
    >
      <IoClose />
    </IconButton>
  ) : null;

  const popover = showFirstTimePopover ? (
    <FirstTimePopover anchorEl={bannerEl} />
  ) : null;

  if (variant === "card") {
    return (
      <Paper
        ref={setBannerEl}
        role="status"
        elevation={4}
        sx={[
          {
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            // Sit just above MUI's drawer tier (= 1201) so the card paints
            // over page content but below modals (1300), snackbars (1400),
            // and tooltips (1500).
            zIndex: (theme: Theme) => theme.zIndex.drawer + 1,
            maxWidth: 760,
            minWidth: 480,
            bgcolor: "warning.light",
            border: 1,
            borderColor: "warning.main",
            borderRadius: 1,
            px: 1.5,
            py: 1,
          },
          ...(Array.isArray(cardSx) ? cardSx : [cardSx]),
        ]}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box component={MdInfo} sx={{ flex: "0 0 auto" }} size={18} />
          <Typography variant="body2" sx={{ flex: 1 }}>
            {messageText}
          </Typography>
          {refreshButton}
          {dismissButton}
        </Stack>
        {popover}
      </Paper>
    );
  }

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
          {messageText}
        </Typography>
        {refreshButton}
        {dismissButton}
      </Stack>
      {popover}
    </Box>
  );
}

/**
 * Compose a stable string key from the staleness object so the dismissal
 * tracks the *current* drift state. New drift produces a new signature →
 * banner re-fires.
 */
function stalenessSignature(s: SessionStaleness): string {
  return `${s.source_session_id}|${s.source_session_updated_at}|${s.current_base_session_id}|${s.current_base_updated_at}`;
}

function readDismissedSignature(key: string | null): string | null {
  if (!key) return null;
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

const defaultToastAdapter: StalenessToastAdapter = {
  success: (message, options) => {
    toaster.success({
      description: message,
      duration: options?.duration ?? 5000,
      closable: true,
    });
  },
  error: (message, options) => {
    toaster.error({
      description: message,
      duration: options?.duration ?? 5000,
      closable: true,
    });
  },
};
