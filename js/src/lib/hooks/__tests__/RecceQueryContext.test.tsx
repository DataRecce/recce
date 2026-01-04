/**
 * @file RecceQueryContext.test.tsx
 * @description Tests for RecceQueryContext provider and hooks (OSS version)
 *
 * Phase 2A: Context Unification - Establishing behavioral contracts
 * These tests verify the behavior of RecceQueryContextProvider, useRecceQueryContext,
 * RowCountStateContextProvider, and useRowCountStateContext to ensure nothing breaks
 * during migration.
 *
 * KEY CHARACTERISTICS of OSS RecceQueryContext:
 * - Manages query INPUT state (different from @datarecce/ui's QueryContext which tracks EXECUTION state)
 * - `sqlQuery: string` - current SQL query text (initialized to defaultSqlQuery)
 * - `setSqlQuery: (sqlQuery: string) => void` - update SQL query
 * - `baseSqlQuery: string` - base SQL for comparison (initialized to defaultSqlQuery)
 * - `setBaseSqlQuery: (baseSqlQuery: string) => void` - update base SQL
 * - `primaryKeys: string[] | undefined` - selected primary keys (initialized to undefined)
 * - `setPrimaryKeys: (primaryKeys: string[] | undefined) => void` - update primary keys
 * - `isCustomQueries: boolean` - whether using custom queries (initialized to false)
 * - `setCustomQueries: (isCustomQueries: boolean) => void` - update custom queries flag
 *
 * Also includes RowCountStateContext for node fetching state:
 * - `isNodesFetching: string[]` - array of node IDs currently fetching
 * - `setIsNodesFetching: (nodes: string[]) => void` - update fetching nodes
 */

import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  defaultSqlQuery,
  RecceQueryContextProvider,
  RowCountStateContextProvider,
  useRecceQueryContext,
  useRowCountStateContext,
} from "../RecceQueryContext";

/**
 * Test consumer component that displays query context values
 */
function QueryTestConsumer() {
  const {
    sqlQuery,
    setSqlQuery,
    baseSqlQuery,
    setBaseSqlQuery,
    primaryKeys,
    setPrimaryKeys,
    isCustomQueries,
    setCustomQueries,
  } = useRecceQueryContext();

  return (
    <div>
      <span data-testid="sql-query">{sqlQuery}</span>
      <span data-testid="base-sql-query">{baseSqlQuery}</span>
      <span data-testid="primary-keys">{JSON.stringify(primaryKeys)}</span>
      <span data-testid="is-custom-queries">{String(isCustomQueries)}</span>
      <button
        type="button"
        onClick={() => setSqlQuery("SELECT * FROM users")}
        data-testid="set-sql"
      >
        Set SQL
      </button>
      <button
        type="button"
        onClick={() => setBaseSqlQuery?.("SELECT * FROM base_users")}
        data-testid="set-base-sql"
      >
        Set Base SQL
      </button>
      <button
        type="button"
        onClick={() => setPrimaryKeys(["id", "name"])}
        data-testid="set-primary-keys"
      >
        Set Primary Keys
      </button>
      <button
        type="button"
        onClick={() => setPrimaryKeys(undefined)}
        data-testid="clear-primary-keys"
      >
        Clear Primary Keys
      </button>
      <button
        type="button"
        onClick={() => setCustomQueries(true)}
        data-testid="enable-custom-queries"
      >
        Enable Custom Queries
      </button>
      <button
        type="button"
        onClick={() => setCustomQueries(false)}
        data-testid="disable-custom-queries"
      >
        Disable Custom Queries
      </button>
    </div>
  );
}

/**
 * Test consumer component that displays row count state context values
 */
