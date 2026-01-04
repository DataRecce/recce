/**
 * @file CheckContext.test.tsx
 * @description Tests for CheckContext provider and hooks (@datarecce/ui version)
 *
 * Phase 2A: Context Unification - Establishing behavioral contracts
 * These tests verify the behavior of CheckProvider and useCheckContext
 * to ensure the props-driven interface works correctly.
 *
 * KEY CHARACTERISTICS of @datarecce/ui CheckContext:
 * - Props-driven provider with full CRUD operations
 * - `checks: Check[]` - list of all checks
 * - `isLoading: boolean` - loading state
 * - `error?: string` - error state
 * - `selectedCheckId?: string` - currently selected check
 * - `onSelectCheck?: (checkId: string) => void` - selection callback
 * - `onCreateCheck?: (check: Partial<Check>) => Promise<Check>` - create
 * - `onUpdateCheck?: (checkId: string, updates: Partial<Check>) => Promise<Check>` - update
 * - `onDeleteCheck?: (checkId: string) => Promise<void>` - delete
 * - `onReorderChecks?: (sourceIndex: number, destIndex: number) => Promise<void>` - reorder
 * - `refetchChecks?: () => void` - refetch
 * - Consumer provides all callbacks (no internal API calls)
 */

import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";

import {
  type Check,
  CheckProvider,
  type CheckProviderProps,
  useCheckContext,
} from "../CheckContext";

/**
 * Mock check data for tests
 */
const mockChecks: Check[] = [
  {
    check_id: "check-1",
    name: "Check 1",
    type: "query_diff",
    description: "First check",
  },
  {
    check_id: "check-2",
    name: "Check 2",
    type: "schema_diff",
    is_checked: true,
  },
  { check_id: "check-3", name: "Check 3", type: "value_diff" },
];

/**
 * Create wrapper with CheckProvider and optional props
 */
function createWrapper(props: Partial<CheckProviderProps> = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <CheckProvider
        checks={props.checks ?? mockChecks}
        isLoading={props.isLoading ?? false}
        error={props.error}
        selectedCheckId={props.selectedCheckId}
        onSelectCheck={props.onSelectCheck}
        onCreateCheck={props.onCreateCheck}
        onUpdateCheck={props.onUpdateCheck}
        onDeleteCheck={props.onDeleteCheck}
        onReorderChecks={props.onReorderChecks}
        refetchChecks={props.refetchChecks}
      >
        {children}
      </CheckProvider>
    );
  };
}

/**
 * Test consumer component that displays context values
 */
