/**
 * @file CheckList.test.tsx
 * @description Tests for OSS CheckList component
 *
 * Documents current behavior before migration to @datarecce/ui:
 * - Renders list of checks with icons
 * - Selection handling (click to select)
 * - Approval checkbox interaction
 * - Approval confirmation modal
 * - "Don't show again" bypass
 * - Drag-drop reordering
 */

import type { Check } from "@datarecce/ui/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckList } from "./CheckList";

// Mock the API
const mockUpdateCheck = jest.fn();
jest.mock("@datarecce/ui/api", () => ({
  cacheKeys: {
    check: (id: string) => ["check", id],
    checks: () => ["checks"],
  },
  updateCheck: (...args: unknown[]) => mockUpdateCheck(...args),
}));

// Mock hooks from @datarecce/ui
jest.mock("@datarecce/ui/hooks", () => ({
  useIsDark: () => false,
}));

// Mock contexts from @datarecce/ui
jest.mock("@datarecce/ui/contexts", () => ({
  useRecceInstanceContext: () => ({
    featureToggles: {
      disableUpdateChecklist: false,
    },
  }),
}));

// Note: run registry mock no longer needed - CheckCard uses internal letter icons

// Mock useRun hook
jest.mock("@/lib/hooks/useRun", () => ({
  useRun: () => ({
    run: { result: { some: "data" }, error: null },
    isLoading: false,
  }),
}));

// Mock API config
const mockApiClient = {};
jest.mock("@/lib/hooks/ApiConfigContext", () => ({
  useApiConfig: () => ({ apiClient: mockApiClient }),
}));

// Mock check toast
jest.mock("@/lib/hooks/useCheckToast", () => ({
  useCheckToast: () => ({
    markedAsApprovedToast: jest.fn(),
  }),
}));

// Mock drag-drop (simplified)
jest.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Droppable: ({
    children,
  }: {
    children: (provided: unknown) => React.ReactNode;
  }) =>
    children({
      droppableProps: {},
      innerRef: jest.fn(),
      placeholder: null,
    }),
  Draggable: ({
    children,
  }: {
    children: (provided: unknown, snapshot: unknown) => React.ReactNode;
  }) =>
    children(
      {
        draggableProps: { style: {} },
        dragHandleProps: {},
        innerRef: jest.fn(),
      },
      { isDragging: false },
    ),
}));

const createCheck = (overrides: Partial<Check> = {}): Check => ({
  check_id: "check-1",
  name: "Test Check",
  description: "Test description",
  type: "row_count_diff",
  is_checked: false,
  params: {},
  last_run: undefined,
  ...overrides,
});

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