function RowCountTestConsumer() {
  const { isNodesFetching, setIsNodesFetching } = useRowCountStateContext();

  return (
    <div>
      <span data-testid="fetching-nodes">
        {JSON.stringify(isNodesFetching)}
      </span>
      <button
        type="button"
        onClick={() => setIsNodesFetching(["node-1", "node-2"])}
        data-testid="set-fetching-nodes"
      >
        Set Fetching Nodes
      </button>
      <button
        type="button"
        onClick={() => setIsNodesFetching([])}
        data-testid="clear-fetching-nodes"
      >
        Clear Fetching Nodes
      </button>
    </div>
  );
}

/**
 * Create wrapper with RecceQueryContextProvider
 */
function createQueryWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <RecceQueryContextProvider>{children}</RecceQueryContextProvider>;
  };
}

/**
 * Create wrapper with RowCountStateContextProvider
 */
function createRowCountWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RowCountStateContextProvider>{children}</RowCountStateContextProvider>
    );
  };
}

describe("RecceQueryContext (OSS)", () => {
  describe("provider basics", () => {
    it("renders children", () => {
      render(
        <RecceQueryContextProvider>
          <div data-testid="child">Child Content</div>
        </RecceQueryContextProvider>,
      );

      expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
    });

    it("provides context value accessible via hook", () => {
      render(
        <RecceQueryContextProvider>
          <QueryTestConsumer />
        </RecceQueryContextProvider>,
      );

      // Context is accessible and provides default values
      expect(screen.getByTestId("sql-query")).toBeInTheDocument();
      expect(screen.getByTestId("base-sql-query")).toBeInTheDocument();
      expect(screen.getByTestId("primary-keys")).toBeInTheDocument();
      expect(screen.getByTestId("is-custom-queries")).toBeInTheDocument();
    });
  });

  describe("defaultSqlQuery export", () => {
    it("exports default SQL query constant", () => {
      expect(defaultSqlQuery).toBe('select * from {{ ref("mymodel") }}');
    });
  });

  describe("sqlQuery state", () => {
    it("has defaultSqlQuery as initial sqlQuery", () => {
      render(
        <RecceQueryContextProvider>
          <QueryTestConsumer />
        </RecceQueryContextProvider>,
      );

      expect(screen.getByTestId("sql-query")).toHaveTextContent(
        defaultSqlQuery,
      );
    });

    it("returns defaultSqlQuery from hook on initial render", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.sqlQuery).toBe(defaultSqlQuery);
    });

    it("updates sqlQuery when setSqlQuery called", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setSqlQuery("SELECT * FROM users");
      });

      expect(result.current.sqlQuery).toBe("SELECT * FROM users");
    });

    it("updates sqlQuery via click interaction", () => {
      render(
        <RecceQueryContextProvider>
          <QueryTestConsumer />
        </RecceQueryContextProvider>,
      );

      act(() => {
        screen.getByTestId("set-sql").click();
      });

      expect(screen.getByTestId("sql-query")).toHaveTextContent(
        "SELECT * FROM users",
      );
    });

    it("handles multiple sqlQuery updates correctly", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setSqlQuery("SELECT 1");
      });
      expect(result.current.sqlQuery).toBe("SELECT 1");

      act(() => {
        result.current.setSqlQuery("SELECT 2");
      });
      expect(result.current.sqlQuery).toBe("SELECT 2");

      act(() => {
        result.current.setSqlQuery("SELECT 3");
      });
      expect(result.current.sqlQuery).toBe("SELECT 3");
    });

    it("handles empty string SQL query", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setSqlQuery("");
      });

      expect(result.current.sqlQuery).toBe("");
    });

    it("handles complex SQL queries", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      const complexQuery = `
        SELECT
          u.id,
          u.name,
          COUNT(o.id) as order_count
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        WHERE u.created_at > '2024-01-01'
        GROUP BY u.id, u.name
        HAVING COUNT(o.id) > 5
        ORDER BY order_count DESC
        LIMIT 100
      `;

      act(() => {
        result.current.setSqlQuery(complexQuery);
      });

      expect(result.current.sqlQuery).toBe(complexQuery);
    });
  });

  describe("baseSqlQuery state", () => {
    it("has defaultSqlQuery as initial baseSqlQuery", () => {
      render(
        <RecceQueryContextProvider>
          <QueryTestConsumer />
        </RecceQueryContextProvider>,
      );

      expect(screen.getByTestId("base-sql-query")).toHaveTextContent(
        defaultSqlQuery,
      );
    });

    it("returns defaultSqlQuery from hook on initial render", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.baseSqlQuery).toBe(defaultSqlQuery);
    });

    it("updates baseSqlQuery when setBaseSqlQuery called", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setBaseSqlQuery?.("SELECT * FROM base_table");
      });

      expect(result.current.baseSqlQuery).toBe("SELECT * FROM base_table");
    });

    it("updates baseSqlQuery via click interaction", () => {
      render(
        <RecceQueryContextProvider>
          <QueryTestConsumer />
        </RecceQueryContextProvider>,
      );

      act(() => {
        screen.getByTestId("set-base-sql").click();
      });

      expect(screen.getByTestId("base-sql-query")).toHaveTextContent(
        "SELECT * FROM base_users",
      );
    });

    it("sqlQuery and baseSqlQuery can be set independently", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setSqlQuery("SELECT * FROM current");
      });

      act(() => {
        result.current.setBaseSqlQuery?.("SELECT * FROM base");
      });

      expect(result.current.sqlQuery).toBe("SELECT * FROM current");
      expect(result.current.baseSqlQuery).toBe("SELECT * FROM base");
    });
  });

  describe("primaryKeys state", () => {
    it("has undefined as initial primaryKeys", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.primaryKeys).toBeUndefined();
    });

    it("renders undefined primaryKeys correctly in UI", () => {
      render(
        <RecceQueryContextProvider>
          <QueryTestConsumer />
        </RecceQueryContextProvider>,
      );

      expect(screen.getByTestId("primary-keys")).toHaveTextContent("");
    });

    it("updates primaryKeys when setPrimaryKeys called", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setPrimaryKeys(["id", "user_id"]);
      });

      expect(result.current.primaryKeys).toEqual(["id", "user_id"]);
    });

    it("updates primaryKeys via click interaction", () => {
      render(
        <RecceQueryContextProvider>
          <QueryTestConsumer />
        </RecceQueryContextProvider>,
      );

      act(() => {
        screen.getByTestId("set-primary-keys").click();
      });

      expect(screen.getByTestId("primary-keys")).toHaveTextContent(
        '["id","name"]',
      );
    });

    it("clears primaryKeys when set to undefined", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      // First set some keys
      act(() => {
        result.current.setPrimaryKeys(["id", "name"]);
      });
      expect(result.current.primaryKeys).toEqual(["id", "name"]);

      // Then clear them
      act(() => {
        result.current.setPrimaryKeys(undefined);
      });
      expect(result.current.primaryKeys).toBeUndefined();
    });

    it("clears primaryKeys via click interaction", () => {
      render(
        <RecceQueryContextProvider>
          <QueryTestConsumer />
        </RecceQueryContextProvider>,
      );

      // First set some keys
      act(() => {
        screen.getByTestId("set-primary-keys").click();
      });
      expect(screen.getByTestId("primary-keys")).toHaveTextContent(
        '["id","name"]',
      );

      // Then clear them
      act(() => {
        screen.getByTestId("clear-primary-keys").click();
      });
      expect(screen.getByTestId("primary-keys")).toHaveTextContent("");
    });

    it("handles empty array for primaryKeys", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setPrimaryKeys([]);
      });

      expect(result.current.primaryKeys).toEqual([]);
    });

    it("handles single primary key", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setPrimaryKeys(["id"]);
      });

      expect(result.current.primaryKeys).toEqual(["id"]);
    });

    it("handles multiple primary keys", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setPrimaryKeys(["id", "tenant_id", "version"]);
      });

      expect(result.current.primaryKeys).toEqual([
        "id",
        "tenant_id",
        "version",
      ]);
    });
  });

  describe("isCustomQueries state", () => {
    it("has false as initial isCustomQueries", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.isCustomQueries).toBe(false);
    });

    it("renders false for initial isCustomQueries in UI", () => {
      render(
        <RecceQueryContextProvider>
          <QueryTestConsumer />
        </RecceQueryContextProvider>,
      );

      expect(screen.getByTestId("is-custom-queries")).toHaveTextContent(
        "false",
      );
    });

    it("updates isCustomQueries when setCustomQueries called with true", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setCustomQueries(true);
      });

      expect(result.current.isCustomQueries).toBe(true);
    });

    it("updates isCustomQueries when setCustomQueries called with false", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      // First set to true
      act(() => {
        result.current.setCustomQueries(true);
      });
      expect(result.current.isCustomQueries).toBe(true);

      // Then set to false
      act(() => {
        result.current.setCustomQueries(false);
      });
      expect(result.current.isCustomQueries).toBe(false);
    });

    it("updates isCustomQueries via click interaction", () => {
      render(
        <RecceQueryContextProvider>
          <QueryTestConsumer />
        </RecceQueryContextProvider>,
      );

      act(() => {
        screen.getByTestId("enable-custom-queries").click();
      });
      expect(screen.getByTestId("is-custom-queries")).toHaveTextContent("true");

      act(() => {
        screen.getByTestId("disable-custom-queries").click();
      });
      expect(screen.getByTestId("is-custom-queries")).toHaveTextContent(
        "false",
      );
    });

    it("toggles correctly multiple times", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setCustomQueries(true);
      });
      expect(result.current.isCustomQueries).toBe(true);

      act(() => {
        result.current.setCustomQueries(false);
      });
      expect(result.current.isCustomQueries).toBe(false);

      act(() => {
        result.current.setCustomQueries(true);
      });
      expect(result.current.isCustomQueries).toBe(true);
    });
  });

  describe("hook behavior", () => {
    it("useRecceQueryContext returns context with all expected values", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.sqlQuery).toBeDefined();
      expect(result.current.setSqlQuery).toBeDefined();
      expect(result.current.baseSqlQuery).toBeDefined();
      expect(result.current.setBaseSqlQuery).toBeDefined();
      // primaryKeys is undefined initially, which is a valid value
      expect("primaryKeys" in result.current).toBe(true);
      expect(result.current.setPrimaryKeys).toBeDefined();
      expect(result.current.isCustomQueries).toBeDefined();
      expect(result.current.setCustomQueries).toBeDefined();

      expect(typeof result.current.setSqlQuery).toBe("function");
      expect(typeof result.current.setBaseSqlQuery).toBe("function");
      expect(typeof result.current.setPrimaryKeys).toBe("function");
      expect(typeof result.current.setCustomQueries).toBe("function");
    });

    it("hook returns default context values outside provider", () => {
      // Render without provider to test default context
      const { result } = renderHook(() => useRecceQueryContext());

      // Default context values from createContext
      expect(result.current.sqlQuery).toBe(defaultSqlQuery);
      expect(result.current.baseSqlQuery).toBe(defaultSqlQuery);
      expect(result.current.primaryKeys).toBeUndefined();
      expect(result.current.isCustomQueries).toBe(false);
      expect(typeof result.current.setSqlQuery).toBe("function");
      expect(typeof result.current.setBaseSqlQuery).toBe("function");
      expect(typeof result.current.setPrimaryKeys).toBe("function");
      expect(typeof result.current.setCustomQueries).toBe("function");
    });

    it("default setSqlQuery is a no-op outside provider", () => {
      const { result } = renderHook(() => useRecceQueryContext());

      // Should not throw when called outside provider
      expect(() => {
        result.current.setSqlQuery("test query");
      }).not.toThrow();

      // Value should not change (no-op)
      expect(result.current.sqlQuery).toBe(defaultSqlQuery);
    });

    it("default setPrimaryKeys is a no-op outside provider", () => {
      const { result } = renderHook(() => useRecceQueryContext());

      // Should not throw when called outside provider
      expect(() => {
        result.current.setPrimaryKeys(["id"]);
      }).not.toThrow();

      // Value should not change (no-op)
      expect(result.current.primaryKeys).toBeUndefined();
    });

    it("default setCustomQueries is a no-op outside provider", () => {
      const { result } = renderHook(() => useRecceQueryContext());

      // Should not throw when called outside provider
      expect(() => {
        result.current.setCustomQueries(true);
      }).not.toThrow();

      // Value should not change (no-op)
      expect(result.current.isCustomQueries).toBe(false);
    });

    it("default setBaseSqlQuery is a no-op outside provider", () => {
      const { result } = renderHook(() => useRecceQueryContext());

      // Should not throw when called outside provider
      expect(() => {
        result.current.setBaseSqlQuery?.("test base query");
      }).not.toThrow();

      // Value should not change (no-op)
      expect(result.current.baseSqlQuery).toBe(defaultSqlQuery);
    });
  });

  describe("state persistence", () => {
    it("sqlQuery persists across re-renders", () => {
      const { result, rerender } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setSqlQuery("SELECT * FROM persistent_table");
      });

      // Trigger re-render
      rerender();

      expect(result.current.sqlQuery).toBe("SELECT * FROM persistent_table");
    });

    it("all state values persist across re-renders", () => {
      const { result, rerender } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setSqlQuery("SELECT * FROM current");
        result.current.setBaseSqlQuery?.("SELECT * FROM base");
        result.current.setPrimaryKeys(["pk1", "pk2"]);
        result.current.setCustomQueries(true);
      });

      // Trigger re-render
      rerender();

      expect(result.current.sqlQuery).toBe("SELECT * FROM current");
      expect(result.current.baseSqlQuery).toBe("SELECT * FROM base");
      expect(result.current.primaryKeys).toEqual(["pk1", "pk2"]);
      expect(result.current.isCustomQueries).toBe(true);
    });

    it("multiple consumers share same state", () => {
      function Consumer1() {
        const { sqlQuery, primaryKeys } = useRecceQueryContext();
        return (
          <div>
            <span data-testid="consumer-1-sql">{sqlQuery}</span>
            <span data-testid="consumer-1-keys">
              {JSON.stringify(primaryKeys)}
            </span>
          </div>
        );
      }

      function Consumer2() {
        const { sqlQuery, setSqlQuery, setPrimaryKeys } =
          useRecceQueryContext();
        return (
          <div>
            <span data-testid="consumer-2-sql">{sqlQuery}</span>
            <button
              type="button"
              onClick={() => setSqlQuery("SHARED QUERY")}
              data-testid="set-shared-sql"
            >
              Set SQL
            </button>
            <button
              type="button"
              onClick={() => setPrimaryKeys(["shared_key"])}
              data-testid="set-shared-keys"
            >
              Set Keys
            </button>
          </div>
        );
      }

      render(
        <RecceQueryContextProvider>
          <Consumer1 />
          <Consumer2 />
        </RecceQueryContextProvider>,
      );

      // Both consumers start with default values
      expect(screen.getByTestId("consumer-1-sql")).toHaveTextContent(
        defaultSqlQuery,
      );
      expect(screen.getByTestId("consumer-2-sql")).toHaveTextContent(
        defaultSqlQuery,
      );

      // Update from Consumer2
      act(() => {
        screen.getByTestId("set-shared-sql").click();
      });

      // Both consumers should see the update
      expect(screen.getByTestId("consumer-1-sql")).toHaveTextContent(
        "SHARED QUERY",
      );
      expect(screen.getByTestId("consumer-2-sql")).toHaveTextContent(
        "SHARED QUERY",
      );

      // Update primary keys from Consumer2
      act(() => {
        screen.getByTestId("set-shared-keys").click();
      });

      // Consumer1 should see the update
      expect(screen.getByTestId("consumer-1-keys")).toHaveTextContent(
        '["shared_key"]',
      );
    });
  });

  describe("context interface", () => {
    it("exports QueryContext interface with expected shape", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      const contextKeys = Object.keys(result.current);
      expect(contextKeys).toContain("sqlQuery");
      expect(contextKeys).toContain("setSqlQuery");
      expect(contextKeys).toContain("baseSqlQuery");
      expect(contextKeys).toContain("setBaseSqlQuery");
      expect(contextKeys).toContain("primaryKeys");
      expect(contextKeys).toContain("setPrimaryKeys");
      expect(contextKeys).toContain("isCustomQueries");
      expect(contextKeys).toContain("setCustomQueries");
      expect(contextKeys.length).toBe(8);
    });
  });

  describe("edge cases", () => {
    it("handles special characters in SQL query", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      const specialQuery =
        "SELECT * FROM users WHERE name LIKE '%O''Brien%' AND status = 'active'";

      act(() => {
        result.current.setSqlQuery(specialQuery);
      });

      expect(result.current.sqlQuery).toBe(specialQuery);
    });

    it("handles very long SQL query", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      const longQuery =
        "SELECT " + "col, ".repeat(1000) + "id FROM large_table";

      act(() => {
        result.current.setSqlQuery(longQuery);
      });

      expect(result.current.sqlQuery).toBe(longQuery);
    });

    it("handles setting same SQL query twice", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      act(() => {
        result.current.setSqlQuery("SELECT * FROM same");
      });
      expect(result.current.sqlQuery).toBe("SELECT * FROM same");

      act(() => {
        result.current.setSqlQuery("SELECT * FROM same");
      });
      expect(result.current.sqlQuery).toBe("SELECT * FROM same");
    });

    it("handles special characters in primary key names", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      const specialKeys = ["user-id", "order_number", "Column With Spaces"];

      act(() => {
        result.current.setPrimaryKeys(specialKeys);
      });

      expect(result.current.primaryKeys).toEqual(specialKeys);
    });

    it("handles unicode in SQL query", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      const unicodeQuery = "SELECT * FROM users WHERE name = '日本語'";

      act(() => {
        result.current.setSqlQuery(unicodeQuery);
      });

      expect(result.current.sqlQuery).toBe(unicodeQuery);
    });

    it("handles multiline SQL query", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: createQueryWrapper(),
      });

      const multilineQuery = `SELECT
        id,
        name,
        email
      FROM
        users
      WHERE
        active = true`;

      act(() => {
        result.current.setSqlQuery(multilineQuery);
      });

      expect(result.current.sqlQuery).toBe(multilineQuery);
    });
  });
});

