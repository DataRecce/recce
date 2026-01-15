/**
 * TimelineEvent - Renders a single event in the check timeline.
 *
 * Handles different event types:
 * - check_created: Shows creation message
 * - comment: Shows user comment with edit/delete options
 * - approval_change: Shows approval status change
 * - description_change: Shows description update
 * - name_change: Shows name update
 * - preset_applied: Shows preset application
 */

"use client";

import MuiAvatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { type MouseEvent, useState } from "react";
import {
  PiBookmarkSimple,
  PiChatText,
  PiCheckCircle,
  PiCircle,
  PiNotePencil,
  PiPencilSimple,
  PiPlusCircle,
  PiTrashSimple,
} from "react-icons/pi";
import { type CheckEvent, getEventIconType } from "../../../api";
import { useIsDark } from "../../../hooks/useIsDark";
import { fetchGitHubAvatar } from "../../../lib/api/user";
import { MarkdownContent } from "../../../primitives";

interface TimelineEventProps {
  event: CheckEvent;
  currentUserId?: string;
  onEdit?: (eventId: string, content: string) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
}

function EventIcon({ event }: { event: CheckEvent }) {
  const iconType = getEventIconType(event);

  const iconMap = {
    create: PiPlusCircle,
    comment: PiChatText,
    approve: PiCheckCircle,
    unapprove: PiCircle,
    edit: PiNotePencil,
    preset: PiBookmarkSimple,
  };

  const colorMap: Record<string, string> = {
    create: "primary.main",
    comment: "grey.500",
    approve: "success.main",
    unapprove: "grey.400",
    edit: "warning.main",
    preset: "secondary.main",
  };

  const IconComponent = iconMap[iconType];
  const color = colorMap[iconType];

  return <Box component={IconComponent} sx={{ color, fontSize: 16 }} />;
}