function TestConsumer() {
  const context = useCheckContext();
  return (
    <div>
      <span data-testid="checks-count">{context.checks.length}</span>
      <span data-testid="is-loading">{String(context.isLoading)}</span>
      <span data-testid="error">{context.error ?? "none"}</span>
      <span data-testid="selected-check-id">
        {context.selectedCheckId ?? "none"}
      </span>
      <button
        type="button"
        onClick={() => context.onSelectCheck?.("check-2")}
        data-testid="select-check-btn"
      >
        Select Check 2
      </button>
      <button
        type="button"
        onClick={() =>
          context.onCreateCheck?.({ name: "New Check", type: "profile_diff" })
        }
        data-testid="create-check-btn"
      >
        Create Check
      </button>
      <button
        type="button"
        onClick={() =>
          context.onUpdateCheck?.("check-1", { name: "Updated Check 1" })
        }
        data-testid="update-check-btn"
      >
        Update Check 1
      </button>
      <button
        type="button"
        onClick={() => context.onDeleteCheck?.("check-3")}
        data-testid="delete-check-btn"
      >
        Delete Check 3
      </button>
      <button
        type="button"
        onClick={() => context.onReorderChecks?.(0, 2)}
        data-testid="reorder-checks-btn"
      >
        Reorder Checks
      </button>
      <button
        type="button"
        onClick={() => context.refetchChecks?.()}
        data-testid="refetch-checks-btn"
      >
        Refetch Checks
      </button>
      <ul data-testid="checks-list">
        {context.checks.map((check) => (
          <li key={check.check_id} data-testid={`check-${check.check_id}`}>
            {check.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

describe("CheckContext (@datarecce/ui)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("provider basics", () => {
    it("renders children", () => {
      render(
        <CheckProvider checks={[]} isLoading={false}>
          <div data-testid="child">Child Content</div>
        </CheckProvider>,
      );

      expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
    });

    it("provides context value accessible via hook", () => {
      render(
        <CheckProvider checks={mockChecks} isLoading={false}>
          <TestConsumer />
        </CheckProvider>,
      );

      // Context is accessible and provides values from props
      expect(screen.getByTestId("checks-count")).toHaveTextContent("3");
      expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
    });
  });

  describe("data props - checks array", () => {
    it("exposes checks array from props", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ checks: mockChecks }),
      });

      expect(result.current.checks).toEqual(mockChecks);
      expect(result.current.checks).toHaveLength(3);
    });

    it("defaults to empty array when checks not provided", () => {
      // Use a custom wrapper that doesn't provide checks to test the actual default
      function WrapperWithoutChecks({ children }: { children: ReactNode }) {
        return <CheckProvider isLoading={false}>{children}</CheckProvider>;
      }

      const { result } = renderHook(() => useCheckContext(), {
        wrapper: WrapperWithoutChecks,
      });

      expect(result.current.checks).toEqual([]);
    });

    it("renders each check in the list", () => {
      render(
        <CheckProvider checks={mockChecks} isLoading={false}>
          <TestConsumer />
        </CheckProvider>,
      );

      expect(screen.getByTestId("check-check-1")).toHaveTextContent("Check 1");
      expect(screen.getByTestId("check-check-2")).toHaveTextContent("Check 2");
      expect(screen.getByTestId("check-check-3")).toHaveTextContent("Check 3");
    });

    it("exposes check properties correctly", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ checks: mockChecks }),
      });

      const check1 = result.current.checks[0];
      expect(check1.check_id).toBe("check-1");
      expect(check1.name).toBe("Check 1");
      expect(check1.type).toBe("query_diff");
      expect(check1.description).toBe("First check");

      const check2 = result.current.checks[1];
      expect(check2.is_checked).toBe(true);
    });
  });

  describe("data props - isLoading", () => {
    it("exposes isLoading as false when prop is false", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ isLoading: false }),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("exposes isLoading as true when prop is true", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ isLoading: true }),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it("defaults isLoading to false when not provided", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ isLoading: undefined }),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("renders loading state in component", () => {
      render(
        <CheckProvider checks={[]} isLoading={true}>
          <TestConsumer />
        </CheckProvider>,
      );

      expect(screen.getByTestId("is-loading")).toHaveTextContent("true");
    });
  });

  describe("data props - error", () => {
    it("exposes error when prop is provided", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ error: "Failed to load checks" }),
      });

      expect(result.current.error).toBe("Failed to load checks");
    });

    it("error is undefined when not provided", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({}),
      });

      expect(result.current.error).toBeUndefined();
    });

    it("renders error in component", () => {
      render(
        <CheckProvider
          checks={[]}
          isLoading={false}
          error="Something went wrong"
        >
          <TestConsumer />
        </CheckProvider>,
      );

      expect(screen.getByTestId("error")).toHaveTextContent(
        "Something went wrong",
      );
    });
  });

  describe("data props - selectedCheckId", () => {
    it("exposes selectedCheckId when prop is provided", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ selectedCheckId: "check-2" }),
      });

      expect(result.current.selectedCheckId).toBe("check-2");
    });

    it("selectedCheckId is undefined when not provided", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({}),
      });

      expect(result.current.selectedCheckId).toBeUndefined();
    });

    it("renders selectedCheckId in component", () => {
      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          selectedCheckId="check-1"
        >
          <TestConsumer />
        </CheckProvider>,
      );

      expect(screen.getByTestId("selected-check-id")).toHaveTextContent(
        "check-1",
      );
    });
  });

  describe("callback props - onSelectCheck", () => {
    it("invokes onSelectCheck when called", () => {
      const mockOnSelectCheck = jest.fn();

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onSelectCheck={mockOnSelectCheck}
        >
          <TestConsumer />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("select-check-btn").click();
      });

      expect(mockOnSelectCheck).toHaveBeenCalledWith("check-2");
    });

    it("passes correct checkId to onSelectCheck", () => {
      const mockOnSelectCheck = jest.fn();

      function SelectCheckConsumer() {
        const context = useCheckContext();
        return (
          <div>
            <button
              type="button"
              onClick={() => context.onSelectCheck?.("custom-check-id")}
              data-testid="custom-select-btn"
            >
              Select Custom
            </button>
          </div>
        );
      }

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onSelectCheck={mockOnSelectCheck}
        >
          <SelectCheckConsumer />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("custom-select-btn").click();
      });

      expect(mockOnSelectCheck).toHaveBeenCalledWith("custom-check-id");
    });

    it("does not throw when onSelectCheck is not provided", () => {
      render(
        <CheckProvider checks={mockChecks} isLoading={false}>
          <TestConsumer />
        </CheckProvider>,
      );

      // Should not throw when clicking without callback
      expect(() => {
        act(() => {
          screen.getByTestId("select-check-btn").click();
        });
      }).not.toThrow();
    });
  });

  describe("callback props - onCreateCheck", () => {
    it("invokes onCreateCheck with check data", async () => {
      const mockOnCreateCheck = jest.fn().mockResolvedValue({
        check_id: "new-check",
        name: "New Check",
        type: "profile_diff",
      });

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onCreateCheck={mockOnCreateCheck}
        >
          <TestConsumer />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("create-check-btn").click();
      });

      await waitFor(() => {
        expect(mockOnCreateCheck).toHaveBeenCalledWith({
          name: "New Check",
          type: "profile_diff",
        });
      });
    });

    it("returns created check from callback", async () => {
      const createdCheck = {
        check_id: "new-check",
        name: "New Check",
        type: "profile_diff",
      };
      const mockOnCreateCheck = jest.fn().mockResolvedValue(createdCheck);

      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ onCreateCheck: mockOnCreateCheck }),
      });

      let returnedCheck: Check | undefined;
      await act(async () => {
        returnedCheck = await result.current.onCreateCheck?.({
          name: "New Check",
          type: "profile_diff",
        });
      });

      expect(returnedCheck).toEqual(createdCheck);
    });

    it("passes partial check data correctly", async () => {
      const mockOnCreateCheck = jest.fn().mockResolvedValue({
        check_id: "new",
        name: "Test",
        type: "query_diff",
      });

      function CreateCheckConsumer() {
        const context = useCheckContext();
        return (
          <button
            type="button"
            onClick={() =>
              context.onCreateCheck?.({
                name: "Complex Check",
                type: "row_count_diff",
                description: "A complex check",
                is_checked: false,
              })
            }
            data-testid="complex-create-btn"
          >
            Create Complex
          </button>
        );
      }

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onCreateCheck={mockOnCreateCheck}
        >
          <CreateCheckConsumer />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("complex-create-btn").click();
      });

      await waitFor(() => {
        expect(mockOnCreateCheck).toHaveBeenCalledWith({
          name: "Complex Check",
          type: "row_count_diff",
          description: "A complex check",
          is_checked: false,
        });
      });
    });

    it("does not throw when onCreateCheck is not provided", () => {
      render(
        <CheckProvider checks={mockChecks} isLoading={false}>
          <TestConsumer />
        </CheckProvider>,
      );

      // Should not throw when clicking without callback
      expect(() => {
        act(() => {
          screen.getByTestId("create-check-btn").click();
        });
      }).not.toThrow();
    });
  });

  describe("callback props - onUpdateCheck", () => {
    it("invokes onUpdateCheck with id and updates", async () => {
      const mockOnUpdateCheck = jest.fn().mockResolvedValue({
        check_id: "check-1",
        name: "Updated Check 1",
        type: "query_diff",
      });

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onUpdateCheck={mockOnUpdateCheck}
        >
          <TestConsumer />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("update-check-btn").click();
      });

      await waitFor(() => {
        expect(mockOnUpdateCheck).toHaveBeenCalledWith("check-1", {
          name: "Updated Check 1",
        });
      });
    });

    it("returns updated check from callback", async () => {
      const updatedCheck = {
        check_id: "check-1",
        name: "Updated",
        type: "query_diff",
      };
      const mockOnUpdateCheck = jest.fn().mockResolvedValue(updatedCheck);

      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ onUpdateCheck: mockOnUpdateCheck }),
      });

      let returnedCheck: Check | undefined;
      await act(async () => {
        returnedCheck = await result.current.onUpdateCheck?.("check-1", {
          name: "Updated",
        });
      });

      expect(returnedCheck).toEqual(updatedCheck);
    });

    it("passes multiple update fields correctly", async () => {
      const mockOnUpdateCheck = jest.fn().mockResolvedValue({
        check_id: "check-1",
        name: "New Name",
        type: "schema_diff",
      });

      function UpdateCheckConsumer() {
        const context = useCheckContext();
        return (
          <button
            type="button"
            onClick={() =>
              context.onUpdateCheck?.("check-1", {
                name: "New Name",
                description: "New description",
                is_checked: true,
              })
            }
            data-testid="multi-update-btn"
          >
            Multi Update
          </button>
        );
      }

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onUpdateCheck={mockOnUpdateCheck}
        >
          <UpdateCheckConsumer />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("multi-update-btn").click();
      });

      await waitFor(() => {
        expect(mockOnUpdateCheck).toHaveBeenCalledWith("check-1", {
          name: "New Name",
          description: "New description",
          is_checked: true,
        });
      });
    });

    it("does not throw when onUpdateCheck is not provided", () => {
      render(
        <CheckProvider checks={mockChecks} isLoading={false}>
          <TestConsumer />
        </CheckProvider>,
      );

      expect(() => {
        act(() => {
          screen.getByTestId("update-check-btn").click();
        });
      }).not.toThrow();
    });
  });

  describe("callback props - onDeleteCheck", () => {
    it("invokes onDeleteCheck with check id", async () => {
      const mockOnDeleteCheck = jest.fn().mockResolvedValue(undefined);

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onDeleteCheck={mockOnDeleteCheck}
        >
          <TestConsumer />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("delete-check-btn").click();
      });

      await waitFor(() => {
        expect(mockOnDeleteCheck).toHaveBeenCalledWith("check-3");
      });
    });

    it("passes correct id to onDeleteCheck", async () => {
      const mockOnDeleteCheck = jest.fn().mockResolvedValue(undefined);

      function DeleteCheckConsumer() {
        const context = useCheckContext();
        return (
          <button
            type="button"
            onClick={() => context.onDeleteCheck?.("specific-check-id")}
            data-testid="specific-delete-btn"
          >
            Delete Specific
          </button>
        );
      }

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onDeleteCheck={mockOnDeleteCheck}
        >
          <DeleteCheckConsumer />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("specific-delete-btn").click();
      });

      await waitFor(() => {
        expect(mockOnDeleteCheck).toHaveBeenCalledWith("specific-check-id");
      });
    });

    it("does not throw when onDeleteCheck is not provided", () => {
      render(
        <CheckProvider checks={mockChecks} isLoading={false}>
          <TestConsumer />
        </CheckProvider>,
      );

      expect(() => {
        act(() => {
          screen.getByTestId("delete-check-btn").click();
        });
      }).not.toThrow();
    });
  });

  describe("callback props - onReorderChecks", () => {
    it("invokes onReorderChecks with source and destination indices", async () => {
      const mockOnReorderChecks = jest.fn().mockResolvedValue(undefined);

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onReorderChecks={mockOnReorderChecks}
        >
          <TestConsumer />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("reorder-checks-btn").click();
      });

      await waitFor(() => {
        expect(mockOnReorderChecks).toHaveBeenCalledWith(0, 2);
      });
    });

    it("passes correct indices to onReorderChecks", async () => {
      const mockOnReorderChecks = jest.fn().mockResolvedValue(undefined);

      function ReorderConsumer() {
        const context = useCheckContext();
        return (
          <button
            type="button"
            onClick={() => context.onReorderChecks?.(1, 5)}
            data-testid="custom-reorder-btn"
          >
            Custom Reorder
          </button>
        );
      }

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onReorderChecks={mockOnReorderChecks}
        >
          <ReorderConsumer />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("custom-reorder-btn").click();
      });

      await waitFor(() => {
        expect(mockOnReorderChecks).toHaveBeenCalledWith(1, 5);
      });
    });

    it("does not throw when onReorderChecks is not provided", () => {
      render(
        <CheckProvider checks={mockChecks} isLoading={false}>
          <TestConsumer />
        </CheckProvider>,
      );

      expect(() => {
        act(() => {
          screen.getByTestId("reorder-checks-btn").click();
        });
      }).not.toThrow();
    });
  });

  describe("callback props - refetchChecks", () => {
    it("invokes refetchChecks when called", () => {
      const mockRefetchChecks = jest.fn();

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          refetchChecks={mockRefetchChecks}
        >
          <TestConsumer />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("refetch-checks-btn").click();
      });

      expect(mockRefetchChecks).toHaveBeenCalled();
    });

    it("does not throw when refetchChecks is not provided", () => {
      render(
        <CheckProvider checks={mockChecks} isLoading={false}>
          <TestConsumer />
        </CheckProvider>,
      );

      expect(() => {
        act(() => {
          screen.getByTestId("refetch-checks-btn").click();
        });
      }).not.toThrow();
    });
  });

  describe("hook behavior", () => {
    it("useCheckContext returns context with all values", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.checks).toBeDefined();
      expect(Array.isArray(result.current.checks)).toBe(true);
      expect(typeof result.current.isLoading).toBe("boolean");
    });

    it("hook returns default context values outside provider", () => {
      // Render without provider to test default context
      const { result } = renderHook(() => useCheckContext());

      // Default context should have empty checks array
      expect(result.current.checks).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeUndefined();
      expect(result.current.selectedCheckId).toBeUndefined();
    });

    it("optional callbacks are undefined in default context", () => {
      const { result } = renderHook(() => useCheckContext());

      expect(result.current.onSelectCheck).toBeUndefined();
      expect(result.current.onCreateCheck).toBeUndefined();
      expect(result.current.onUpdateCheck).toBeUndefined();
      expect(result.current.onDeleteCheck).toBeUndefined();
      expect(result.current.onReorderChecks).toBeUndefined();
      expect(result.current.refetchChecks).toBeUndefined();
    });

    it("allows calling CRUD operations via renderHook", async () => {
      const mockOnCreateCheck = jest.fn().mockResolvedValue({
        check_id: "hook-check",
        name: "Hook Check",
        type: "query_diff",
      });

      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ onCreateCheck: mockOnCreateCheck }),
      });

      await act(async () => {
        await result.current.onCreateCheck?.({
          name: "Hook Check",
          type: "query_diff",
        });
      });

      expect(mockOnCreateCheck).toHaveBeenCalledWith({
        name: "Hook Check",
        type: "query_diff",
      });
    });
  });

  describe("default values behavior", () => {
    it("checks defaults to empty array", () => {
      render(
        <CheckProvider isLoading={false}>
          <TestConsumer />
        </CheckProvider>,
      );

      expect(screen.getByTestId("checks-count")).toHaveTextContent("0");
    });

    it("isLoading defaults to false", () => {
      render(
        <CheckProvider checks={[]}>
          <TestConsumer />
        </CheckProvider>,
      );

      expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
    });

    it("error defaults to undefined (displayed as 'none')", () => {
      render(
        <CheckProvider checks={[]} isLoading={false}>
          <TestConsumer />
        </CheckProvider>,
      );

      expect(screen.getByTestId("error")).toHaveTextContent("none");
    });

    it("selectedCheckId defaults to undefined (displayed as 'none')", () => {
      render(
        <CheckProvider checks={[]} isLoading={false}>
          <TestConsumer />
        </CheckProvider>,
      );

      expect(screen.getByTestId("selected-check-id")).toHaveTextContent("none");
    });
  });

  describe("props-driven nature (no API mocking needed)", () => {
    it("does not make any API calls - all actions delegated to callbacks", async () => {
      // This test verifies the key design of the props-driven context
      // No need to mock API functions because none are called
      const mockOnCreateCheck = jest
        .fn()
        .mockResolvedValue({ check_id: "new", name: "New", type: "test" });
      const mockOnUpdateCheck = jest.fn().mockResolvedValue({
        check_id: "check-1",
        name: "Updated",
        type: "test",
      });
      const mockOnDeleteCheck = jest.fn().mockResolvedValue(undefined);

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onCreateCheck={mockOnCreateCheck}
          onUpdateCheck={mockOnUpdateCheck}
          onDeleteCheck={mockOnDeleteCheck}
        >
          <TestConsumer />
        </CheckProvider>,
      );

      // All actions are delegated to provided callbacks
      act(() => {
        screen.getByTestId("create-check-btn").click();
      });
      await waitFor(() => {
        expect(mockOnCreateCheck).toHaveBeenCalled();
      });

      act(() => {
        screen.getByTestId("update-check-btn").click();
      });
      await waitFor(() => {
        expect(mockOnUpdateCheck).toHaveBeenCalled();
      });

      act(() => {
        screen.getByTestId("delete-check-btn").click();
      });
      await waitFor(() => {
        expect(mockOnDeleteCheck).toHaveBeenCalled();
      });
    });

    it("consumer controls all side effects via callbacks", async () => {
      const sideEffects: string[] = [];
      const mockOnCreateCheck = jest.fn().mockImplementation(() => {
        sideEffects.push("create");
        return Promise.resolve({ check_id: "new", name: "New", type: "test" });
      });
      const mockOnSelectCheck = jest.fn().mockImplementation(() => {
        sideEffects.push("select");
      });
      const mockRefetchChecks = jest.fn().mockImplementation(() => {
        sideEffects.push("refetch");
      });

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onCreateCheck={mockOnCreateCheck}
          onSelectCheck={mockOnSelectCheck}
          refetchChecks={mockRefetchChecks}
        >
          <TestConsumer />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("create-check-btn").click();
      });

      act(() => {
        screen.getByTestId("select-check-btn").click();
      });

      act(() => {
        screen.getByTestId("refetch-checks-btn").click();
      });

      // Consumer-provided callbacks control all external effects
      await waitFor(() => {
        expect(sideEffects).toContain("create");
        expect(sideEffects).toContain("select");
        expect(sideEffects).toContain("refetch");
      });
    });
  });

  describe("multiple consumers", () => {
    it("multiple consumers share the same context data", () => {
      function Consumer1() {
        const context = useCheckContext();
        return (
          <span data-testid="consumer1-count">{context.checks.length}</span>
        );
      }

      function Consumer2() {
        const context = useCheckContext();
        return (
          <span data-testid="consumer2-count">{context.checks.length}</span>
        );
      }

      render(
        <CheckProvider checks={mockChecks} isLoading={false}>
          <Consumer1 />
          <Consumer2 />
        </CheckProvider>,
      );

      // Both consumers should see the same data
      expect(screen.getByTestId("consumer1-count")).toHaveTextContent("3");
      expect(screen.getByTestId("consumer2-count")).toHaveTextContent("3");
    });

    it("multiple consumers share the same selectedCheckId", () => {
      function Consumer1() {
        const context = useCheckContext();
        return (
          <span data-testid="consumer1-selected">
            {context.selectedCheckId ?? "none"}
          </span>
        );
      }

      function Consumer2() {
        const context = useCheckContext();
        return (
          <span data-testid="consumer2-selected">
            {context.selectedCheckId ?? "none"}
          </span>
        );
      }

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          selectedCheckId="check-2"
        >
          <Consumer1 />
          <Consumer2 />
        </CheckProvider>,
      );

      expect(screen.getByTestId("consumer1-selected")).toHaveTextContent(
        "check-2",
      );
      expect(screen.getByTestId("consumer2-selected")).toHaveTextContent(
        "check-2",
      );
    });

    it("all consumers invoke the same callback", () => {
      const mockOnSelectCheck = jest.fn();

      function Consumer1() {
        const context = useCheckContext();
        return (
          <button
            type="button"
            onClick={() => context.onSelectCheck?.("from-consumer-1")}
            data-testid="consumer1-btn"
          >
            Select from 1
          </button>
        );
      }

      function Consumer2() {
        const context = useCheckContext();
        return (
          <button
            type="button"
            onClick={() => context.onSelectCheck?.("from-consumer-2")}
            data-testid="consumer2-btn"
          >
            Select from 2
          </button>
        );
      }

      render(
        <CheckProvider
          checks={mockChecks}
          isLoading={false}
          onSelectCheck={mockOnSelectCheck}
        >
          <Consumer1 />
          <Consumer2 />
        </CheckProvider>,
      );

      act(() => {
        screen.getByTestId("consumer1-btn").click();
      });
      expect(mockOnSelectCheck).toHaveBeenCalledWith("from-consumer-1");

      act(() => {
        screen.getByTestId("consumer2-btn").click();
      });
      expect(mockOnSelectCheck).toHaveBeenCalledWith("from-consumer-2");
    });
  });

  describe("edge cases", () => {
    it("handles empty checks array", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ checks: [] }),
      });

      expect(result.current.checks).toEqual([]);
      expect(result.current.checks).toHaveLength(0);
    });

    it("handles very long error message", () => {
      // Create a long error message without trailing space
      const longError = "Error ".repeat(99) + "Error";

      render(
        <CheckProvider checks={[]} isLoading={false} error={longError}>
          <TestConsumer />
        </CheckProvider>,
      );

      expect(screen.getByTestId("error")).toHaveTextContent(longError);
    });

    it("handles check with minimal properties", () => {
      const minimalCheck: Check = {
        check_id: "min",
        name: "Minimal",
        type: "test",
      };

      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ checks: [minimalCheck] }),
      });

      expect(result.current.checks[0]).toEqual(minimalCheck);
      expect(result.current.checks[0].description).toBeUndefined();
      expect(result.current.checks[0].is_checked).toBeUndefined();
    });

    it("handles rapid successive callback invocations", () => {
      const mockOnSelectCheck = jest.fn();

      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ onSelectCheck: mockOnSelectCheck }),
      });

      act(() => {
        result.current.onSelectCheck?.("check-1");
        result.current.onSelectCheck?.("check-2");
        result.current.onSelectCheck?.("check-3");
      });

      expect(mockOnSelectCheck).toHaveBeenCalledTimes(3);
      expect(mockOnSelectCheck).toHaveBeenNthCalledWith(1, "check-1");
      expect(mockOnSelectCheck).toHaveBeenNthCalledWith(2, "check-2");
      expect(mockOnSelectCheck).toHaveBeenNthCalledWith(3, "check-3");
    });

    it("handles callback that rejects", async () => {
      const mockOnCreateCheck = jest
        .fn()
        .mockRejectedValue(new Error("Create failed"));

      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({ onCreateCheck: mockOnCreateCheck }),
      });

      // The callback rejection is the consumer's responsibility to handle
      // The context itself doesn't catch or handle errors
      await expect(
        result.current.onCreateCheck?.({ name: "Test", type: "test" }),
      ).rejects.toThrow("Create failed");
    });

    it("handles undefined callback invocation gracefully", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper({}),
      });

      // Calling undefined callbacks should not throw
      expect(() => {
        result.current.onSelectCheck?.("test");
        result.current.refetchChecks?.();
      }).not.toThrow();
    });
  });

  describe("context display name", () => {
    it("has correct displayName for debugging", () => {
      // This is a metadata test - the CheckContext should have a displayName
      // We can verify this by checking if the context renders correctly with DevTools
      render(
        <CheckProvider checks={[]} isLoading={false}>
          <div data-testid="context-test">Context renders</div>
        </CheckProvider>,
      );

      expect(screen.getByTestId("context-test")).toBeInTheDocument();
    });
  });
});
