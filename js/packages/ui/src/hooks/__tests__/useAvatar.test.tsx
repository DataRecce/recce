/**
 * @file useAvatar.test.tsx
 * @description Tests for useAvatar hook
 *
 * Tests verify:
 * - Returns null when userId is not provided
 * - Returns null for non-GitHub users (email login)
 * - Returns GitHub avatar URL for GitHub users when user_id matches current user
 * - Returns null when user_id doesn't match current user
 * - Caches user and avatar queries appropriately
 */

import { vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../useApiConfig", () => ({
  useApiConfig: vi.fn(() => ({ apiClient: mockApiClient })),
}));

const mockFetchUser = vi.fn();
const mockFetchGitHubAvatar = vi.fn();

vi.mock("../../lib/api/user", () => ({
  fetchUser: (...args: unknown[]) => mockFetchUser(...args),
  fetchGitHubAvatar: (...args: unknown[]) => mockFetchGitHubAvatar(...args),
}));

vi.mock("../../api", () => ({
  cacheKeys: {
    user: () => ["user"],
  },
}));

// ============================================================================
// Imports
// ============================================================================

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useAvatar } from "../useAvatar";

// ============================================================================
// Test Setup
// ============================================================================

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const createMockUser = (overrides = {}) => ({
  id: "123",
  login: "testuser",
  login_type: "github",
  email: "test@example.com",
  onboarding_state: "completed",
  ...overrides,
});

describe("useAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchUser.mockReset();
    mockFetchGitHubAvatar.mockReset();
  });

  describe("when userId is not provided", () => {
    it("returns null avatarUrl and does not fetch", () => {
      const { result } = renderHook(() => useAvatar({ userId: null }), {
        wrapper: createWrapper(),
      });

      expect(result.current.avatarUrl).toBe(null);
      expect(result.current.isGitHubUser).toBe(false);
      expect(mockFetchUser).not.toHaveBeenCalled();
      expect(mockFetchGitHubAvatar).not.toHaveBeenCalled();
    });

    it("returns null for undefined userId", () => {
      const { result } = renderHook(() => useAvatar({ userId: undefined }), {
        wrapper: createWrapper(),
      });

      expect(result.current.avatarUrl).toBe(null);
      expect(result.current.isGitHubUser).toBe(false);
    });
  });

  describe("when current user is a GitHub user", () => {
    it("fetches GitHub avatar when userId matches current user", async () => {
      const githubUser = createMockUser({ id: "456", login_type: "github" });
      const avatarUrl = "https://avatars.githubusercontent.com/u/456";

      mockFetchUser.mockResolvedValue(githubUser);
      mockFetchGitHubAvatar.mockResolvedValue(avatarUrl);

      const { result } = renderHook(() => useAvatar({ userId: "456" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.avatarUrl).toBe(avatarUrl);
      });

      expect(result.current.isGitHubUser).toBe(true);
      expect(mockFetchGitHubAvatar).toHaveBeenCalledWith("456");
    });

    it("handles numeric userId", async () => {
      const githubUser = createMockUser({ id: "789", login_type: "github" });
      const avatarUrl = "https://avatars.githubusercontent.com/u/789";

      mockFetchUser.mockResolvedValue(githubUser);
      mockFetchGitHubAvatar.mockResolvedValue(avatarUrl);

      const { result } = renderHook(() => useAvatar({ userId: 789 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.avatarUrl).toBe(avatarUrl);
      });

      expect(result.current.isGitHubUser).toBe(true);
    });
  });

  describe("when current user is NOT a GitHub user (email login)", () => {
    it("returns null avatarUrl and does not fetch GitHub avatar", async () => {
      const emailUser = createMockUser({ id: "123", login_type: "email" });

      mockFetchUser.mockResolvedValue(emailUser);

      const { result } = renderHook(() => useAvatar({ userId: "123" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.avatarUrl).toBe(null);
      expect(result.current.isGitHubUser).toBe(false);
      expect(mockFetchGitHubAvatar).not.toHaveBeenCalled();
    });
  });

  describe("when userId does not match current user", () => {
    it("returns null avatarUrl (cannot verify other users login_type)", async () => {
      const currentUser = createMockUser({ id: "100", login_type: "github" });

      mockFetchUser.mockResolvedValue(currentUser);

      const { result } = renderHook(() => useAvatar({ userId: "999" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Different user ID, so we can't verify if they're a GitHub user
      expect(result.current.avatarUrl).toBe(null);
      expect(result.current.isGitHubUser).toBe(false);
      expect(mockFetchGitHubAvatar).not.toHaveBeenCalled();
    });
  });

  describe("when enabled is false", () => {
    it("does not fetch anything", () => {
      const { result } = renderHook(
        () => useAvatar({ userId: "123", enabled: false }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.avatarUrl).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(mockFetchUser).not.toHaveBeenCalled();
      expect(mockFetchGitHubAvatar).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns null when fetchUser fails", async () => {
      mockFetchUser.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAvatar({ userId: "123" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.avatarUrl).toBe(null);
      expect(result.current.isGitHubUser).toBe(false);
    });

    it("returns null when fetchGitHubAvatar fails", async () => {
      const githubUser = createMockUser({ id: "123", login_type: "github" });

      mockFetchUser.mockResolvedValue(githubUser);
      mockFetchGitHubAvatar.mockRejectedValue(new Error("GitHub API error"));

      const { result } = renderHook(() => useAvatar({ userId: "123" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.avatarUrl).toBe(null);
      expect(result.current.isGitHubUser).toBe(true);
    });
  });

  describe("loading state", () => {
    it("shows loading while fetching user", async () => {
      let resolveUser: (value: unknown) => void;
      const userPromise = new Promise((resolve) => {
        resolveUser = resolve;
      });
      mockFetchUser.mockReturnValue(userPromise);

      const { result } = renderHook(() => useAvatar({ userId: "123" }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      resolveUser!(createMockUser({ id: "123", login_type: "email" }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
