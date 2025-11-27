/**
 * CheckTimeline - Main timeline/conversation panel for a check.
 *
 * Displays a chronological list of events (comments, state changes)
 * and provides an input for adding new comments.
 *
 * This component is only rendered when connected to Recce Cloud.
 */

import {
  Box,
  Center,
  Heading,
  Separator,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { fetchUser } from "@/lib/api/user";
import { useCheckEvents } from "@/lib/hooks/useCheckEvents";
import { CommentInput } from "./CommentInput";
import { TimelineEvent } from "./TimelineEvent";

interface CheckTimelineProps {
  checkId: string;
}

export function CheckTimeline({ checkId }: CheckTimelineProps) {
  const { events, isLoading, error, createComment, isCreatingComment } =
    useCheckEvents(checkId);

  // Get current user for determining edit/delete permissions
  const { data: currentUser } = useQuery({
    queryKey: cacheKeys.user(),
    queryFn: fetchUser,
    retry: false,
  });

  const handleCreateComment = (content: string) => {
    createComment(content);
  };

  if (isLoading) {
    return (
      <Center h="100%" p={4}>
        <Spinner size="sm" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100%" p={4}>
        <Text fontSize="sm" color="red.500">
          Failed to load timeline
        </Text>
      </Center>
    );
  }

  return (
    <VStack
      h="100%"
      align="stretch"
      gap={0}
      borderLeft="1px solid"
      borderColor="gray.200"
    >
      {/* Header */}
      <Box px={3} py={2} borderBottom="1px solid" borderColor="gray.200">
        <Heading size="sm" fontWeight="medium">
          Activity
        </Heading>
      </Box>

      {/* Events List - Scrollable */}
      <Box flex={1} overflowY="auto" px={3} py={2}>
        {events.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            No activity yet
          </Text>
        ) : (
          <VStack align="stretch" gap={0}>
            {events.map((event, index) => (
              <Box key={event.id}>
                <TimelineEvent event={event} currentUserId={currentUser?.id} />
                {index < events.length - 1 && (
                  <Separator borderColor="gray.100" />
                )}
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      {/* Comment Input - Fixed at bottom */}
      <Box
        px={3}
        py={3}
        borderTop="1px solid"
        borderColor="gray.200"
        bg="gray.50"
      >
        <CommentInput
          onSubmit={handleCreateComment}
          isSubmitting={isCreatingComment}
        />
      </Box>
    </VStack>
  );
}
