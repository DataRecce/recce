/**
 * CheckTimeline - Main timeline/conversation panel for a check.
 *
 * Displays a chronological list of events (comments, state changes)
 * and provides an input for adding new comments.
 *
 * This component is only rendered when connected to Recce Cloud.
 */

"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { cacheKeys } from "../../../api";
import type { CheckEvent } from "../../../api/checkEvents";
import { listRuns } from "../../../api/runs";
import { useApiConfig, useCheckEvents, useIsDark } from "../../../hooks";
import { fetchUser } from "../../../lib/api/user";
import { CommentInput } from "../../../primitives";
import { type RunEntry, RunTimelineEntry } from "./RunTimelineEntry";
import { TimelineEventOss as TimelineEvent } from "./TimelineEventOss";

// ============================================================================
// Types
// ============================================================================

export type TimelineEntry =
  | { kind: "event"; event: CheckEvent; at: string }
  | { kind: "run"; run: RunEntry; index: number; at: string };

// ============================================================================
// Pure merge function (exported for testing)
// ============================================================================

/**
 * Merges check events and run entries into a single chronologically sorted
 * list (descending — newest first). Runs are numbered from oldest (#1) to
 * newest (#N) so the index reflects execution order.
 */
export function mergeTimelineEntries(
  events: CheckEvent[],
  runs: RunEntry[] | undefined,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const event of events) {
    entries.push({ kind: "event", event, at: event.created_at });
  }

  if (runs) {
    // Sort ascending to assign indices from oldest (#1) to newest (#N)
    const sortedRuns = [...runs].sort(
      (a, b) => new Date(a.run_at).getTime() - new Date(b.run_at).getTime(),
    );
    for (let i = 0; i < sortedRuns.length; i++) {
      entries.push({
        kind: "run",
        run: sortedRuns[i],
        index: i + 1,
        at: sortedRuns[i].run_at,
      });
    }
  }

  // Sort descending (newest first) for display
  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return entries;
}

// ============================================================================
// Component
// ============================================================================

interface CheckTimelineProps {
  checkId: string;
}

export function CheckTimelineOss({ checkId }: CheckTimelineProps) {
  const isDark = useIsDark();
  const { apiClient, authToken } = useApiConfig();
  const {
    events,
    isLoading,
    error,
    createComment,
    isCreatingComment,
    updateComment,
    deleteComment,
  } = useCheckEvents(checkId);

  // Get current user for determining edit/delete permissions
  const { data: currentUser } = useQuery({
    queryKey: cacheKeys.user(),
    queryFn: () => fetchUser(apiClient),
    retry: false,
  });

  // Fetch runs only in cloudMode (authToken present = Cloud)
  const { data: checkRuns } = useQuery({
    queryKey: ["check-runs", checkId],
    queryFn: async () => {
      const allRuns = await listRuns(apiClient);
      return allRuns
        .filter((r) => r.check_id === checkId)
        .map(
          (r): RunEntry => ({
            run_id: r.run_id,
            run_at: r.run_at,
            status: r.status ?? "unknown",
          }),
        );
    },
    enabled: !!authToken,
    staleTime: 30000,
  });

  const timelineEntries = useMemo(
    () => mergeTimelineEntries(events, checkRuns),
    [events, checkRuns],
  );

  const handleCreateComment = (content: string) => {
    createComment(content);
  };

  const handleEditComment = async (eventId: string, content: string) => {
    await updateComment({ eventId, content });
  };

  const handleDeleteComment = async (eventId: string) => {
    await deleteComment(eventId);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          height: "100%",
          p: 4,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          height: "100%",
          p: 4,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Typography sx={{ fontSize: "0.875rem", color: "error.main" }}>
          Failed to load timeline
        </Typography>
      </Box>
    );
  }

  return (
    <Stack
      sx={{
        height: "100%",
        alignItems: "stretch",
        borderLeft: "1px solid",
        borderColor: isDark ? "grey.700" : "grey.200",
      }}
      spacing={0}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: "1px solid",
          borderColor: isDark ? "grey.700" : "grey.200",
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
          Activity
        </Typography>
      </Box>

      {/* Events List - Scrollable */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
        {timelineEntries.length === 0 ? (
          <Typography sx={{ fontSize: "0.875rem", color: "grey.500" }}>
            No activity yet
          </Typography>
        ) : (
          <Stack sx={{ alignItems: "stretch" }} spacing={0}>
            {timelineEntries.map((entry, index) => (
              <Box
                key={entry.kind === "event" ? entry.event.id : entry.run.run_id}
              >
                {entry.kind === "event" ? (
                  <TimelineEvent
                    event={entry.event}
                    currentUserId={currentUser?.id}
                    onEdit={handleEditComment}
                    onDelete={handleDeleteComment}
                  />
                ) : (
                  <RunTimelineEntry run={entry.run} index={entry.index} />
                )}
                {index < timelineEntries.length - 1 && (
                  <Divider
                    sx={{ borderColor: isDark ? "grey.700" : "grey.100" }}
                  />
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {/* Comment Input - Fixed at bottom */}
      <Box
        sx={{
          px: 3,
          py: 3,
          borderTop: "1px solid",
          borderColor: isDark ? "grey.700" : "grey.200",
          bgcolor: isDark ? "grey.900" : "grey.50",
        }}
      >
        <CommentInput
          onSubmit={handleCreateComment}
          isSubmitting={isCreatingComment}
        />
      </Box>
    </Stack>
  );
}
