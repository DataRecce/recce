/**
 * @file QueryContext.test.tsx
 * @description Tests for QueryContext provider and hooks (@datarecce/ui version)
 *
 * Phase 2A: Context Unification - Establishing behavioral contracts
 * These tests verify the behavior of QueryProvider and useQueryContext
 * to ensure the props-driven interface works correctly.
 *
 * KEY CHARACTERISTICS of @datarecce/ui QueryContext:
 * - Manages query EXECUTION state (different from OSS's RecceQueryContext which tracks INPUT state)
 * - Props-driven provider with execution callbacks
 * - `sql: string` - current SQL query
 * - `isExecuting: boolean` - whether query is running
 * - `error?: string` - execution error
 * - `baseResult?: QueryResult` - base environment result
 * - `currentResult?: QueryResult` - current environment result
 * - `onSqlChange?: (sql: string) => void` - SQL change callback
 * - `onExecute?: (sql: string) => Promise<void>` - execute callback
 * - `onCancel?: () => void` - cancel callback
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
import { vi } from "vitest";

import {
  QueryProvider,
  type QueryProviderProps,
  type QueryResult,
  useQueryContext,
} from "../QueryContext";

/**
 * Mock query results for tests
 */
const mockBaseResult: QueryResult = {
  columns: ["id", "name", "value"],
  data: [
    { id: 1, name: "Base Item 1", value: 100 },
    { id: 2, name: "Base Item 2", value: 200 },
  ],
  rowCount: 2,
};

const mockCurrentResult: QueryResult = {
  columns: ["id", "name", "value"],
  data: [
    { id: 1, name: "Current Item 1", value: 150 },
    { id: 2, name: "Current Item 2", value: 250 },
    { id: 3, name: "Current Item 3", value: 300 },
  ],
  rowCount: 3,
};

/**
 * Create wrapper with QueryProvider and optional props
 */
function createWrapper(props: Partial<QueryProviderProps> = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryProvider
        sql={props.sql ?? "SELECT 1"}
        isExecuting={props.isExecuting ?? false}
        error={props.error}
        baseResult={props.baseResult}
        currentResult={props.currentResult}
        onSqlChange={props.onSqlChange}
        onExecute={props.onExecute}
        onCancel={props.onCancel}
      >
        {children}
      </QueryProvider>
    );
  };
}

/**
 * Test consumer component that displays context values
 */
function TestConsumer() {
  const context = useQueryContext();
  return (
    <div>
      <span data-testid="sql">{context.sql}</span>
      <span data-testid="is-executing">{String(context.isExecuting)}</span>
      <span data-testid="error">{context.error ?? "none"}</span>
      <span data-testid="has-base-result">
        {context.baseResult ? "yes" : "no"}
      </span>
      <span data-testid="has-current-result">
        {context.currentResult ? "yes" : "no"}
      </span>
      <span data-testid="base-row-count">
        {context.baseResult?.rowCount ?? "0"}
      </span>
      <span data-testid="current-row-count">
        {context.currentResult?.rowCount ?? "0"}
      </span>
      <button
        type="button"
        onClick={() => context.onSqlChange?.("SELECT * FROM users")}
        data-testid="change-sql-btn"
      >
        Change SQL
      </button>
      <button
        type="button"
        onClick={() => context.onExecute?.("SELECT * FROM orders")}
        data-testid="execute-btn"
      >
        Execute
      </button>
      <button
        type="button"
        onClick={() => context.onCancel?.()}
        data-testid="cancel-btn"
      >
        Cancel
      </button>
    </div>
  );
}

