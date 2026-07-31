/**
 * @file registry.test.ts
 * @description Tests for the run type registry.
 *
 * Consolidates the former OSS-side suite (js/src/components/run) into the
 * owning package. Two things are checked:
 *
 * 1. The public run-type surface: which run types the checklist exposes, the
 *    title each one displays, and whether it ships a result view / a parameter
 *    form. This is spelled out as an explicit matrix below rather than looped
 *    over `Object.keys(registry)` — deriving expectations from the registry
 *    makes the test pass no matter what the registry says.
 * 2. Registry composition (`createRunTypeRegistry`, `createBoundFindByRunType`)
 *    used by consumers that inject their own icons or components.
 */

import type { RunType } from "../../../api";
import {
  createBoundFindByRunType,
  createRunTypeRegistry,
  findByRunType,
  type IconComponent,
  type RunTypeConfig,
  registry,
} from "../registry";

// ============================================================================
// Expected public run-type surface
// ============================================================================

/**
 * The run types the checklist exposes, with their displayed title and which
 * optional components they ship.
 *
 * Written out by hand on purpose. Sources, none of which is `registry` itself:
 * - `title` is user-facing copy shown in the run modal header and the
 *   checklist / run-history rows.
 * - `hasResultView` — a run type renders results in the result pane. Types
 *   that only exist as a check kind (`lineage_diff`, `schema_diff`) or as a
 *   placeholder (`simple`) render through their own surfaces instead, and
 *   `RecceActionAdapter` rejects a submit for a type with no result view.
 * - `hasForm` — a run type needs parameters from the user before it can run
 *   (a column, a set of primary keys), so `runAction` opens the run modal.
 *   Query and row-count runs take their params from the caller and submit
 *   directly.
 *
 * `profile_distribution` is deliberately absent: it is a valid `RunType` on
 * the wire but a backend-only one (DRC-3390), documented in
 * `api/types/run.ts` as having no registry entry. It is asserted separately.
 */
const EXPECTED_RUN_TYPES = [
  {
    runType: "lineage_diff",
    title: "Lineage Diff",
    hasResultView: false,
    hasForm: false,
  },
  {
    runType: "schema_diff",
    title: "Schema Diff",
    hasResultView: false,
    hasForm: false,
  },
  { runType: "simple", title: "Simple", hasResultView: false, hasForm: false },
  { runType: "query", title: "Query", hasResultView: true, hasForm: false },
  {
    runType: "query_base",
    title: "Query Base",
    hasResultView: true,
    hasForm: false,
  },
  {
    runType: "query_diff",
    title: "Query Diff",
    hasResultView: true,
    hasForm: false,
  },
  {
    runType: "row_count",
    title: "Row Count",
    hasResultView: true,
    hasForm: false,
  },
  {
    runType: "row_count_diff",
    title: "Row Count Diff",
    hasResultView: true,
    hasForm: false,
  },
  { runType: "profile", title: "Profile", hasResultView: true, hasForm: true },
  {
    runType: "profile_diff",
    title: "Profile Diff",
    hasResultView: true,
    hasForm: true,
  },
  {
    runType: "value_diff",
    title: "Value Diff",
    hasResultView: true,
    hasForm: true,
  },
  {
    runType: "value_diff_detail",
    title: "Value Diff Detail",
    hasResultView: true,
    hasForm: true,
  },
  {
    runType: "top_k_diff",
    title: "Top-K Diff",
    hasResultView: true,
    hasForm: true,
  },
  {
    runType: "histogram_diff",
    title: "Histogram Diff",
    hasResultView: true,
    hasForm: true,
  },
] as const;

// ============================================================================
// Test Fixtures
// ============================================================================

const MockIcon: IconComponent = () => null;
MockIcon.displayName = "MockIcon";

const CustomIcon: IconComponent = () => null;
CustomIcon.displayName = "CustomIcon";

// ============================================================================
// Test Suites
// ============================================================================

describe("run registry", () => {
  describe("public run-type surface", () => {
    it("registers exactly the expected run types", () => {
      expect(Object.keys(registry).sort()).toEqual(
        EXPECTED_RUN_TYPES.map((entry) => entry.runType as string).sort(),
      );
    });

    it.each(EXPECTED_RUN_TYPES)(
      "$runType displays '$title' with resultView=$hasResultView form=$hasForm",
      ({ runType, title, hasResultView, hasForm }) => {
        const entry = findByRunType(runType);

        expect(entry.title).toBe(title);
        expect(typeof entry.icon).toBe("function");
        expect(entry.RunResultView !== undefined).toBe(hasResultView);
        expect(entry.RunForm !== undefined).toBe(hasForm);
      },
    );

    it("has no entry for the backend-only profile_distribution run type", () => {
      // DRC-3390: the dispatcher accepts it, the registry does not — callers
      // passing a dynamic RunType must handle the undefined.
      expect(findByRunType("profile_distribution" as RunType)).toBeUndefined();
    });
  });

  describe("createRunTypeRegistry", () => {
    it("returns the registered defaults when given no overrides", () => {
      const custom = createRunTypeRegistry({});

      for (const { runType, title } of EXPECTED_RUN_TYPES) {
        expect(custom[runType].title).toBe(title);
      }
    });

    it("applies an override without dropping the entry's other fields", () => {
      const custom = createRunTypeRegistry({
        query: { icon: MockIcon },
        row_count: { title: "Row Counter" },
      });

      expect(custom.query.icon).toBe(MockIcon);
      expect(custom.query.title).toBe("Query");
      expect(custom.row_count.title).toBe("Row Counter");
      expect(custom.row_count.RunResultView).toBe(
        registry.row_count.RunResultView,
      );
    });

    it("leaves the shared registry unmodified", () => {
      const originalQuery = registry.query;

      createRunTypeRegistry({ query: { title: "Modified Title" } });

      expect(registry.query).toBe(originalQuery);
      expect(registry.query.title).toBe("Query");
    });

    it("drops overrides for run types that are not registered", () => {
      const custom = createRunTypeRegistry({
        profile_distribution: { title: "Backend Only" },
      } as Partial<Record<RunType, Partial<RunTypeConfig>>>);

      expect(Object.keys(custom).sort()).toEqual(Object.keys(registry).sort());
    });
  });

  describe("createBoundFindByRunType", () => {
    it("looks up in the bound registry rather than the shared one", () => {
      const custom = createRunTypeRegistry({
        query: { icon: MockIcon, title: "Custom Query" },
      });

      const findInCustom = createBoundFindByRunType(custom);

      expect(findInCustom("query").icon).toBe(MockIcon);
      expect(findInCustom("query").title).toBe("Custom Query");
      expect(findByRunType("query").title).toBe("Query");
    });

    it("keeps separately bound registries independent", () => {
      const findInFirst = createBoundFindByRunType(
        createRunTypeRegistry({ query: { icon: MockIcon } }),
      );
      const findInSecond = createBoundFindByRunType(
        createRunTypeRegistry({ query: { icon: CustomIcon } }),
      );

      expect(findInFirst("query").icon).toBe(MockIcon);
      expect(findInSecond("query").icon).toBe(CustomIcon);
    });
  });
});
