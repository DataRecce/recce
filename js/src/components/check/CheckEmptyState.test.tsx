/**
 * @file CheckEmptyState.test.tsx
 * @description Tests for OSS CheckEmptyState component
 *
 * Documents current behavior before migration to @datarecce/ui:
 * - Displays empty state message and icon
 * - Shows "Create Schema Diff Check" button
 * - Calls createSchemaDiffCheck API on click
 * - Navigates to check detail on success
 * - Shows loading state while creating
 */

import { CheckEmptyStateOss as CheckEmptyState } from "@datarecce/ui/components/check/CheckEmptyStateOss";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

// Mock the API
const mockCreateSchemaDiffCheck = vi.fn();
vi.mock("@datarecce/ui/api", () => ({
  cacheKeys: {
    checks: () => ["checks"],
  },
  createSchemaDiffCheck: (...args: unknown[]) =>
    mockCreateSchemaDiffCheck(...args),
}));

// Mock the app router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock the API config
const mockApiClient = {};
vi.mock("@datarecce/ui/hooks", () => ({
  useApiConfig: () => ({ apiClient: mockApiClient }),
}));

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

describe("CheckEmptyState", () => {
  beforeEach(() => {
    mockCreateSchemaDiffCheck.mockClear();
    mockPush.mockClear();
  });

  describe("rendering", () => {
    it("displays empty state message", () => {
      renderWithQueryClient(<CheckEmptyState />);

      expect(screen.getByText("No checks yet")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Checks help you validate data quality and catch issues.",
        ),
      ).toBeInTheDocument();
    });

    it("displays action button with correct text", () => {
      renderWithQueryClient(<CheckEmptyState />);

      // The UI primitive renders the action button with the provided text
      const button = screen.getByRole("button", {
        name: /create schema diff check/i,
      });
      expect(button).toBeInTheDocument();
      expect(button).toBeEnabled();
    });

    it("displays create schema diff check button", () => {
      renderWithQueryClient(<CheckEmptyState />);

      expect(
        screen.getByRole("button", { name: /create schema diff check/i }),
      ).toBeInTheDocument();
    });

    it("displays description text about schema checks", () => {
      renderWithQueryClient(<CheckEmptyState />);

      expect(
        screen.getByText(/schema checks compare modified models/i),
      ).toBeInTheDocument();
    });
  });

  describe("create schema check action", () => {
    it("calls createSchemaDiffCheck on button click", async () => {
      const user = userEvent.setup();
      mockCreateSchemaDiffCheck.mockResolvedValue({
        check_id: "new-check-123",
      });

      renderWithQueryClient(<CheckEmptyState />);

      await user.click(
        screen.getByRole("button", { name: /create schema diff check/i }),
      );

      expect(mockCreateSchemaDiffCheck).toHaveBeenCalledWith(
        { select: "state:modified" },
        mockApiClient,
      );
    });

    it("navigates to check detail on success", async () => {
      const user = userEvent.setup();
      mockCreateSchemaDiffCheck.mockResolvedValue({
        check_id: "new-check-123",
      });

      renderWithQueryClient(<CheckEmptyState />);

      await user.click(
        screen.getByRole("button", { name: /create schema diff check/i }),
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/checks/?id=new-check-123");
      });
    });

    it("disables button while creating", async () => {
      const user = userEvent.setup();
      // Create a promise we can control
      let resolvePromise: (value: unknown) => void = () => {
        // placeholder - will be replaced by Promise constructor
      };
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockCreateSchemaDiffCheck.mockReturnValue(pendingPromise);

      renderWithQueryClient(<CheckEmptyState />);

      const button = screen.getByRole("button", {
        name: /create schema diff check/i,
      });
      await user.click(button);

      // Button should be disabled while pending
      expect(button).toBeDisabled();

      // Resolve the promise to cleanup
      resolvePromise({ check_id: "test" });
    });
  });
});
