/**
 * Custom hook for managing check events (timeline/conversation).
 *
 * Provides data fetching with polling for real-time updates,
 * and mutation functions for CRUD operations.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import {
  CheckEvent,
  createComment,
  deleteComment,
  listCheckEvents,
  updateComment,
} from "@/lib/api/checkEvents";

const POLLING_INTERVAL = 10000; // 10 seconds

interface UseCheckEventsOptions {
  enabled?: boolean;
}

export function useCheckEvents(
  checkId: string,
  options: UseCheckEventsOptions = {},
) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch events with polling
  const {
    data: events,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: cacheKeys.checkEvents(checkId),
    queryFn: () => listCheckEvents(checkId),
    enabled,
    refetchInterval: POLLING_INTERVAL,
    refetchIntervalInBackground: false,
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (content: string) => createComment(checkId, content),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: cacheKeys.checkEvents(checkId),
      });
    },
  });

  // Update comment mutation
  const updateCommentMutation = useMutation({
    mutationFn: ({ eventId, content }: { eventId: string; content: string }) =>
      updateComment(checkId, eventId, content),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: cacheKeys.checkEvents(checkId),
      });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (eventId: string) => deleteComment(checkId, eventId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: cacheKeys.checkEvents(checkId),
      });
    },
  });

  return {
    events: events ?? [],
    isLoading,
    error,
    refetch,

    // Mutations
    createComment: createCommentMutation.mutate,
    isCreatingComment: createCommentMutation.isPending,
    createCommentError: createCommentMutation.error,

    updateComment: updateCommentMutation.mutate,
    isUpdatingComment: updateCommentMutation.isPending,
    updateCommentError: updateCommentMutation.error,

    deleteComment: deleteCommentMutation.mutate,
    isDeletingComment: deleteCommentMutation.isPending,
    deleteCommentError: deleteCommentMutation.error,
  };
}
