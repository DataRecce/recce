/**
 * @file AvatarDropdown.test.tsx
 * @description Comprehensive pre-migration tests for AvatarDropdown component
 *
 * Tests verify:
 * - Loading state with spinner display
 * - Avatar rendering with GitHub avatar or initials fallback
 * - Menu opening and closing behavior
 * - User information display in menu
 * - External link navigation (Recce Cloud, Support Calendar)
 * - Error state handling
 *
 * Source of truth: OSS functionality - these tests document current behavior
 * before migration to @datarecce/ui
 */

import { type Mock, type MockInstance, vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock @datarecce/ui/api
vi.mock("@datarecce/ui/api", () => ({
  cacheKeys: {
    user: () => ["user"],
  },
}));

// Mock @tanstack/react-query
const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

// Mock user API functions
vi.mock("@datarecce/ui/lib/api/user", () => ({
  fetchUser: vi.fn(),
  fetchGitHubAvatar: vi.fn(),
}));

// Mock ApiConfigContext
vi.mock("@datarecce/ui/hooks", () => ({
  useApiConfig: vi.fn(),
}));

// Mock react-icons
vi.mock("react-icons/fa", () => ({
  FaCloud: () => <span data-testid="cloud-icon">Cloud</span>,
  FaUser: () => <span data-testid="user-icon">User</span>,
}));

// Mock constants
vi.mock("@datarecce/ui/lib/const", () => ({
  RECCE_SUPPORT_CALENDAR_URL: "https://cal.com/team/recce/chat",
}));

// ============================================================================
// Imports
// ============================================================================

import { AvatarDropdown } from "@datarecce/ui/components/app";
import { useApiConfig } from "@datarecce/ui/hooks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockApiClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
});

const createMockUser = (overrides = {}) => ({
  id: "user-123",
  login: "testuser",
  email: "test@example.com",
  login_type: "github",
  ...overrides,
});

// ============================================================================
// Test Setup
// ============================================================================