describe("RowCountStateContext (OSS)", () => {
  describe("provider basics", () => {
    it("renders children", () => {
      render(
        <RowCountStateContextProvider>
          <div data-testid="child">Child Content</div>
        </RowCountStateContextProvider>,
      );

      expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
    });

    it("provides context value accessible via hook", () => {
      render(
        <RowCountStateContextProvider>
          <RowCountTestConsumer />
        </RowCountStateContextProvider>,
      );

      expect(screen.getByTestId("fetching-nodes")).toBeInTheDocument();
    });
  });

  describe("isNodesFetching state", () => {
    it("has empty array as initial isNodesFetching", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      expect(result.current.isNodesFetching).toEqual([]);
    });

    it("renders empty array for initial isNodesFetching in UI", () => {
      render(
        <RowCountStateContextProvider>
          <RowCountTestConsumer />
        </RowCountStateContextProvider>,
      );

      expect(screen.getByTestId("fetching-nodes")).toHaveTextContent("[]");
    });

    it("updates isNodesFetching when setIsNodesFetching called", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      act(() => {
        result.current.setIsNodesFetching(["node-1", "node-2", "node-3"]);
      });

      expect(result.current.isNodesFetching).toEqual([
        "node-1",
        "node-2",
        "node-3",
      ]);
    });

    it("updates isNodesFetching via click interaction", () => {
      render(
        <RowCountStateContextProvider>
          <RowCountTestConsumer />
        </RowCountStateContextProvider>,
      );

      act(() => {
        screen.getByTestId("set-fetching-nodes").click();
      });

      expect(screen.getByTestId("fetching-nodes")).toHaveTextContent(
        '["node-1","node-2"]',
      );
    });

    it("clears isNodesFetching when set to empty array", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      // First set some nodes
      act(() => {
        result.current.setIsNodesFetching(["node-1", "node-2"]);
      });
      expect(result.current.isNodesFetching).toEqual(["node-1", "node-2"]);

      // Then clear them
      act(() => {
        result.current.setIsNodesFetching([]);
      });
      expect(result.current.isNodesFetching).toEqual([]);
    });

    it("clears isNodesFetching via click interaction", () => {
      render(
        <RowCountStateContextProvider>
          <RowCountTestConsumer />
        </RowCountStateContextProvider>,
      );

      // First set some nodes
      act(() => {
        screen.getByTestId("set-fetching-nodes").click();
      });
      expect(screen.getByTestId("fetching-nodes")).toHaveTextContent(
        '["node-1","node-2"]',
      );

      // Then clear them
      act(() => {
        screen.getByTestId("clear-fetching-nodes").click();
      });
      expect(screen.getByTestId("fetching-nodes")).toHaveTextContent("[]");
    });

    it("handles single node in array", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      act(() => {
        result.current.setIsNodesFetching(["single-node"]);
      });

      expect(result.current.isNodesFetching).toEqual(["single-node"]);
    });

    it("handles many nodes in array", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      const manyNodes = Array.from({ length: 100 }, (_, i) => `node-${i}`);

      act(() => {
        result.current.setIsNodesFetching(manyNodes);
      });

      expect(result.current.isNodesFetching).toEqual(manyNodes);
      expect(result.current.isNodesFetching.length).toBe(100);
    });
  });

  describe("hook behavior", () => {
    it("useRowCountStateContext returns context with all expected values", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      expect(result.current.isNodesFetching).toBeDefined();
      expect(result.current.setIsNodesFetching).toBeDefined();
      expect(typeof result.current.setIsNodesFetching).toBe("function");
    });

    it("hook returns default context values outside provider", () => {
      const { result } = renderHook(() => useRowCountStateContext());

      expect(result.current.isNodesFetching).toEqual([]);
      expect(typeof result.current.setIsNodesFetching).toBe("function");
    });

    it("default setIsNodesFetching is a no-op outside provider", () => {
      const { result } = renderHook(() => useRowCountStateContext());

      // Should not throw when called outside provider
      expect(() => {
        result.current.setIsNodesFetching(["test-node"]);
      }).not.toThrow();

      // Value should not change (no-op)
      expect(result.current.isNodesFetching).toEqual([]);
    });
  });

  describe("state persistence", () => {
    it("isNodesFetching persists across re-renders", () => {
      const { result, rerender } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      act(() => {
        result.current.setIsNodesFetching(["persistent-node"]);
      });

      // Trigger re-render
      rerender();

      expect(result.current.isNodesFetching).toEqual(["persistent-node"]);
    });

    it("multiple consumers share same state", () => {
      function Consumer1() {
        const { isNodesFetching } = useRowCountStateContext();
        return (
          <span data-testid="consumer-1">
            {JSON.stringify(isNodesFetching)}
          </span>
        );
      }

      function Consumer2() {
        const { setIsNodesFetching } = useRowCountStateContext();
        return (
          <button
            type="button"
            onClick={() => setIsNodesFetching(["shared-node"])}
            data-testid="set-shared"
          >
            Set Shared
          </button>
        );
      }

      render(
        <RowCountStateContextProvider>
          <Consumer1 />
          <Consumer2 />
        </RowCountStateContextProvider>,
      );

      // Consumer1 starts with empty array
      expect(screen.getByTestId("consumer-1")).toHaveTextContent("[]");

      // Update from Consumer2
      act(() => {
        screen.getByTestId("set-shared").click();
      });

      // Consumer1 should see the update
      expect(screen.getByTestId("consumer-1")).toHaveTextContent(
        '["shared-node"]',
      );
    });
  });

  describe("context interface", () => {
    it("exports RowCountStateContext interface with expected shape", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      const contextKeys = Object.keys(result.current);
      expect(contextKeys).toContain("isNodesFetching");
      expect(contextKeys).toContain("setIsNodesFetching");
      expect(contextKeys.length).toBe(2);
    });
  });

  describe("edge cases", () => {
    it("handles special characters in node IDs", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      const specialNodes = [
        "node-with-dash",
        "node_with_underscore",
        "node.with.dot",
      ];

      act(() => {
        result.current.setIsNodesFetching(specialNodes);
      });

      expect(result.current.isNodesFetching).toEqual(specialNodes);
    });

    it("handles replacing array completely", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      act(() => {
        result.current.setIsNodesFetching(["node-1", "node-2"]);
      });
      expect(result.current.isNodesFetching).toEqual(["node-1", "node-2"]);

      act(() => {
        result.current.setIsNodesFetching(["node-3", "node-4", "node-5"]);
      });
      expect(result.current.isNodesFetching).toEqual([
        "node-3",
        "node-4",
        "node-5",
      ]);
    });

    it("handles setting same array twice", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      act(() => {
        result.current.setIsNodesFetching(["same-node"]);
      });
      expect(result.current.isNodesFetching).toEqual(["same-node"]);

      act(() => {
        result.current.setIsNodesFetching(["same-node"]);
      });
      expect(result.current.isNodesFetching).toEqual(["same-node"]);
    });
  });
});