function UserAvatar({ event }: { event: CheckEvent }) {
  const { actor } = event;
  const userId = actor.user_id?.toString();

  const { data: avatarUrl } = useQuery({
    queryKey: ["github-avatar", userId],
    queryFn: () => (userId ? fetchGitHubAvatar(userId) : Promise.resolve(null)),
    enabled: !!userId,
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const displayName = actor.fullname || actor.login || "User";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <MuiAvatar
      src={avatarUrl || undefined}
      sx={{ width: 24, height: 24, fontSize: "0.75rem" }}
    >
      {initials}
    </MuiAvatar>
  );
}

function StateChangeEvent({ event }: { event: CheckEvent }) {
  const { actor } = event;
  const actorName = actor.fullname || actor.login || "Someone";
  const relativeTime = formatDistanceToNow(new Date(event.created_at), {
    addSuffix: true,
  });

  let message = "";
  switch (event.event_type) {
    case "check_created":
      message = "created this check";
      break;
    case "approval_change":
      message =
        event.new_value === "true"
          ? "approved this check"
          : "unapproved this check";
      break;
    case "description_change":
      message = "updated the description";
      break;
    case "name_change":
      message = "renamed this check";
      break;
    case "preset_applied":
      message = "applied a preset";
      break;
    default:
      message = "made a change";
  }

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", py: 1 }}>
      <Box sx={{ pt: "2px" }}>
        <EventIcon event={event} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Stack
          direction="row"
          spacing={0.5}
          flexWrap="wrap"
          alignItems="center"
        >
          <UserAvatar event={event} />
          <Typography variant="body2" fontWeight="500">
            {actorName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {relativeTime}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

function CommentEvent({
  event,
  currentUserId,
  onEdit,
  onDelete,
}: {
  event: CheckEvent;
  currentUserId?: string;
  onEdit?: (eventId: string, content: string) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
}) {
  const isDark = useIsDark();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(event.content || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteAnchorEl, setDeleteAnchorEl] = useState<HTMLElement | null>(
    null,
  );
  const isDeletePopoverOpen = Boolean(deleteAnchorEl);

  const { actor } = event;
  const actorName = actor.fullname || actor.login || "Someone";
  const relativeTime = formatDistanceToNow(new Date(event.created_at), {
    addSuffix: true,
  });
  const isAuthor =
    currentUserId && String(actor.user_id) === String(currentUserId);

  const handleStartEdit = () => {
    setEditContent(event.content || "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(event.content || "");
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === event.content) {
      handleCancelEdit();
      return;
    }

    if (onEdit) {
      setIsSubmitting(true);
      try {
        await onEdit(event.id, trimmed);
        setIsEditing(false);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      handleCancelEdit();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveEdit();
    }
  };

  const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
    setDeleteAnchorEl(event.currentTarget);
  };

  const handleDeleteClose = () => {
    setDeleteAnchorEl(null);
  };

  const handleDelete = async () => {
    if (onDelete) {
      setIsDeleting(true);
      try {
        await onDelete(event.id);
        handleDeleteClose();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (event.is_deleted) {
    return (
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", py: 1 }}>
        <Box sx={{ pt: "2px", display: "flex", alignItems: "center" }}>
          <EventIcon event={event} />
        </Box>
        <Box sx={{ display: "flex", flex: 1, alignItems: "center" }}>
          <Typography variant="body2" color="text.disabled" fontStyle="italic">
            Comment deleted
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", py: 1 }}>
      <Box sx={{ pt: "2px" }}>
        <EventIcon event={event} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ mb: 0.5 }}
          flexWrap="wrap"
          alignItems="center"
        >
          <UserAvatar event={event} />
          <Typography variant="body2" fontWeight="500">
            {actorName}
            {isAuthor && (
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
              >
                {" "}
                (Author)
              </Typography>
            )}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {relativeTime}
          </Typography>
          {event.is_edited && (
            <Typography variant="caption" color="text.disabled">
              (edited)
            </Typography>
          )}
        </Stack>

        {isEditing ? (
          // Edit mode
          <Box>
            <TextField
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              size="small"
              multiline
              minRows={3}
              fullWidth
              disabled={isSubmitting}
              autoFocus
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "background.paper",
                  "&:focus-within": {
                    borderColor: "primary.main",
                  },
                },
              }}
            />
            <Stack
              direction="row"
              spacing={1}
              sx={{ mt: 1 }}
              justifyContent="flex-end"
            >
              <Button
                size="small"
                variant="text"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSaveEdit}
                disabled={!editContent.trim() || isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </Stack>
          </Box>
        ) : (
          // View mode
          <Box
            sx={{
              bgcolor: isDark ? "grey.800" : "grey.50",
              borderRadius: 1,
              p: 1,
              border: "1px solid",
              borderColor: isDark ? "grey.700" : "grey.200",
              position: "relative",
              "&:hover .comment-actions": {
                opacity: 1,
              },
            }}
          >
            <MarkdownContent content={event.content || ""} fontSize="sm" />

            {/* Edit/Delete buttons - only visible to author on hover */}
            {isAuthor && (onEdit || onDelete) && (
              <Stack
                className="comment-actions"
                direction="row"
                spacing={0}
                sx={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  opacity: 0,
                  transition: "opacity 0.2s",
                }}
              >
                {onEdit && (
                  <MuiTooltip title="Edit comment">
                    <IconButton
                      aria-label="Edit comment"
                      size="small"
                      onClick={handleStartEdit}
                    >
                      <PiPencilSimple />
                    </IconButton>
                  </MuiTooltip>
                )}
                {onDelete && (
                  <>
                    <MuiTooltip title="Delete comment">
                      <IconButton
                        aria-label="Delete comment"
                        size="small"
                        color="error"
                        onClick={handleDeleteClick}
                      >
                        <PiTrashSimple />
                      </IconButton>
                    </MuiTooltip>
                    <Popover
                      open={isDeletePopoverOpen}
                      anchorEl={deleteAnchorEl}
                      onClose={handleDeleteClose}
                      anchorOrigin={{
                        vertical: "bottom",
                        horizontal: "center",
                      }}
                      transformOrigin={{
                        vertical: "top",
                        horizontal: "center",
                      }}
                    >
                      <Box sx={{ p: 2 }}>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          Delete this comment?
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          <Button
                            size="small"
                            variant="text"
                            onClick={handleDeleteClose}
                            disabled={isDeleting}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={handleDelete}
                            disabled={isDeleting}
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </Button>
                        </Stack>
                      </Box>
                    </Popover>
                  </>
                )}
              </Stack>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function TimelineEventOss({
  event,
  currentUserId,
  onEdit,
  onDelete,
}: TimelineEventProps) {
  if (event.event_type === "comment") {
    return (
      <CommentEvent
        event={event}
        currentUserId={currentUserId}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }

  return <StateChangeEvent event={event} />;
}
