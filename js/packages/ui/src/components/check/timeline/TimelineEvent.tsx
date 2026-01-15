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
import { formatDistanceToNow } from "date-fns";
import { type MouseEvent, memo, useCallback, useState } from "react";
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
import { useIsDark } from "../../../hooks/useIsDark";

/**
 * Actor information for timeline events
 */
export interface TimelineActor {
  /** User ID */
  user_id?: string | number;
  /** Full name of the actor */
  fullname?: string;
  /** Login/username of the actor */
  login?: string;
  /** Avatar URL (props-driven, consumer provides) */
  avatarUrl?: string;
}

/**
 * Event types supported by the timeline
 */
export type TimelineEventType =
  | "check_created"
  | "comment"
  | "approval_change"
  | "description_change"
  | "name_change"
  | "preset_applied";

/**
 * Timeline event data structure
 */
export interface TimelineEventData {
  /** Unique event ID */
  id: string;
  /** Type of event */
  event_type: TimelineEventType;
  /** Actor who performed the event */
  actor: TimelineActor;
  /** Event creation timestamp (ISO string) */
  created_at: string;
  /** Event content (for comments) */
  content?: string;
  /** New value (for change events) */
  new_value?: string;
  /** Whether the event was edited */
  is_edited?: boolean;
  /** Whether the event was deleted */
  is_deleted?: boolean;
}

/**
 * Icon type mapping for events
 */
type EventIconType =
  | "create"
  | "comment"
  | "approve"
  | "unapprove"
  | "edit"
  | "preset";

/**
 * Get the icon type for an event
 */
function getEventIconType(event: TimelineEventData): EventIconType {
  switch (event.event_type) {
    case "check_created":
      return "create";
    case "comment":
      return "comment";
    case "approval_change":
      return event.new_value === "true" ? "approve" : "unapprove";
    case "description_change":
    case "name_change":
      return "edit";
    case "preset_applied":
      return "preset";
    default:
      return "edit";
  }
}

/**
 * Props for the TimelineEvent component
 */
export interface TimelineEventProps {
  /** Event data to render */
  event: TimelineEventData;
  /** Current user ID (to show edit/delete for own comments) */
  currentUserId?: string;
  /** Callback when editing a comment */
  onEdit?: (eventId: string, content: string) => Promise<void>;
  /** Callback when deleting a comment */
  onDelete?: (eventId: string) => Promise<void>;
  /** Optional markdown renderer component */
  markdownRenderer?: React.ComponentType<{ content: string }>;
  /** Optional CSS class name */
  className?: string;
}

function EventIcon({ event }: { event: TimelineEventData }) {
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

function UserAvatar({ actor }: { actor: TimelineActor }) {
  const displayName = actor.fullname || actor.login || "User";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <MuiAvatar
      src={actor.avatarUrl || undefined}
      sx={{ width: 24, height: 24, fontSize: "0.75rem" }}
    >
      {initials}
    </MuiAvatar>
  );
}

function StateChangeEventComponent({ event }: { event: TimelineEventData }) {
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
          <UserAvatar actor={actor} />
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

const StateChangeEvent = memo(StateChangeEventComponent);
StateChangeEvent.displayName = "StateChangeEvent";

function CommentEventComponent({
  event,
  currentUserId,
  onEdit,
  onDelete,
  markdownRenderer: MarkdownRenderer,
}: {
  event: TimelineEventData;
  currentUserId?: string;
  onEdit?: (eventId: string, content: string) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
  markdownRenderer?: React.ComponentType<{ content: string }>;
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

  const handleStartEdit = useCallback(() => {
    setEditContent(event.content || "");
    setIsEditing(true);
  }, [event.content]);

  const handleCancelEdit = useCallback(() => {
    setEditContent(event.content || "");
    setIsEditing(false);
  }, [event.content]);

  const handleSaveEdit = useCallback(async () => {
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
  }, [editContent, event.content, event.id, onEdit, handleCancelEdit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        handleCancelEdit();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSaveEdit();
      }
    },
    [handleCancelEdit, handleSaveEdit],
  );

  const handleDeleteClick = useCallback(
    (clickEvent: MouseEvent<HTMLButtonElement>) => {
      setDeleteAnchorEl(clickEvent.currentTarget);
    },
    [],
  );

  const handleDeleteClose = useCallback(() => {
    setDeleteAnchorEl(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (onDelete) {
      setIsDeleting(true);
      try {
        await onDelete(event.id);
        handleDeleteClose();
      } finally {
        setIsDeleting(false);
      }
    }
  }, [onDelete, event.id, handleDeleteClose]);

  const handleEditChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setEditContent(e.target.value);
    },
    [],
  );

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
          <UserAvatar actor={actor} />
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
              onChange={handleEditChange}
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
            {MarkdownRenderer ? (
              <MarkdownRenderer content={event.content || ""} />
            ) : (
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {event.content}
              </Typography>
            )}

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

const CommentEvent = memo(CommentEventComponent);
CommentEvent.displayName = "CommentEvent";

/**
 * TimelineEvent Component
 *
 * A pure presentation component for rendering timeline events.
 * Supports different event types including comments with edit/delete functionality.
 *
 * @example Basic usage with state change events
 * ```tsx
 * import { TimelineEvent } from '@datarecce/ui/primitives';
 *
 * function CheckTimeline({ events }) {
 *   return (
 *     <div>
 *       {events.map(event => (
 *         <TimelineEvent key={event.id} event={event} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With comment editing
 * ```tsx
 * <TimelineEvent
 *   event={commentEvent}
 *   currentUserId={currentUser.id}
 *   onEdit={async (eventId, content) => {
 *     await updateComment(eventId, content);
 *   }}
 *   onDelete={async (eventId) => {
 *     await deleteComment(eventId);
 *   }}
 * />
 * ```
 *
 * @example With custom markdown renderer
 * ```tsx
 * import { MarkdownContent } from '@/components/ui/markdown/MarkdownContent';
 *
 * <TimelineEvent
 *   event={event}
 *   markdownRenderer={({ content }) => (
 *     <MarkdownContent content={content} fontSize="sm" />
 *   )}
 * />
 * ```
 */
function TimelineEventComponent({
  event,
  currentUserId,
  onEdit,
  onDelete,
  markdownRenderer,
  className,
}: TimelineEventProps) {
  if (event.event_type === "comment") {
    return (
      <Box className={className}>
        <CommentEvent
          event={event}
          currentUserId={currentUserId}
          onEdit={onEdit}
          onDelete={onDelete}
          markdownRenderer={markdownRenderer}
        />
      </Box>
    );
  }

  return (
    <Box className={className}>
      <StateChangeEvent event={event} />
    </Box>
  );
}

export const TimelineEvent = memo(TimelineEventComponent);
TimelineEvent.displayName = "TimelineEvent";
