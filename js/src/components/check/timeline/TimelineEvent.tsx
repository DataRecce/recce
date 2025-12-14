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

import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  IconButton,
  Popover,
  Portal,
  Text,
  Textarea,
} from "@/components/ui/mui";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Activity, useState } from "react";
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
import { MarkdownContent } from "@/components/ui/markdown/MarkdownContent";
import { Tooltip } from "@/components/ui/tooltip";
import { CheckEvent, getEventIconType } from "@/lib/api/checkEvents";
import { fetchGitHubAvatar } from "@/lib/api/user";

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

  const colorMap = {
    create: "blue.500",
    comment: "gray.500",
    approve: "green.500",
    unapprove: "gray.400",
    edit: "orange.500",
    preset: "purple.500",
  };

  const IconComponent = iconMap[iconType];
  const color = colorMap[iconType];

  return <Icon as={IconComponent} color={color} boxSize="16px" />;
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
    <Avatar.Root size="xs">
      <Avatar.Fallback name={displayName}>{initials}</Avatar.Fallback>
      {avatarUrl && <Avatar.Image src={avatarUrl} />}
    </Avatar.Root>
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
    <Flex gap={2} alignItems="flex-start" py={2}>
      <Box pt="2px">
        <EventIcon event={event} />
      </Box>
      <Box flex={1}>
        <HStack gap={1} flexWrap="wrap">
          <UserAvatar event={event} />
          <Text fontSize="sm" fontWeight="medium">
            {actorName}
          </Text>
          <Text fontSize="sm" color="gray.600">
            {message}
          </Text>
          <Text fontSize="xs" color="gray.400">
            {relativeTime}
          </Text>
        </HStack>
      </Box>
    </Flex>
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
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(event.content || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletePopoverOpen, setIsDeletePopoverOpen] = useState(false);

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

  const handleDelete = async () => {
    if (onDelete) {
      setIsDeleting(true);
      try {
        await onDelete(event.id);
        setIsDeletePopoverOpen(false);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (event.is_deleted) {
    return (
      <Flex gap={2} alignItems="center" py={2}>
        <Box pt="2px" display="flex" alignItems="center">
          <EventIcon event={event} />
        </Box>
        <Box display="flex" flex={1} alignItems="center">
          <Text fontSize="sm" color="gray.400" fontStyle="italic">
            Comment deleted
          </Text>
        </Box>
      </Flex>
    );
  }

  return (
    <Flex gap={2} alignItems="flex-start" py={2}>
      <Box pt="2px">
        <EventIcon event={event} />
      </Box>
      <Box flex={1}>
        <HStack gap={1} mb={1} flexWrap="wrap">
          <UserAvatar event={event} />
          <Text fontSize="sm" fontWeight="medium">
            {actorName}
            <Activity mode={isAuthor ? "visible" : "hidden"}>
              {" "}
              (Author)
            </Activity>
          </Text>
          <Text fontSize="xs" color="gray.400">
            {relativeTime}
          </Text>
          {event.is_edited && (
            <Text fontSize="xs" color="gray.400">
              (edited)
            </Text>
          )}
        </HStack>

        {isEditing ? (
          // Edit mode
          <Box>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              size="sm"
              resize="vertical"
              minH="80px"
              bg="white"
              borderColor="gray.300"
              _focus={{
                borderColor: "blue.400",
                boxShadow: "0 0 0 1px #4299E1",
              }}
              disabled={isSubmitting}
              autoFocus
            />
            <HStack gap={2} mt={2} justify="flex-end">
              <Button
                size="xs"
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                colorPalette="blue"
                onClick={handleSaveEdit}
                disabled={!editContent.trim() || isSubmitting}
                loading={isSubmitting}
              >
                Save
              </Button>
            </HStack>
          </Box>
        ) : (
          // View mode
          <Box
            className="group"
            bg="gray.50"
            borderRadius="md"
            p={2}
            borderWidth="1px"
            borderColor="gray.200"
            position="relative"
          >
            <MarkdownContent content={event.content || ""} fontSize="sm" />

            {/* Edit/Delete buttons - only visible to author on hover */}
            <Activity
              mode={isAuthor && (onEdit || onDelete) ? "visible" : "hidden"}
            >
              <HStack
                position="absolute"
                top={1}
                right={1}
                gap={0}
                opacity={0}
                _groupHover={{ opacity: 1 }}
                transition="opacity 0.2s"
              >
                {onEdit && (
                  <Tooltip content="Edit comment">
                    <IconButton
                      aria-label="Edit comment"
                      size="xs"
                      variant="ghost"
                      onClick={handleStartEdit}
                    >
                      <PiPencilSimple />
                    </IconButton>
                  </Tooltip>
                )}
                {onDelete && (
                  <Popover.Root
                    open={isDeletePopoverOpen}
                    onOpenChange={(e) => setIsDeletePopoverOpen(e.open)}
                  >
                    <Popover.Trigger asChild>
                      <span>
                        <Tooltip content="Delete comment">
                          <IconButton
                            aria-label="Delete comment"
                            size="xs"
                            variant="ghost"
                            colorPalette="red"
                          >
                            <PiTrashSimple />
                          </IconButton>
                        </Tooltip>
                      </span>
                    </Popover.Trigger>
                    <Portal>
                      <Popover.Positioner>
                        <Popover.Content width="auto">
                          <Popover.Arrow>
                            <Popover.ArrowTip />
                          </Popover.Arrow>
                          <Popover.Body p={3}>
                            <Text fontSize="sm" mb={3}>
                              Delete this comment?
                            </Text>
                            <HStack gap={2} justify="flex-end">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setIsDeletePopoverOpen(false)}
                                disabled={isDeleting}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="xs"
                                colorPalette="red"
                                onClick={handleDelete}
                                loading={isDeleting}
                              >
                                Delete
                              </Button>
                            </HStack>
                          </Popover.Body>
                        </Popover.Content>
                      </Popover.Positioner>
                    </Portal>
                  </Popover.Root>
                )}
              </HStack>
            </Activity>
          </Box>
        )}
      </Box>
    </Flex>
  );
}

export function TimelineEvent({
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