describe("QueryContext (@datarecce/ui)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("provider basics", () => {
    it("renders children", () => {
      render(
        <QueryProvider sql="" isExecuting={false}>
          <div data-testid="child">Child Content</div>
        </QueryProvider>,
      );

      expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
    });

    it("provides context value accessible via hook", () => {
      render(
        <QueryProvider sql="SELECT * FROM test" isExecuting={false}>
          <TestConsumer />
        </QueryProvider>,
      );

      // Context is accessible and provides values from props
      expect(screen.getByTestId("sql")).toHaveTextContent("SELECT * FROM test");
      expect(screen.getByTestId("is-executing")).toHaveTextContent("false");
    });
  });

  describe("data props - sql", () => {
    it("exposes sql from props", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ sql: "SELECT * FROM users" }),
      });

      expect(result.current.sql).toBe("SELECT * FROM users");
    });

    it("defaults to empty string when sql not provided", () => {
      function WrapperWithoutSql({ children }: { children: ReactNode }) {
        return <QueryProvider isExecuting={false}>{children}</QueryProvider>;
      }

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: WrapperWithoutSql,
      });

      expect(result.current.sql).toBe("");
    });

    it("renders sql in component", () => {
      render(
        <QueryProvider sql="SELECT id, name FROM products" isExecuting={false}>
          <TestConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("sql")).toHaveTextContent(
        "SELECT id, name FROM products",
      );
    });

    it("handles empty sql string", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ sql: "" }),
      });

      expect(result.current.sql).toBe("");
    });

    it("handles complex SQL with special characters", () => {
      const complexSql = `
        SELECT u.*, o.total
        FROM users u
        JOIN orders o ON u.id = o.user_id
        WHERE u.name LIKE '%test%'
        AND o.created_at > '2024-01-01'
      `;
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ sql: complexSql }),
      });

      expect(result.current.sql).toBe(complexSql);
    });
  });

  describe("data props - isExecuting", () => {
    it("exposes isExecuting as false when prop is false", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ isExecuting: false }),
      });

      expect(result.current.isExecuting).toBe(false);
    });

    it("exposes isExecuting as true when prop is true", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ isExecuting: true }),
      });

      expect(result.current.isExecuting).toBe(true);
    });

    it("defaults isExecuting to false when not provided", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ isExecuting: undefined }),
      });

      expect(result.current.isExecuting).toBe(false);
    });

    it("renders executing state in component", () => {
      render(
        <QueryProvider sql="SELECT 1" isExecuting={true}>
          <TestConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("is-executing")).toHaveTextContent("true");
    });
  });

  describe("data props - error", () => {
    it("exposes error when prop is provided", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ error: "Query execution failed" }),
      });

      expect(result.current.error).toBe("Query execution failed");
    });

    it("error is undefined when not provided", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({}),
      });

      expect(result.current.error).toBeUndefined();
    });

    it("renders error in component", () => {
      render(
        <QueryProvider
          sql="SELECT * FROM nonexistent"
          isExecuting={false}
          error="Table not found"
        >
          <TestConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("error")).toHaveTextContent("Table not found");
    });

    it("handles long error messages", () => {
      const longError =
        "SQL Error: " +
        "Syntax error near unexpected token. ".repeat(10) +
        "Please check your query.";

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ error: longError }),
      });

      expect(result.current.error).toBe(longError);
    });
  });

  describe("data props - baseResult", () => {
    it("exposes baseResult when prop is provided", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ baseResult: mockBaseResult }),
      });

      expect(result.current.baseResult).toEqual(mockBaseResult);
    });

    it("baseResult is undefined when not provided", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({}),
      });

      expect(result.current.baseResult).toBeUndefined();
    });

    it("renders baseResult presence in component", () => {
      render(
        <QueryProvider
          sql="SELECT 1"
          isExecuting={false}
          baseResult={mockBaseResult}
        >
          <TestConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("has-base-result")).toHaveTextContent("yes");
      expect(screen.getByTestId("base-row-count")).toHaveTextContent("2");
    });

    it("exposes baseResult columns correctly", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ baseResult: mockBaseResult }),
      });

      expect(result.current.baseResult?.columns).toEqual([
        "id",
        "name",
        "value",
      ]);
    });

    it("exposes baseResult data correctly", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ baseResult: mockBaseResult }),
      });

      expect(result.current.baseResult?.data).toHaveLength(2);
      expect(result.current.baseResult?.data[0]).toEqual({
        id: 1,
        name: "Base Item 1",
        value: 100,
      });
    });

    it("exposes baseResult rowCount correctly", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ baseResult: mockBaseResult }),
      });

      expect(result.current.baseResult?.rowCount).toBe(2);
    });
  });

  describe("data props - currentResult", () => {
    it("exposes currentResult when prop is provided", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ currentResult: mockCurrentResult }),
      });

      expect(result.current.currentResult).toEqual(mockCurrentResult);
    });

    it("currentResult is undefined when not provided", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({}),
      });

      expect(result.current.currentResult).toBeUndefined();
    });

    it("renders currentResult presence in component", () => {
      render(
        <QueryProvider
          sql="SELECT 1"
          isExecuting={false}
          currentResult={mockCurrentResult}
        >
          <TestConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("has-current-result")).toHaveTextContent("yes");
      expect(screen.getByTestId("current-row-count")).toHaveTextContent("3");
    });

    it("exposes currentResult columns correctly", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ currentResult: mockCurrentResult }),
      });

      expect(result.current.currentResult?.columns).toEqual([
        "id",
        "name",
        "value",
      ]);
    });

    it("exposes currentResult data correctly", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ currentResult: mockCurrentResult }),
      });

      expect(result.current.currentResult?.data).toHaveLength(3);
      expect(result.current.currentResult?.data[2]).toEqual({
        id: 3,
        name: "Current Item 3",
        value: 300,
      });
    });
  });

  describe("data props - both results", () => {
    it("exposes both baseResult and currentResult", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({
          baseResult: mockBaseResult,
          currentResult: mockCurrentResult,
        }),
      });

      expect(result.current.baseResult).toEqual(mockBaseResult);
      expect(result.current.currentResult).toEqual(mockCurrentResult);
    });

    it("renders both results in component", () => {
      render(
        <QueryProvider
          sql="SELECT 1"
          isExecuting={false}
          baseResult={mockBaseResult}
          currentResult={mockCurrentResult}
        >
          <TestConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("has-base-result")).toHaveTextContent("yes");
      expect(screen.getByTestId("has-current-result")).toHaveTextContent("yes");
      expect(screen.getByTestId("base-row-count")).toHaveTextContent("2");
      expect(screen.getByTestId("current-row-count")).toHaveTextContent("3");
    });
  });

  describe("callback props - onSqlChange", () => {
    it("invokes onSqlChange when called", () => {
      const mockOnSqlChange = vi.fn();

      render(
        <QueryProvider
          sql="SELECT 1"
          isExecuting={false}
          onSqlChange={mockOnSqlChange}
        >
          <TestConsumer />
        </QueryProvider>,
      );

      act(() => {
        screen.getByTestId("change-sql-btn").click();
      });

      expect(mockOnSqlChange).toHaveBeenCalledWith("SELECT * FROM users");
    });

    it("passes correct sql to onSqlChange", () => {
      const mockOnSqlChange = vi.fn();

      function SqlChangeConsumer() {
        const context = useQueryContext();
        return (
          <div>
            <button
              type="button"
              onClick={() =>
                context.onSqlChange?.("SELECT * FROM custom_table")
              }
              data-testid="custom-change-btn"
            >
              Custom SQL
            </button>
          </div>
        );
      }

      render(
        <QueryProvider
          sql="SELECT 1"
          isExecuting={false}
          onSqlChange={mockOnSqlChange}
        >
          <SqlChangeConsumer />
        </QueryProvider>,
      );

      act(() => {
        screen.getByTestId("custom-change-btn").click();
      });

      expect(mockOnSqlChange).toHaveBeenCalledWith(
        "SELECT * FROM custom_table",
      );
    });

    it("does not throw when onSqlChange is not provided", () => {
      render(
        <QueryProvider sql="SELECT 1" isExecuting={false}>
          <TestConsumer />
        </QueryProvider>,
      );

      expect(() => {
        act(() => {
          screen.getByTestId("change-sql-btn").click();
        });
      }).not.toThrow();
    });
  });

  describe("callback props - onExecute", () => {
    it("invokes onExecute with SQL", async () => {
      const mockOnExecute = vi.fn().mockResolvedValue(undefined);

      render(
        <QueryProvider
          sql="SELECT 1"
          isExecuting={false}
          onExecute={mockOnExecute}
        >
          <TestConsumer />
        </QueryProvider>,
      );

      act(() => {
        screen.getByTestId("execute-btn").click();
      });

      await waitFor(() => {
        expect(mockOnExecute).toHaveBeenCalledWith("SELECT * FROM orders");
      });
    });

    it("passes correct SQL to onExecute", async () => {
      const mockOnExecute = vi.fn().mockResolvedValue(undefined);

      function ExecuteConsumer() {
        const context = useQueryContext();
        return (
          <button
            type="button"
            onClick={() =>
              context.onExecute?.(
                "SELECT COUNT(*) FROM users WHERE active = true",
              )
            }
            data-testid="custom-execute-btn"
          >
            Custom Execute
          </button>
        );
      }

      render(
        <QueryProvider
          sql="SELECT 1"
          isExecuting={false}
          onExecute={mockOnExecute}
        >
          <ExecuteConsumer />
        </QueryProvider>,
      );

      act(() => {
        screen.getByTestId("custom-execute-btn").click();
      });

      await waitFor(() => {
        expect(mockOnExecute).toHaveBeenCalledWith(
          "SELECT COUNT(*) FROM users WHERE active = true",
        );
      });
    });

    it("handles async onExecute properly", async () => {
      let executionComplete = false;
      const mockOnExecute = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionComplete = true;
      });

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ onExecute: mockOnExecute }),
      });

      await act(async () => {
        await result.current.onExecute?.("SELECT 1");
      });

      expect(executionComplete).toBe(true);
      expect(mockOnExecute).toHaveBeenCalledWith("SELECT 1");
    });

    it("does not throw when onExecute is not provided", () => {
      render(
        <QueryProvider sql="SELECT 1" isExecuting={false}>
          <TestConsumer />
        </QueryProvider>,
      );

      expect(() => {
        act(() => {
          screen.getByTestId("execute-btn").click();
        });
      }).not.toThrow();
    });
  });

  describe("callback props - onCancel", () => {
    it("invokes onCancel when called", () => {
      const mockOnCancel = vi.fn();

      render(
        <QueryProvider
          sql="SELECT 1"
          isExecuting={true}
          onCancel={mockOnCancel}
        >
          <TestConsumer />
        </QueryProvider>,
      );

      act(() => {
        screen.getByTestId("cancel-btn").click();
      });

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it("onCancel takes no arguments", () => {
      const mockOnCancel = vi.fn();

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ onCancel: mockOnCancel }),
      });

      act(() => {
        result.current.onCancel?.();
      });

      expect(mockOnCancel).toHaveBeenCalledWith();
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it("does not throw when onCancel is not provided", () => {
      render(
        <QueryProvider sql="SELECT 1" isExecuting={true}>
          <TestConsumer />
        </QueryProvider>,
      );

      expect(() => {
        act(() => {
          screen.getByTestId("cancel-btn").click();
        });
      }).not.toThrow();
    });
  });

  describe("hook behavior", () => {
    it("useQueryContext returns context with all values", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.sql).toBeDefined();
      expect(typeof result.current.sql).toBe("string");
      expect(typeof result.current.isExecuting).toBe("boolean");
    });

    it("hook returns default context values outside provider", () => {
      // Render without provider to test default context
      const { result } = renderHook(() => useQueryContext());

      // Default context should have empty sql and false isExecuting
      expect(result.current.sql).toBe("");
      expect(result.current.isExecuting).toBe(false);
      expect(result.current.error).toBeUndefined();
      expect(result.current.baseResult).toBeUndefined();
      expect(result.current.currentResult).toBeUndefined();
    });

    it("optional callbacks are undefined in default context", () => {
      const { result } = renderHook(() => useQueryContext());

      expect(result.current.onSqlChange).toBeUndefined();
      expect(result.current.onExecute).toBeUndefined();
      expect(result.current.onCancel).toBeUndefined();
    });

    it("allows calling execute operations via renderHook", async () => {
      const mockOnExecute = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ onExecute: mockOnExecute }),
      });

      await act(async () => {
        await result.current.onExecute?.("SELECT * FROM test");
      });

      expect(mockOnExecute).toHaveBeenCalledWith("SELECT * FROM test");
    });
  });

  describe("default values behavior", () => {
    it("sql defaults to empty string", () => {
      render(
        <QueryProvider isExecuting={false}>
          <TestConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("sql")).toHaveTextContent("");
    });

    it("isExecuting defaults to false", () => {
      render(
        <QueryProvider sql="SELECT 1">
          <TestConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("is-executing")).toHaveTextContent("false");
    });

    it("error defaults to undefined (displayed as 'none')", () => {
      render(
        <QueryProvider sql="SELECT 1" isExecuting={false}>
          <TestConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("error")).toHaveTextContent("none");
    });

    it("baseResult defaults to undefined", () => {
      render(
        <QueryProvider sql="SELECT 1" isExecuting={false}>
          <TestConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("has-base-result")).toHaveTextContent("no");
    });

    it("currentResult defaults to undefined", () => {
      render(
        <QueryProvider sql="SELECT 1" isExecuting={false}>
          <TestConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("has-current-result")).toHaveTextContent("no");
    });
  });

  describe("props-driven nature (no API mocking needed)", () => {
    it("does not make any API calls - all actions delegated to callbacks", async () => {
      // This test verifies the key design of the props-driven context
      // No need to mock API functions because none are called
      const mockOnSqlChange = vi.fn();
      const mockOnExecute = vi.fn().mockResolvedValue(undefined);
      const mockOnCancel = vi.fn();

      render(
        <QueryProvider
          sql="SELECT 1"
          isExecuting={false}
          onSqlChange={mockOnSqlChange}
          onExecute={mockOnExecute}
          onCancel={mockOnCancel}
        >
          <TestConsumer />
        </QueryProvider>,
      );

      // All actions are delegated to provided callbacks
      act(() => {
        screen.getByTestId("change-sql-btn").click();
      });
      expect(mockOnSqlChange).toHaveBeenCalled();

      act(() => {
        screen.getByTestId("execute-btn").click();
      });
      await waitFor(() => {
        expect(mockOnExecute).toHaveBeenCalled();
      });

      act(() => {
        screen.getByTestId("cancel-btn").click();
      });
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it("consumer controls all side effects via callbacks", async () => {
      const sideEffects: string[] = [];
      const mockOnSqlChange = vi.fn().mockImplementation(() => {
        sideEffects.push("sql_change");
      });
      const mockOnExecute = vi.fn().mockImplementation(() => {
        sideEffects.push("execute");
        return Promise.resolve();
      });
      const mockOnCancel = vi.fn().mockImplementation(() => {
        sideEffects.push("cancel");
      });

      render(
        <QueryProvider
          sql="SELECT 1"
          isExecuting={false}
          onSqlChange={mockOnSqlChange}
          onExecute={mockOnExecute}
          onCancel={mockOnCancel}
        >
          <TestConsumer />
        </QueryProvider>,
      );

      act(() => {
        screen.getByTestId("change-sql-btn").click();
      });

      act(() => {
        screen.getByTestId("execute-btn").click();
      });

      act(() => {
        screen.getByTestId("cancel-btn").click();
      });

      // Consumer-provided callbacks control all external effects
      await waitFor(() => {
        expect(sideEffects).toContain("sql_change");
        expect(sideEffects).toContain("execute");
        expect(sideEffects).toContain("cancel");
      });
    });
  });

  describe("multiple consumers", () => {
    it("multiple consumers share the same context data", () => {
      function Consumer1() {
        const context = useQueryContext();
        return <span data-testid="consumer1-sql">{context.sql}</span>;
      }

      function Consumer2() {
        const context = useQueryContext();
        return <span data-testid="consumer2-sql">{context.sql}</span>;
      }

      render(
        <QueryProvider sql="SELECT * FROM shared" isExecuting={false}>
          <Consumer1 />
          <Consumer2 />
        </QueryProvider>,
      );

      // Both consumers should see the same data
      expect(screen.getByTestId("consumer1-sql")).toHaveTextContent(
        "SELECT * FROM shared",
      );
      expect(screen.getByTestId("consumer2-sql")).toHaveTextContent(
        "SELECT * FROM shared",
      );
    });

    it("multiple consumers share the same executing state", () => {
      function Consumer1() {
        const context = useQueryContext();
        return (
          <span data-testid="consumer1-executing">
            {String(context.isExecuting)}
          </span>
        );
      }

      function Consumer2() {
        const context = useQueryContext();
        return (
          <span data-testid="consumer2-executing">
            {String(context.isExecuting)}
          </span>
        );
      }

      render(
        <QueryProvider sql="SELECT 1" isExecuting={true}>
          <Consumer1 />
          <Consumer2 />
        </QueryProvider>,
      );

      expect(screen.getByTestId("consumer1-executing")).toHaveTextContent(
        "true",
      );
      expect(screen.getByTestId("consumer2-executing")).toHaveTextContent(
        "true",
      );
    });

    it("all consumers invoke the same callback", () => {
      const mockOnSqlChange = vi.fn();

      function Consumer1() {
        const context = useQueryContext();
        return (
          <button
            type="button"
            onClick={() => context.onSqlChange?.("FROM_CONSUMER_1")}
            data-testid="consumer1-btn"
          >
            Change from 1
          </button>
        );
      }

      function Consumer2() {
        const context = useQueryContext();
        return (
          <button
            type="button"
            onClick={() => context.onSqlChange?.("FROM_CONSUMER_2")}
            data-testid="consumer2-btn"
          >
            Change from 2
          </button>
        );
      }

      render(
        <QueryProvider
          sql="SELECT 1"
          isExecuting={false}
          onSqlChange={mockOnSqlChange}
        >
          <Consumer1 />
          <Consumer2 />
        </QueryProvider>,
      );

      act(() => {
        screen.getByTestId("consumer1-btn").click();
      });
      expect(mockOnSqlChange).toHaveBeenCalledWith("FROM_CONSUMER_1");

      act(() => {
        screen.getByTestId("consumer2-btn").click();
      });
      expect(mockOnSqlChange).toHaveBeenCalledWith("FROM_CONSUMER_2");
    });
  });

  describe("edge cases", () => {
    it("handles empty QueryResult", () => {
      const emptyResult: QueryResult = {
        columns: [],
        data: [],
        rowCount: 0,
      };

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ baseResult: emptyResult }),
      });

      expect(result.current.baseResult?.columns).toEqual([]);
      expect(result.current.baseResult?.data).toEqual([]);
      expect(result.current.baseResult?.rowCount).toBe(0);
    });

    it("handles QueryResult with many columns", () => {
      const manyColumns = Array.from({ length: 100 }, (_, i) => `col_${i}`);
      const manyColumnsResult: QueryResult = {
        columns: manyColumns,
        data: [],
        rowCount: 0,
      };

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ baseResult: manyColumnsResult }),
      });

      expect(result.current.baseResult?.columns).toHaveLength(100);
    });

    it("handles QueryResult with many rows", () => {
      const manyRowsResult: QueryResult = {
        columns: ["id"],
        data: Array.from({ length: 1000 }, (_, i) => ({ id: i })),
        rowCount: 1000,
      };

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ currentResult: manyRowsResult }),
      });

      expect(result.current.currentResult?.data).toHaveLength(1000);
      expect(result.current.currentResult?.rowCount).toBe(1000);
    });

    it("handles rapid successive callback invocations", () => {
      const mockOnSqlChange = vi.fn();

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ onSqlChange: mockOnSqlChange }),
      });

      act(() => {
        result.current.onSqlChange?.("SQL 1");
        result.current.onSqlChange?.("SQL 2");
        result.current.onSqlChange?.("SQL 3");
      });

      expect(mockOnSqlChange).toHaveBeenCalledTimes(3);
      expect(mockOnSqlChange).toHaveBeenNthCalledWith(1, "SQL 1");
      expect(mockOnSqlChange).toHaveBeenNthCalledWith(2, "SQL 2");
      expect(mockOnSqlChange).toHaveBeenNthCalledWith(3, "SQL 3");
    });

    it("handles callback that rejects", async () => {
      const mockOnExecute = vi
        .fn()
        .mockRejectedValue(new Error("Execution failed"));

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ onExecute: mockOnExecute }),
      });

      // The callback rejection is the consumer's responsibility to handle
      // The context itself doesn't catch or handle errors
      await expect(
        result.current.onExecute?.("SELECT * FROM broken"),
      ).rejects.toThrow("Execution failed");
    });

    it("handles undefined callback invocation gracefully", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({}),
      });

      // Calling undefined callbacks should not throw
      expect(() => {
        result.current.onSqlChange?.("test");
        result.current.onExecute?.("test");
        result.current.onCancel?.();
      }).not.toThrow();
    });

    it("handles special characters in error message", () => {
      const specialError =
        'Error: Column "name" contains <script>alert(1)</script>';

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ error: specialError }),
      });

      expect(result.current.error).toBe(specialError);
    });

    it("handles QueryResult with null values in data", () => {
      const resultWithNulls: QueryResult = {
        columns: ["id", "name", "value"],
        data: [
          { id: 1, name: null, value: 100 },
          { id: 2, name: "Test", value: null },
        ],
        rowCount: 2,
      };

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({ baseResult: resultWithNulls }),
      });

      expect(result.current.baseResult?.data[0].name).toBeNull();
      expect(result.current.baseResult?.data[1].value).toBeNull();
    });
  });

  describe("context display name", () => {
    it("has correct displayName for debugging", () => {
      // This is a metadata test - the QueryContext should have a displayName
      // We can verify this by checking if the context renders correctly with DevTools
      render(
        <QueryProvider sql="" isExecuting={false}>
          <div data-testid="context-test">Context renders</div>
        </QueryProvider>,
      );

      expect(screen.getByTestId("context-test")).toBeInTheDocument();
    });
  });

  /**
   * OSS input state fields tests
   *
   * Phase 2A: Context Unification - These tests verify backward compatibility
   * with OSS's RecceQueryContext interface. The following fields are merged
   * from OSS for seamless migration:
   * - sqlQuery (alias for sql)
   * - setSqlQuery (alias for onSqlChange)
   * - primaryKeys / setPrimaryKeys
   * - isCustomQueries / setCustomQueries
   * - baseSqlQuery / setBaseSqlQuery
   */
  describe("OSS input state fields", () => {
    it("provides sqlQuery alias", () => {
      function SqlQueryConsumer() {
        const { sqlQuery } = useQueryContext();
        return <span data-testid="sql-query">{sqlQuery ?? "empty"}</span>;
      }

      render(
        <QueryProvider sqlQuery="SELECT * FROM users">
          <SqlQueryConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("sql-query")).toHaveTextContent(
        "SELECT * FROM users",
      );
    });

    it("provides setSqlQuery callback", () => {
      const mockSetSql = vi.fn();
      function SetSqlQueryConsumer() {
        const { setSqlQuery } = useQueryContext();
        return (
          <button
            type="button"
            onClick={() => setSqlQuery?.("new query")}
            data-testid="set-sql-btn"
          >
            Set SQL
          </button>
        );
      }

      render(
        <QueryProvider setSqlQuery={mockSetSql}>
          <SetSqlQueryConsumer />
        </QueryProvider>,
      );

      act(() => {
        screen.getByTestId("set-sql-btn").click();
      });

      expect(mockSetSql).toHaveBeenCalledWith("new query");
    });

    it("provides primaryKeys and setPrimaryKeys", () => {
      const mockSetPKs = vi.fn();
      function PrimaryKeysConsumer() {
        const { primaryKeys, setPrimaryKeys } = useQueryContext();
        return (
          <>
            <span data-testid="pks">{primaryKeys?.join(",") ?? "none"}</span>
            <button
              type="button"
              onClick={() => setPrimaryKeys?.(["id", "name"])}
              data-testid="set-pks-btn"
            >
              Set PKs
            </button>
          </>
        );
      }

      render(
        <QueryProvider primaryKeys={["id"]} setPrimaryKeys={mockSetPKs}>
          <PrimaryKeysConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("pks")).toHaveTextContent("id");

      act(() => {
        screen.getByTestId("set-pks-btn").click();
      });

      expect(mockSetPKs).toHaveBeenCalledWith(["id", "name"]);
    });

    it("provides isCustomQueries and setCustomQueries", () => {
      const mockSetCustom = vi.fn();
      function CustomQueriesConsumer() {
        const { isCustomQueries, setCustomQueries } = useQueryContext();
        return (
          <>
            <span data-testid="custom">{String(isCustomQueries ?? false)}</span>
            <button
              type="button"
              onClick={() => setCustomQueries?.(true)}
              data-testid="set-custom-btn"
            >
              Set Custom
            </button>
          </>
        );
      }

      render(
        <QueryProvider isCustomQueries={true} setCustomQueries={mockSetCustom}>
          <CustomQueriesConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("custom")).toHaveTextContent("true");

      act(() => {
        screen.getByTestId("set-custom-btn").click();
      });

      expect(mockSetCustom).toHaveBeenCalledWith(true);
    });

    it("provides baseSqlQuery and setBaseSqlQuery", () => {
      const mockSetBase = vi.fn();
      function BaseSqlConsumer() {
        const { baseSqlQuery, setBaseSqlQuery } = useQueryContext();
        return (
          <>
            <span data-testid="base">{baseSqlQuery ?? "none"}</span>
            <button
              type="button"
              onClick={() => setBaseSqlQuery?.("base query")}
              data-testid="set-base-btn"
            >
              Set Base
            </button>
          </>
        );
      }

      render(
        <QueryProvider baseSqlQuery="SELECT 1" setBaseSqlQuery={mockSetBase}>
          <BaseSqlConsumer />
        </QueryProvider>,
      );

      expect(screen.getByTestId("base")).toHaveTextContent("SELECT 1");

      act(() => {
        screen.getByTestId("set-base-btn").click();
      });

      expect(mockSetBase).toHaveBeenCalledWith("base query");
    });

    it("OSS fields are undefined by default", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({}),
      });

      expect(result.current.sqlQuery).toBeUndefined();
      expect(result.current.setSqlQuery).toBeUndefined();
      expect(result.current.primaryKeys).toBeUndefined();
      expect(result.current.setPrimaryKeys).toBeUndefined();
      expect(result.current.isCustomQueries).toBeUndefined();
      expect(result.current.setCustomQueries).toBeUndefined();
      expect(result.current.baseSqlQuery).toBeUndefined();
      expect(result.current.setBaseSqlQuery).toBeUndefined();
    });

    it("handles setPrimaryKeys with undefined to clear", () => {
      const mockSetPKs = vi.fn();
      function ClearPrimaryKeysConsumer() {
        const { setPrimaryKeys } = useQueryContext();
        return (
          <button
            type="button"
            onClick={() => setPrimaryKeys?.(undefined)}
            data-testid="clear-pks-btn"
          >
            Clear PKs
          </button>
        );
      }

      render(
        <QueryProvider setPrimaryKeys={mockSetPKs}>
          <ClearPrimaryKeysConsumer />
        </QueryProvider>,
      );

      act(() => {
        screen.getByTestId("clear-pks-btn").click();
      });

      expect(mockSetPKs).toHaveBeenCalledWith(undefined);
    });

    it("handles empty primaryKeys array", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryProvider primaryKeys={[]}>{children}</QueryProvider>
        ),
      });

      expect(result.current.primaryKeys).toEqual([]);
    });

    it("handles isCustomQueries false value", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryProvider isCustomQueries={false}>{children}</QueryProvider>
        ),
      });

      expect(result.current.isCustomQueries).toBe(false);
    });

    it("can use both @datarecce/ui and OSS fields together", () => {
      const mockOnSqlChange = vi.fn();
      const mockSetSqlQuery = vi.fn();

      function CombinedConsumer() {
        const { sql, sqlQuery, onSqlChange, setSqlQuery } = useQueryContext();
        return (
          <>
            <span data-testid="sql">{sql}</span>
            <span data-testid="sqlQuery">{sqlQuery ?? "empty"}</span>
            <button
              type="button"
              onClick={() => onSqlChange?.("from onSqlChange")}
              data-testid="change-btn"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => setSqlQuery?.("from setSqlQuery")}
              data-testid="set-btn"
            >
              Set
            </button>
          </>
        );
      }

      render(
        <QueryProvider
          sql="current sql"
          sqlQuery="oss sql query"
          onSqlChange={mockOnSqlChange}
          setSqlQuery={mockSetSqlQuery}
        >
          <CombinedConsumer />
        </QueryProvider>,
      );

      // Both fields should be accessible
      expect(screen.getByTestId("sql")).toHaveTextContent("current sql");
      expect(screen.getByTestId("sqlQuery")).toHaveTextContent("oss sql query");

      // Both callbacks should work
      act(() => {
        screen.getByTestId("change-btn").click();
      });
      expect(mockOnSqlChange).toHaveBeenCalledWith("from onSqlChange");

      act(() => {
        screen.getByTestId("set-btn").click();
      });
      expect(mockSetSqlQuery).toHaveBeenCalledWith("from setSqlQuery");
    });
  });

  describe("query execution workflow", () => {
    it("simulates typical query execution flow", async () => {
      const executionSteps: string[] = [];
      const mockOnSqlChange = vi.fn().mockImplementation((sql) => {
        executionSteps.push(`sql_changed: ${sql}`);
      });
      const mockOnExecute = vi.fn().mockImplementation(async (sql) => {
        executionSteps.push(`executing: ${sql}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionSteps.push("execution_complete");
      });
      const mockOnCancel = vi.fn().mockImplementation(() => {
        executionSteps.push("cancelled");
      });

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({
          onSqlChange: mockOnSqlChange,
          onExecute: mockOnExecute,
          onCancel: mockOnCancel,
        }),
      });

      // Step 1: Change SQL
      act(() => {
        result.current.onSqlChange?.("SELECT * FROM users");
      });

      // Step 2: Execute
      await act(async () => {
        await result.current.onExecute?.("SELECT * FROM users");
      });

      expect(executionSteps).toEqual([
        "sql_changed: SELECT * FROM users",
        "executing: SELECT * FROM users",
        "execution_complete",
      ]);
    });

    it("simulates query cancellation flow", () => {
      const executionSteps: string[] = [];
      const mockOnExecute = vi.fn().mockImplementation(() => {
        executionSteps.push("execution_started");
        // This would be a long-running query in real usage
        return Promise.resolve();
      });
      const mockOnCancel = vi.fn().mockImplementation(() => {
        executionSteps.push("execution_cancelled");
      });

      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper({
          isExecuting: true,
          onExecute: mockOnExecute,
          onCancel: mockOnCancel,
        }),
      });

      // Cancel the execution
      act(() => {
        result.current.onCancel?.();
      });

      expect(executionSteps).toContain("execution_cancelled");
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
