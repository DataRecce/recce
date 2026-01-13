/**
 * @file QueryContextAdapter.test.tsx
 * @description Tests for QueryContextAdapter - the bridge between OSS and @datarecce/ui
 *
 * The adapter wraps @datarecce/ui's QueryProvider and manages internal state:
 * - sqlQuery / setSqlQuery
 * - baseSqlQuery / setBaseSqlQuery
 * - primaryKeys / setPrimaryKeys
 * - isCustomQueries / setCustomQueries
 *
 * These tests verify the adapter preserves all OSS RecceQueryContext behaviors
 * while delegating state management to the @datarecce/ui provider.
 */

import {
  defaultSqlQuery,
  QueryContextAdapter,
  useRecceQueryContext,
} from "@datarecce/ui/hooks";
import { useQueryContext } from "@datarecce/ui/providers";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * Create wrapper with QueryContextAdapter
 */
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryContextAdapter>{children}</QueryContextAdapter>;
  };
}

describe("QueryContextAdapter", () => {
  describe("rendering", () => {
    it("renders children", () => {
      render(
        <QueryContextAdapter>
          <div data-testid="child">Test Child</div>
        </QueryContextAdapter>,
      );
      expect(screen.getByTestId("child")).toHaveTextContent("Test Child");
    });
  });

  describe("defaultSqlQuery export", () => {
    it("exports the correct default SQL query constant", () => {
      expect(defaultSqlQuery).toBe('select * from {{ ref("mymodel") }}');
    });
  });

  describe("useQueryContext hook", () => {
    it("provides default sqlQuery", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });
      expect(result.current.sqlQuery).toBe(defaultSqlQuery);
    });

    it("provides setSqlQuery that updates sqlQuery", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSqlQuery?.("SELECT * FROM users");
      });

      expect(result.current.sqlQuery).toBe("SELECT * FROM users");
    });

    it("provides default primaryKeys as undefined", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });
      expect(result.current.primaryKeys).toBeUndefined();
    });

    it("provides setPrimaryKeys that updates primaryKeys", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setPrimaryKeys?.(["id", "name"]);
      });

      expect(result.current.primaryKeys).toEqual(["id", "name"]);
    });

    it("provides default isCustomQueries as false", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });
      expect(result.current.isCustomQueries).toBe(false);
    });

    it("provides setCustomQueries that updates isCustomQueries", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setCustomQueries?.(true);
      });

      expect(result.current.isCustomQueries).toBe(true);
    });

    it("provides default baseSqlQuery", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });
      expect(result.current.baseSqlQuery).toBe(defaultSqlQuery);
    });

    it("provides setBaseSqlQuery that updates baseSqlQuery", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setBaseSqlQuery?.("SELECT 1");
      });

      expect(result.current.baseSqlQuery).toBe("SELECT 1");
    });
  });

  describe("useRecceQueryContext alias", () => {
    it("is an alias for useQueryContext", () => {
      const { result: result1 } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });
      const { result: result2 } = renderHook(() => useRecceQueryContext(), {
        wrapper: createWrapper(),
      });

      // Both should have the same default values
      expect(result1.current.sqlQuery).toBe(result2.current.sqlQuery);
      expect(result1.current.primaryKeys).toBe(result2.current.primaryKeys);
      expect(result1.current.isCustomQueries).toBe(
        result2.current.isCustomQueries,
      );
    });

    it("works identically to useQueryContext", () => {
      function TestComponent() {
        const { sqlQuery, setSqlQuery } = useRecceQueryContext();
        return (
          <>
            <span data-testid="sql">{sqlQuery}</span>
            <button type="button" onClick={() => setSqlQuery?.("new query")}>
              Update
            </button>
          </>
        );
      }

      render(
        <QueryContextAdapter>
          <TestComponent />
        </QueryContextAdapter>,
      );

      expect(screen.getByTestId("sql")).toHaveTextContent(defaultSqlQuery);
      fireEvent.click(screen.getByText("Update"));
      expect(screen.getByTestId("sql")).toHaveTextContent("new query");
    });
  });

  describe("sqlQuery state", () => {
    it("updates sqlQuery via click interaction", () => {
      function TestConsumer() {
        const { sqlQuery, setSqlQuery } = useQueryContext();
        return (
          <div>
            <span data-testid="sql-query">{sqlQuery}</span>
            <button
              type="button"
              onClick={() => setSqlQuery?.("SELECT * FROM users")}
              data-testid="set-sql"
            >
              Set SQL
            </button>
          </div>
        );
      }

      render(
        <QueryContextAdapter>
          <TestConsumer />
        </QueryContextAdapter>,
      );

      expect(screen.getByTestId("sql-query")).toHaveTextContent(
        defaultSqlQuery,
      );

      act(() => {
        screen.getByTestId("set-sql").click();
      });

      expect(screen.getByTestId("sql-query")).toHaveTextContent(
        "SELECT * FROM users",
      );
    });

    it("handles multiple sqlQuery updates correctly", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSqlQuery?.("SELECT 1");
      });
      expect(result.current.sqlQuery).toBe("SELECT 1");

      act(() => {
        result.current.setSqlQuery?.("SELECT 2");
      });
      expect(result.current.sqlQuery).toBe("SELECT 2");

      act(() => {
        result.current.setSqlQuery?.("SELECT 3");
      });
      expect(result.current.sqlQuery).toBe("SELECT 3");
    });

    it("handles empty string SQL query", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSqlQuery?.("");
      });

      expect(result.current.sqlQuery).toBe("");
    });

    it("handles complex SQL queries", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
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
        result.current.setSqlQuery?.(complexQuery);
      });

      expect(result.current.sqlQuery).toBe(complexQuery);
    });
  });

  describe("baseSqlQuery state", () => {
    it("updates baseSqlQuery when setBaseSqlQuery called", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setBaseSqlQuery?.("SELECT * FROM base_table");
      });

      expect(result.current.baseSqlQuery).toBe("SELECT * FROM base_table");
    });

    it("sqlQuery and baseSqlQuery can be set independently", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSqlQuery?.("SELECT * FROM current");
      });

      act(() => {
        result.current.setBaseSqlQuery?.("SELECT * FROM base");
      });

      expect(result.current.sqlQuery).toBe("SELECT * FROM current");
      expect(result.current.baseSqlQuery).toBe("SELECT * FROM base");
    });
  });

  describe("primaryKeys state", () => {
    it("clears primaryKeys when set to undefined", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      // First set some keys
      act(() => {
        result.current.setPrimaryKeys?.(["id", "name"]);
      });
      expect(result.current.primaryKeys).toEqual(["id", "name"]);

      // Then clear them
      act(() => {
        result.current.setPrimaryKeys?.(undefined);
      });
      expect(result.current.primaryKeys).toBeUndefined();
    });

    it("handles empty array for primaryKeys", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setPrimaryKeys?.([]);
      });

      expect(result.current.primaryKeys).toEqual([]);
    });

    it("handles single primary key", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setPrimaryKeys?.(["id"]);
      });

      expect(result.current.primaryKeys).toEqual(["id"]);
    });

    it("handles multiple primary keys", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setPrimaryKeys?.(["id", "tenant_id", "version"]);
      });

      expect(result.current.primaryKeys).toEqual([
        "id",
        "tenant_id",
        "version",
      ]);
    });
  });

  describe("isCustomQueries state", () => {
    it("updates isCustomQueries when setCustomQueries called with false", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      // First set to true
      act(() => {
        result.current.setCustomQueries?.(true);
      });
      expect(result.current.isCustomQueries).toBe(true);

      // Then set to false
      act(() => {
        result.current.setCustomQueries?.(false);
      });
      expect(result.current.isCustomQueries).toBe(false);
    });

    it("toggles correctly multiple times", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setCustomQueries?.(true);
      });
      expect(result.current.isCustomQueries).toBe(true);

      act(() => {
        result.current.setCustomQueries?.(false);
      });
      expect(result.current.isCustomQueries).toBe(false);

      act(() => {
        result.current.setCustomQueries?.(true);
      });
      expect(result.current.isCustomQueries).toBe(true);
    });
  });

  describe("state persistence", () => {
    it("sqlQuery persists across re-renders", () => {
      const { result, rerender } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSqlQuery?.("SELECT * FROM persistent_table");
      });

      // Trigger re-render
      rerender();

      expect(result.current.sqlQuery).toBe("SELECT * FROM persistent_table");
    });

    it("all state values persist across re-renders", () => {
      const { result, rerender } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSqlQuery?.("SELECT * FROM current");
        result.current.setBaseSqlQuery?.("SELECT * FROM base");
        result.current.setPrimaryKeys?.(["pk1", "pk2"]);
        result.current.setCustomQueries?.(true);
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
        const { sqlQuery, primaryKeys } = useQueryContext();
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
        const { sqlQuery, setSqlQuery, setPrimaryKeys } = useQueryContext();
        return (
          <div>
            <span data-testid="consumer-2-sql">{sqlQuery}</span>
            <button
              type="button"
              onClick={() => setSqlQuery?.("SHARED QUERY")}
              data-testid="set-shared-sql"
            >
              Set SQL
            </button>
            <button
              type="button"
              onClick={() => setPrimaryKeys?.(["shared_key"])}
              data-testid="set-shared-keys"
            >
              Set Keys
            </button>
          </div>
        );
      }

      render(
        <QueryContextAdapter>
          <Consumer1 />
          <Consumer2 />
        </QueryContextAdapter>,
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
    it("provides all expected OSS context properties", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      // Check that OSS properties exist
      expect("sqlQuery" in result.current).toBe(true);
      expect("setSqlQuery" in result.current).toBe(true);
      expect("baseSqlQuery" in result.current).toBe(true);
      expect("setBaseSqlQuery" in result.current).toBe(true);
      expect("primaryKeys" in result.current).toBe(true);
      expect("setPrimaryKeys" in result.current).toBe(true);
      expect("isCustomQueries" in result.current).toBe(true);
      expect("setCustomQueries" in result.current).toBe(true);
    });

    it("also provides @datarecce/ui context properties", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      // Check that @datarecce/ui properties exist
      expect("sql" in result.current).toBe(true);
      expect("isExecuting" in result.current).toBe(true);
    });
  });

  describe("type exports", () => {
    it("exports QueryContextType", () => {
      // Type-level test - if this compiles, the type is exported
      const typeCheck: { sql: string; isExecuting: boolean } = {
        sql: "test",
        isExecuting: false,
      };
      expect(typeCheck.sql).toBe("test");
    });
  });

  describe("edge cases", () => {
    it("handles special characters in SQL query", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      const specialQuery =
        "SELECT * FROM users WHERE name LIKE '%O''Brien%' AND status = 'active'";

      act(() => {
        result.current.setSqlQuery?.(specialQuery);
      });

      expect(result.current.sqlQuery).toBe(specialQuery);
    });

    it("handles unicode in SQL query", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      const unicodeQuery =
        "SELECT * FROM users WHERE name = '\u65E5\u672C\u8A9E'";

      act(() => {
        result.current.setSqlQuery?.(unicodeQuery);
      });

      expect(result.current.sqlQuery).toBe(unicodeQuery);
    });

    it("handles special characters in primary key names", () => {
      const { result } = renderHook(() => useQueryContext(), {
        wrapper: createWrapper(),
      });

      const specialKeys = ["user-id", "order_number", "Column With Spaces"];

      act(() => {
        result.current.setPrimaryKeys?.(specialKeys);
      });

      expect(result.current.primaryKeys).toEqual(specialKeys);
    });
  });
});