describe("CheckList", () => {
  const mockOnCheckSelected = jest.fn();
  const mockOnChecksReordered = jest.fn();

  beforeEach(() => {
    mockOnCheckSelected.mockClear();
    mockOnChecksReordered.mockClear();
    mockUpdateCheck.mockClear();
    localStorage.clear();
  });

  describe("rendering", () => {
    it("renders list of checks", () => {
      const checks = [
        createCheck({ check_id: "check-1", name: "Schema Check" }),
        createCheck({ check_id: "check-2", name: "Row Count Check" }),
      ];

      renderWithQueryClient(
        <CheckList
          checks={checks}
          selectedItem={null}
          onCheckSelected={mockOnCheckSelected}
          onChecksReordered={mockOnChecksReordered}
        />,
      );

      expect(screen.getByText("Schema Check")).toBeInTheDocument();
      expect(screen.getByText("Row Count Check")).toBeInTheDocument();
    });

    it("renders check type indicators", () => {
      const checks = [createCheck({ type: "row_count_diff" })];

      renderWithQueryClient(
        <CheckList
          checks={checks}
          selectedItem={null}
          onCheckSelected={mockOnCheckSelected}
          onChecksReordered={mockOnChecksReordered}
        />,
      );

      // CheckCard from UI package uses letter abbreviations for check types
      // row_count_diff renders as "RD"
      expect(screen.getByText("RD")).toBeInTheDocument();
    });

    it("shows checkboxes for each check", () => {
      const checks = [
        createCheck({ check_id: "check-1" }),
        createCheck({ check_id: "check-2" }),
      ];

      renderWithQueryClient(
        <CheckList
          checks={checks}
          selectedItem={null}
          onCheckSelected={mockOnCheckSelected}
          onChecksReordered={mockOnChecksReordered}
        />,
      );

      expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    });

    it("shows checked checkbox for approved checks", () => {
      const checks = [createCheck({ is_checked: true })];

      renderWithQueryClient(
        <CheckList
          checks={checks}
          selectedItem={null}
          onCheckSelected={mockOnCheckSelected}
          onChecksReordered={mockOnChecksReordered}
        />,
      );

      expect(screen.getByRole("checkbox")).toBeChecked();
    });
  });

  describe("selection", () => {
    it("calls onCheckSelected when clicking a check", async () => {
      const user = userEvent.setup();
      const checks = [createCheck({ check_id: "check-123" })];

      renderWithQueryClient(
        <CheckList
          checks={checks}
          selectedItem={null}
          onCheckSelected={mockOnCheckSelected}
          onChecksReordered={mockOnChecksReordered}
        />,
      );

      await user.click(screen.getByText("Test Check"));

      expect(mockOnCheckSelected).toHaveBeenCalledWith("check-123");
    });
  });

  describe("approval modal", () => {
    it("shows approval modal when checking unchecked item", async () => {
      const user = userEvent.setup();
      const checks = [createCheck({ is_checked: false })];

      renderWithQueryClient(
        <CheckList
          checks={checks}
          selectedItem={null}
          onCheckSelected={mockOnCheckSelected}
          onChecksReordered={mockOnChecksReordered}
        />,
      );

      await user.click(screen.getByRole("checkbox"));

      expect(screen.getByText("Mark as Approved?")).toBeInTheDocument();
      expect(
        screen.getByText(/ensure you have reviewed the contents/i),
      ).toBeInTheDocument();
    });

    it("calls updateCheck when confirming approval", async () => {
      const user = userEvent.setup();
      mockUpdateCheck.mockResolvedValue({});
      const checks = [
        createCheck({ check_id: "check-abc", is_checked: false }),
      ];

      renderWithQueryClient(
        <CheckList
          checks={checks}
          selectedItem={null}
          onCheckSelected={mockOnCheckSelected}
          onChecksReordered={mockOnChecksReordered}
        />,
      );

      await user.click(screen.getByRole("checkbox"));
      await user.click(
        screen.getByRole("button", { name: /mark as approved/i }),
      );

      await waitFor(() => {
        expect(mockUpdateCheck).toHaveBeenCalledWith(
          "check-abc",
          { is_checked: true },
          mockApiClient,
        );
      });
    });

    it("closes modal on cancel", async () => {
      const user = userEvent.setup();
      const checks = [createCheck({ is_checked: false })];

      renderWithQueryClient(
        <CheckList
          checks={checks}
          selectedItem={null}
          onCheckSelected={mockOnCheckSelected}
          onChecksReordered={mockOnChecksReordered}
        />,
      );

      await user.click(screen.getByRole("checkbox"));
      expect(screen.getByText("Mark as Approved?")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText("Mark as Approved?")).not.toBeInTheDocument();
      });
    });

    it("sets localStorage when bypass checkbox is checked", async () => {
      const user = userEvent.setup();
      mockUpdateCheck.mockResolvedValue({});
      const checks = [createCheck({ is_checked: false })];

      renderWithQueryClient(
        <CheckList
          checks={checks}
          selectedItem={null}
          onCheckSelected={mockOnCheckSelected}
          onChecksReordered={mockOnChecksReordered}
        />,
      );

      await user.click(screen.getByRole("checkbox"));
      // Check the "Don't show again" checkbox
      await user.click(
        screen.getByRole("checkbox", { name: /don't show this again/i }),
      );
      await user.click(
        screen.getByRole("button", { name: /mark as approved/i }),
      );

      await waitFor(() => {
        expect(localStorage.getItem("bypassMarkAsApprovedWarning")).toBe(
          "true",
        );
      });
    });

    it("bypasses modal when localStorage bypass is set", async () => {
      localStorage.setItem("bypassMarkAsApprovedWarning", "true");
      const user = userEvent.setup();
      mockUpdateCheck.mockResolvedValue({});
      const checks = [
        createCheck({ check_id: "check-xyz", is_checked: false }),
      ];

      renderWithQueryClient(
        <CheckList
          checks={checks}
          selectedItem={null}
          onCheckSelected={mockOnCheckSelected}
          onChecksReordered={mockOnChecksReordered}
        />,
      );

      await user.click(screen.getByRole("checkbox"));

      // Modal should NOT appear, check should be approved directly
      expect(screen.queryByText("Mark as Approved?")).not.toBeInTheDocument();

      await waitFor(() => {
        expect(mockUpdateCheck).toHaveBeenCalledWith(
          "check-xyz",
          { is_checked: true },
          mockApiClient,
        );
      });
    });
  });

  describe("unchecking approved items", () => {
    it("unchecks without modal when already approved", async () => {
      const user = userEvent.setup();
      mockUpdateCheck.mockResolvedValue({});
      const checks = [
        createCheck({ check_id: "check-approved", is_checked: true }),
      ];

      renderWithQueryClient(
        <CheckList
          checks={checks}
          selectedItem={null}
          onCheckSelected={mockOnCheckSelected}
          onChecksReordered={mockOnChecksReordered}
        />,
      );

      await user.click(screen.getByRole("checkbox"));

      // No modal should appear
      expect(screen.queryByText("Mark as Approved?")).not.toBeInTheDocument();

      await waitFor(() => {
        expect(mockUpdateCheck).toHaveBeenCalledWith(
          "check-approved",
          { is_checked: false },
          mockApiClient,
        );
      });
    });
  });
});
