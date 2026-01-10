/**
 * @recce-migration NOT_APPLICABLE
 *
 * This hook is specific to Recce Cloud and should not be migrated to @datarecce/ui.
 *
 * Reason: Check events (timeline, comments, approvals) are a Cloud-only feature
 * that requires the Recce Cloud backend API. OSS does not have this functionality.
 *
 * If this changes in the future, consider:
 * - Moving to @datarecce/ui if check events become available in OSS
 * - Creating an abstract interface if multiple backends need to support events
 */

/**
 * Custom hook for managing check events (timeline/conversation).
 *
 * Provides data fetching with polling for real-time updates,
 * and mutation functions for CRUD operations.
 */

import {
  cacheKeys,
  createComment,
  deleteComment,
  listCheckEvents,
  updateComment,
} from "@datarecce/ui/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiConfig } from "./ApiConfigContext";

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
  const { apiClient } = useApiConfig();

  // Fetch events with polling
  const {
    data: events,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: cacheKeys.checkEvents(checkId),
    queryFn: () => listCheckEvents(checkId, apiClient),
    enabled,
    refetchInterval: POLLING_INTERVAL,
    refetchIntervalInBackground: false,
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (content: string) => createComment(checkId, content, apiClient),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: cacheKeys.checkEvents(checkId),
      });
    },
  });

  // Update comment mutation
  const updateCommentMutation = useMutation({
    mutationFn: ({ eventId, content }: { eventId: string; content: string }) =>
      updateComment(checkId, eventId, content, apiClient),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: cacheKeys.checkEvents(checkId),
      });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (eventId: string) => deleteComment(checkId, eventId, apiClient),
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

    // Use mutateAsync for updateComment to allow awaiting in UI
    updateComment: updateCommentMutation.mutateAsync,
    isUpdatingComment: updateCommentMutation.isPending,
    updateCommentError: updateCommentMutation.error,

    // Use mutateAsync for deleteComment to allow awaiting in UI
    deleteComment: deleteCommentMutation.mutateAsync,
    isDeletingComment: deleteCommentMutation.isPending,
    deleteCommentError: deleteCommentMutation.error,
  };
}
