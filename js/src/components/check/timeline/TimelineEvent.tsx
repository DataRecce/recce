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

import { Avatar, Box, Flex, HStack, Icon, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "react";
import {
  PiBookmarkSimple,
  PiChatText,
  PiCheckCircle,
  PiCircle,
  PiNotePencil,
  PiPlusCircle,
} from "react-icons/pi";
import { CheckEvent, getEventIconType } from "@/lib/api/checkEvents";
import { fetchGitHubAvatar } from "@/lib/api/user";

interface TimelineEventProps {
  event: CheckEvent;
  currentUserId?: string;
  onEdit?: (eventId: string, content: string) => void;
  onDelete?: (eventId: string) => void;
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
}: {
  event: CheckEvent;
  currentUserId?: string;
  onEdit?: (eventId: string, content: string) => void;
  onDelete?: (eventId: string) => void;
}) {
  const { actor } = event;
  const actorName = actor.fullname || actor.login || "Someone";
  const relativeTime = formatDistanceToNow(new Date(event.created_at), {
    addSuffix: true,
  });
  const isAuthor =
    currentUserId && String(actor.user_id) === String(currentUserId);

  if (event.is_deleted) {
    return (
      <Flex gap={2} alignItems="flex-start" py={2}>
        <Box pt="2px">
          <EventIcon event={event} />
        </Box>
        <Box flex={1}>
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
        <Box
          bg="gray.50"
          borderRadius="md"
          p={2}
          borderWidth="1px"
          borderColor="gray.200"
        >
          <Text fontSize="sm" whiteSpace="pre-wrap">
            {event.content}
          </Text>
        </Box>
        {/* Edit/Delete actions will be added in DRC-2212 and DRC-2213 */}
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
