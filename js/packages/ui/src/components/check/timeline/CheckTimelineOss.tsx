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
import { cacheKeys } from "../../../api";
import { useApiConfig, useCheckEvents, useIsDark } from "../../../hooks";
import { fetchUser } from "../../../lib/api/user";
import { CommentInput } from "../../../primitives";
import { TimelineEventOss as TimelineEvent } from "./TimelineEventOss";

interface CheckTimelineProps {
  checkId: string;
}

export function CheckTimelineOss({ checkId }: CheckTimelineProps) {
  const isDark = useIsDark();
  const { apiClient } = useApiConfig();
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
        {events.length === 0 ? (
          <Typography sx={{ fontSize: "0.875rem", color: "grey.500" }}>
            No activity yet
          </Typography>
        ) : (
          <Stack sx={{ alignItems: "stretch" }} spacing={0}>
            {events.map((event, index) => (
              <Box key={event.id}>
                <TimelineEvent
                  event={event}
                  currentUserId={currentUser?.id}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                />
                {index < events.length - 1 && (
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
