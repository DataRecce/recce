/**
 * useAvatar - Hook for fetching user avatars with proper fallback handling.
 *
 * Solves the issue where email-only login users (non-GitHub) were showing
 * incorrect GitHub avatars because their Recce Cloud user_id was being
 * passed to the GitHub API.
 *
 * Logic:
 * 1. Fetch current user data to get login_type
 * 2. If actor's user_id matches current user AND login_type is "github":
 *    - Fetch and return GitHub avatar URL
 * 3. Otherwise:
 *    - Return null (component should show initials fallback)
 */

import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "../api";
import { fetchGitHubAvatar, fetchUser } from "../lib/api/user";
import { useApiConfig } from "./useApiConfig";

export interface UseAvatarOptions {
  /** The user ID from the event actor */
  userId: string | number | null | undefined;
  /** Whether to enable the query */
  enabled?: boolean;
}

export interface UseAvatarResult {
  /** The avatar URL if available, null otherwise */
  avatarUrl: string | null;
  /** Whether the avatar is loading */
  isLoading: boolean;
  /** Whether this user is a GitHub user */
  isGitHubUser: boolean;
}

/**
 * Hook to fetch a user's avatar with proper fallback handling.
 *
 * Only fetches GitHub avatars for users who authenticated via GitHub.
 * For email-only users, returns null so the component can show initials.
 *
 * @example
 * ```tsx
 * function UserAvatar({ userId, displayName }: Props) {
 *   const { avatarUrl } = useAvatar({ userId });
 *
 *   return (
 *     <MuiAvatar src={avatarUrl || undefined}>
 *       {displayName.charAt(0).toUpperCase()}
 *     </MuiAvatar>
 *   );
 * }
 * ```
 */
export function useAvatar({
  userId,
  enabled = true,
}: UseAvatarOptions): UseAvatarResult {
  const { apiClient } = useApiConfig();
  const userIdString = userId?.toString();

  // Fetch current user to get login_type
  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: cacheKeys.user(),
    queryFn: () => fetchUser(apiClient),
    enabled: enabled && !!userIdString,
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Determine if this is a GitHub user
  // Only fetch GitHub avatar if:
  // 1. The actor's user_id matches the current user's id
  // 2. The current user authenticated via GitHub
  const isCurrentUser = Boolean(
    currentUser && userIdString && currentUser.id === userIdString,
  );
  const isGitHubUser = isCurrentUser && currentUser?.login_type === "github";
  const shouldFetchAvatar = Boolean(enabled && isGitHubUser && userIdString);

  // Fetch GitHub avatar only for GitHub users
  const { data: avatarUrl, isLoading: isAvatarLoading } = useQuery({
    queryKey: ["github-avatar", userIdString],
    queryFn: () =>
      userIdString ? fetchGitHubAvatar(userIdString) : Promise.resolve(null),
    enabled: shouldFetchAvatar,
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    avatarUrl: typeof avatarUrl === "string" ? avatarUrl : null,
    isLoading: isUserLoading || (shouldFetchAvatar && isAvatarLoading),
    isGitHubUser: Boolean(isGitHubUser),
  };
}