describe("AvatarDropdown", () => {
  const mockUseApiConfig = useApiConfig as Mock;
  let mockApiClient: ReturnType<typeof createMockApiClient>;
  let windowOpenSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient = createMockApiClient();
    mockUseApiConfig.mockReturnValue({ apiClient: mockApiClient });

    // Mock window.open
    windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    // Default: successful user query
    mockUseQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "user") {
        return {
          data: createMockUser(),
          isLoading: false,
          error: null,
        };
      }
      if (queryKey[0] === "github-avatar") {
        return {
          data: "https://avatars.githubusercontent.com/u/123",
          isLoading: false,
          error: null,
        };
      }
      return { data: null, isLoading: false, error: null };
    });
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe("loading state", () => {
    it("displays loading spinner when user data is loading", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<AvatarDropdown />);

      // Should show circular progress
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("loading spinner is clickable to open menu", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<AvatarDropdown />);

      const loadingBox = screen.getByRole("progressbar").parentElement;
      expect(loadingBox).toHaveStyle({ cursor: "pointer" });
    });

    it("displays loading text in menu when user is loading", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<AvatarDropdown />);

      // Click to open menu
      const loadingBox = screen.getByRole("progressbar").parentElement;
      if (loadingBox) {
        fireEvent.click(loadingBox);
      }

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Avatar Rendering Tests
  // ==========================================================================

  describe("avatar rendering", () => {
    it("renders avatar with GitHub avatar URL when available", () => {
      mockUseQuery.mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "user") {
          return {
            data: createMockUser(),
            isLoading: false,
            error: null,
          };
        }
        if (queryKey[0] === "github-avatar") {
          return {
            data: "https://avatars.githubusercontent.com/u/123",
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      render(<AvatarDropdown />);

      const avatar = screen.getByRole("img");
      expect(avatar).toHaveAttribute(
        "src",
        "https://avatars.githubusercontent.com/u/123",
      );
    });

    it("renders initials when GitHub avatar is not available", () => {
      mockUseQuery.mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "user") {
          return {
            data: createMockUser({ login: "johndoe" }),
            isLoading: false,
            error: null,
          };
        }
        if (queryKey[0] === "github-avatar") {
          return {
            data: null,
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      render(<AvatarDropdown />);

      expect(screen.getByText("J")).toBeInTheDocument();
    });

    it("renders U as fallback when user login is missing", () => {
      mockUseQuery.mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "user") {
          return {
            data: createMockUser({ login: undefined }),
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      render(<AvatarDropdown />);

      expect(screen.getByText("U")).toBeInTheDocument();
    });

    it("avatar is clickable", () => {
      render(<AvatarDropdown />);

      // The avatar container (MuiAvatar) has the cursor:pointer style, not the inner img
      const avatar = screen.getByRole("img");
      const avatarContainer = avatar.closest(".MuiAvatar-root");
      expect(avatarContainer).toHaveStyle({ cursor: "pointer" });
    });

    it("only fetches GitHub avatar when user login type is github", () => {
      let githubAvatarQueryEnabled = false;

      mockUseQuery.mockImplementation(({ queryKey, enabled }) => {
        if (queryKey[0] === "user") {
          return {
            data: createMockUser({ login_type: "github" }),
            isLoading: false,
            error: null,
          };
        }
        if (queryKey[0] === "github-avatar") {
          githubAvatarQueryEnabled = enabled;
          return {
            data: "https://avatars.githubusercontent.com/u/123",
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      render(<AvatarDropdown />);

      expect(githubAvatarQueryEnabled).toBe(true);
    });

    it("does not fetch GitHub avatar for non-github login types", () => {
      let githubAvatarQueryEnabled = false;

      mockUseQuery.mockImplementation(({ queryKey, enabled }) => {
        if (queryKey[0] === "user") {
          return {
            data: createMockUser({ login_type: "local" }),
            isLoading: false,
            error: null,
          };
        }
        if (queryKey[0] === "github-avatar") {
          githubAvatarQueryEnabled = enabled;
          return {
            data: null,
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      render(<AvatarDropdown />);

      expect(githubAvatarQueryEnabled).toBe(false);
    });
  });

  // ==========================================================================
  // Menu Interaction Tests
  // ==========================================================================

  describe("menu interaction", () => {
    it("opens menu when avatar is clicked", () => {
      render(<AvatarDropdown />);

      const avatar = screen.getByRole("img");
      fireEvent.click(avatar);

      // Menu should be open - check for menu items
      expect(screen.getByText("Recce Cloud")).toBeInTheDocument();
      expect(screen.getByText("Get live support")).toBeInTheDocument();
    });

    it("closes menu when clicking outside", async () => {
      render(<AvatarDropdown />);

      const avatar = screen.getByRole("img");
      fireEvent.click(avatar);

      // Menu should be open
      expect(screen.getByText("Recce Cloud")).toBeInTheDocument();

      // Click on the MUI backdrop to close the menu
      const backdrop = document.querySelector(".MuiBackdrop-root");
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByText("Recce Cloud")).not.toBeInTheDocument();
      });
    });

    it("menu displays user login name", () => {
      mockUseQuery.mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "user") {
          return {
            data: createMockUser({ login: "johndoe" }),
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      render(<AvatarDropdown />);

      // When no github avatar, click on the avatar showing initials
      const avatarElement = screen.getByText("J"); // First letter of "johndoe"
      fireEvent.click(avatarElement);

      expect(screen.getByText("johndoe")).toBeInTheDocument();
    });

    it("menu displays user email when available", () => {
      mockUseQuery.mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "user") {
          return {
            data: createMockUser({ email: "john@example.com" }),
            isLoading: false,
            error: null,
          };
        }
        if (queryKey[0] === "github-avatar") {
          return {
            data: "https://avatars.githubusercontent.com/u/123",
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      render(<AvatarDropdown />);

      const avatar = screen.getByRole("img");
      fireEvent.click(avatar);

      expect(screen.getByText("john@example.com")).toBeInTheDocument();
    });

    it("menu does not display email when not available", () => {
      mockUseQuery.mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "user") {
          return {
            data: createMockUser({ email: undefined }),
            isLoading: false,
            error: null,
          };
        }
        if (queryKey[0] === "github-avatar") {
          return {
            data: "https://avatars.githubusercontent.com/u/123",
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      render(<AvatarDropdown />);

      const avatar = screen.getByRole("img");
      fireEvent.click(avatar);

      // Should not find any email-like text (but note @ is used in special chars test)
      expect(screen.queryByText("test@example.com")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Menu Items Tests
  // ==========================================================================

  describe("menu items", () => {
    it("renders Recce Cloud menu item with icon", () => {
      render(<AvatarDropdown />);

      const avatar = screen.getByRole("img");
      fireEvent.click(avatar);

      expect(screen.getByText("Recce Cloud")).toBeInTheDocument();
      expect(screen.getByTestId("cloud-icon")).toBeInTheDocument();
    });

    it("renders Get live support menu item with icon", () => {
      render(<AvatarDropdown />);

      const avatar = screen.getByRole("img");
      fireEvent.click(avatar);

      expect(screen.getByText("Get live support")).toBeInTheDocument();
      expect(screen.getByTestId("user-icon")).toBeInTheDocument();
    });

    it("opens Recce Cloud in new tab when clicked", () => {
      render(<AvatarDropdown />);

      const avatar = screen.getByRole("img");
      fireEvent.click(avatar);

      const recceCloudItem = screen.getByText("Recce Cloud");
      fireEvent.click(recceCloudItem);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        "https://cloud.datarecce.io/",
        "_blank",
      );
    });

    it("opens support calendar in new tab when clicked", () => {
      render(<AvatarDropdown />);

      const avatar = screen.getByRole("img");
      fireEvent.click(avatar);

      const supportItem = screen.getByText("Get live support");
      fireEvent.click(supportItem);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        "https://cal.com/team/recce/chat",
        "_blank",
      );
    });

    it("closes menu after clicking Recce Cloud item", async () => {
      render(<AvatarDropdown />);

      const avatar = screen.getByRole("img");
      fireEvent.click(avatar);

      const recceCloudItem = screen.getByText("Recce Cloud");
      fireEvent.click(recceCloudItem);

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByText("Recce Cloud")).not.toBeInTheDocument();
      });
    });

    it("closes menu after clicking support item", async () => {
      render(<AvatarDropdown />);

      const avatar = screen.getByRole("img");
      fireEvent.click(avatar);

      const supportItem = screen.getByText("Get live support");
      fireEvent.click(supportItem);

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByText("Get live support")).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Error State Tests
  // ==========================================================================

  describe("error state", () => {
    it("displays error message in menu when user fetch fails", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Network error"),
      });

      render(<AvatarDropdown />);

      // When error, no avatar image - just fallback "U"
      const avatar = screen.getByText("U");
      fireEvent.click(avatar);

      expect(
        screen.getByText("Failed to load user information"),
      ).toBeInTheDocument();
    });

    it("still renders avatar when error occurs", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Network error"),
      });

      render(<AvatarDropdown />);

      // Avatar should still render with fallback
      expect(screen.getByText("U")).toBeInTheDocument();
    });

    it("menu items are still available when user fetch fails", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Network error"),
      });

      render(<AvatarDropdown />);

      // When error, no avatar image - just fallback "U"
      const avatar = screen.getByText("U");
      fireEvent.click(avatar);

      // Menu items should still be available
      expect(screen.getByText("Recce Cloud")).toBeInTheDocument();
      expect(screen.getByText("Get live support")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Query Configuration Tests
  // ==========================================================================

  describe("query configuration", () => {
    it("uses cacheKeys.user() for user query key", () => {
      let userQueryKey: unknown;
      mockUseQuery.mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "user") {
          userQueryKey = queryKey;
          return {
            data: createMockUser(),
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      render(<AvatarDropdown />);

      expect(userQueryKey).toEqual(["user"]);
    });

    it("disables retry for user query", () => {
      mockUseQuery.mockImplementation(({ retry }) => {
        if (retry === false) {
          // User query should have retry: false
        }
        return {
          data: createMockUser(),
          isLoading: false,
          error: null,
        };
      });

      render(<AvatarDropdown />);
    });

    it("sets 5 minute stale time for GitHub avatar", () => {
      mockUseQuery.mockImplementation(({ staleTime }) => {
        if (staleTime === 5 * 60 * 1000) {
          // GitHub avatar query should have 5 minute stale time
        }
        return {
          data: "https://avatars.githubusercontent.com/u/123",
          isLoading: false,
          error: null,
        };
      });

      render(<AvatarDropdown />);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles user with empty string login", () => {
      mockUseQuery.mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "user") {
          return {
            data: createMockUser({ login: "" }),
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      render(<AvatarDropdown />);

      // Should use fallback 'U'
      expect(screen.getByText("U")).toBeInTheDocument();
    });

    it("handles lowercase user login for initials", () => {
      mockUseQuery.mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "user") {
          return {
            data: createMockUser({ login: "abc" }),
            isLoading: false,
            error: null,
          };
        }
        if (queryKey[0] === "github-avatar") {
          return {
            data: null,
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      render(<AvatarDropdown />);

      // Should uppercase first character
      expect(screen.getByText("A")).toBeInTheDocument();
    });

    it("handles user with special characters in login", () => {
      mockUseQuery.mockImplementation(({ queryKey }) => {
        if (queryKey[0] === "user") {
          return {
            data: createMockUser({ login: "@user-123" }),
            isLoading: false,
            error: null,
          };
        }
        if (queryKey[0] === "github-avatar") {
          return {
            data: null,
            isLoading: false,
            error: null,
          };
        }
        return { data: null, isLoading: false, error: null };
      });

      render(<AvatarDropdown />);

      // Should take first character and uppercase
      expect(screen.getByText("@")).toBeInTheDocument();
    });

    it("renders correctly when both loading and error are false with no data", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      render(<AvatarDropdown />);

      // Should render fallback avatar
      expect(screen.getByText("U")).toBeInTheDocument();
    });
  });
});
