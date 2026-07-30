/**
 * @file QueryContextAdapter.test.tsx
 * @description Tests for QueryContextAdapter — the bridge between OSS and
 * @datarecce/ui's props-driven QueryProvider.
 *
 * The adapter owns the query-editor input state (current SQL, base SQL,
 * primary keys, custom-query toggle) and feeds it to the provider as props, so
 * OSS callers reading through `useRecceQueryContext` and shared components
 * reading through `useQueryContext` see one shared state.
 *
 * The provider's own props-in/values-out behavior is covered by
 * packages/ui/src/providers/contexts/__tests__/QueryContext.test.tsx; what is
 * unique here is (1) the fallback `useRecceQueryContext` returns with no
 * adapter mounted, and (2) that both views of the context stay in step.
 */

import { QueryContextAdapter, useRecceQueryContext } from "@datarecce/ui/hooks";
import { useQueryContext } from "@datarecce/ui/providers";
import { act, render, renderHook, screen } from "@testing-library/react";

/**
 * The SQL the query editor starts on: a dbt `ref` scaffold the user edits
 * rather than an empty buffer. Spelled out here rather than imported from the
 * adapter so a change to the starting query has to be made deliberately.
 */
const INITIAL_EDITOR_SQL = 'select * from {{ ref("mymodel") }}';

describe("QueryContextAdapter", () => {
  describe("defaults and fallbacks", () => {
    it("starts every input on its documented default inside the adapter", () => {
      const { result } = renderHook(() => useRecceQueryContext(), {
        wrapper: QueryContextAdapter,
      });

      expect(result.current.sqlQuery).toBe(INITIAL_EDITOR_SQL);
      expect(result.current.baseSqlQuery).toBe(INITIAL_EDITOR_SQL);
      expect(result.current.primaryKeys).toBeUndefined();
      expect(result.current.isCustomQueries).toBe(false);
    });

    it("falls back to the same defaults with no adapter mounted", () => {
      // OSS components type these fields as required, so the hook has to
      // substitute values (and no-op setters) outside the provider instead of
      // handing back undefined and crashing the caller.
      const { result } = renderHook(() => useRecceQueryContext());

      expect(result.current.sqlQuery).toBe(INITIAL_EDITOR_SQL);
      expect(result.current.baseSqlQuery).toBe(INITIAL_EDITOR_SQL);
      expect(result.current.primaryKeys).toBeUndefined();
      expect(result.current.isCustomQueries).toBe(false);

      expect(() => {
        result.current.setSqlQuery("SELECT 1");
        result.current.setBaseSqlQuery("SELECT 2");
        result.current.setPrimaryKeys(["id"]);
        result.current.setCustomQueries(true);
      }).not.toThrow();
    });
  });

  describe("canonical/OSS bridge", () => {
    it("shares one state between both views of the context", () => {
      // The OSS consumer writes; the shared @datarecce/ui consumer reads. Both
      // sit under a single adapter, so a write on either side has to land on
      // the other for query diffs to pick up the editor's state.
      function CanonicalReader() {
        // `sql` is the canonical field the shared query components execute
        // against; the adapter has to keep it fed from the same state as the
        // OSS `sqlQuery` alias.
        const { sql, baseSqlQuery, primaryKeys, isCustomQueries } =
          useQueryContext();
        return (
          <div>
            <span data-testid="canonical-sql">{sql}</span>
            <span data-testid="canonical-base-sql">{baseSqlQuery}</span>
            <span data-testid="canonical-keys">
              {JSON.stringify(primaryKeys)}
            </span>
            <span data-testid="canonical-custom">
              {String(isCustomQueries)}
            </span>
          </div>
        );
      }

      function OssWriter() {
        const {
          setSqlQuery,
          setBaseSqlQuery,
          setPrimaryKeys,
          setCustomQueries,
        } = useRecceQueryContext();
        return (
          <button
            type="button"
            data-testid="apply"
            onClick={() => {
              setSqlQuery("SELECT * FROM current");
              setBaseSqlQuery("SELECT * FROM base");
              setPrimaryKeys(["id", "tenant_id"]);
              setCustomQueries(true);
            }}
          >
            Apply
          </button>
        );
      }

      render(
        <QueryContextAdapter>
          <CanonicalReader />
          <OssWriter />
        </QueryContextAdapter>,
      );

      expect(screen.getByTestId("canonical-sql")).toHaveTextContent(
        INITIAL_EDITOR_SQL,
      );

      act(() => {
        screen.getByTestId("apply").click();
      });

      expect(screen.getByTestId("canonical-sql")).toHaveTextContent(
        "SELECT * FROM current",
      );
      expect(screen.getByTestId("canonical-base-sql")).toHaveTextContent(
        "SELECT * FROM base",
      );
      expect(screen.getByTestId("canonical-keys")).toHaveTextContent(
        '["id","tenant_id"]',
      );
      expect(screen.getByTestId("canonical-custom")).toHaveTextContent("true");
    });
  });
});