describe("combined contexts", () => {
  it("both contexts can be used together", () => {
    function CombinedTestConsumer() {
      const { sqlQuery, setSqlQuery } = useRecceQueryContext();
      const { isNodesFetching, setIsNodesFetching } = useRowCountStateContext();

      return (
        <div>
          <span data-testid="sql">{sqlQuery}</span>
          <span data-testid="fetching">{JSON.stringify(isNodesFetching)}</span>
          <button
            type="button"
            onClick={() => setSqlQuery("COMBINED SQL")}
            data-testid="set-sql"
          >
            Set SQL
          </button>
          <button
            type="button"
            onClick={() => setIsNodesFetching(["combined-node"])}
            data-testid="set-fetching"
          >
            Set Fetching
          </button>
        </div>
      );
    }

    render(
      <RecceQueryContextProvider>
        <RowCountStateContextProvider>
          <CombinedTestConsumer />
        </RowCountStateContextProvider>
      </RecceQueryContextProvider>,
    );

    // Initial values
    expect(screen.getByTestId("sql")).toHaveTextContent(defaultSqlQuery);
    expect(screen.getByTestId("fetching")).toHaveTextContent("[]");

    // Update both
    act(() => {
      screen.getByTestId("set-sql").click();
    });
    act(() => {
      screen.getByTestId("set-fetching").click();
    });

    // Both should update independently
    expect(screen.getByTestId("sql")).toHaveTextContent("COMBINED SQL");
    expect(screen.getByTestId("fetching")).toHaveTextContent(
      '["combined-node"]',
    );
  });

  it("nesting order does not affect functionality", () => {
    function TestConsumer() {
      const { sqlQuery } = useRecceQueryContext();
      const { isNodesFetching } = useRowCountStateContext();

      return (
        <div>
          <span data-testid="sql">{sqlQuery}</span>
          <span data-testid="fetching">{JSON.stringify(isNodesFetching)}</span>
        </div>
      );
    }

    // Test with RowCountStateContextProvider as outer
    render(
      <RowCountStateContextProvider>
        <RecceQueryContextProvider>
          <TestConsumer />
        </RecceQueryContextProvider>
      </RowCountStateContextProvider>,
    );

    expect(screen.getByTestId("sql")).toHaveTextContent(defaultSqlQuery);
    expect(screen.getByTestId("fetching")).toHaveTextContent("[]");
  });
});
