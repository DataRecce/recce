/**
 * @file registry.test.ts
 * @description Comprehensive tests for run type registry
 *
 * Tests verify:
 * - findByRunType returns correct icon and title for all run types
 * - Registry entries have required properties
 * - Unknown types return correct registry entries
 * - RunResultView and RunForm components are properly registered
 *
 * Source of truth: OSS functionality - these tests document current behavior
 */

// ============================================================================
// Imports
// ============================================================================

import type { RunType } from "@datarecce/ui/api";
import { findByRunType } from "@datarecce/ui/components/run";

// ============================================================================
// Test Suites
// ============================================================================

describe("registry", () => {
  describe("findByRunType", () => {
    // ==========================================================================
    // Basic Registry Tests
    // ==========================================================================

    describe("basic registry entries", () => {
      it("returns correct entry for lineage_diff", () => {
        const entry = findByRunType("lineage_diff");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Lineage Diff");
        expect(entry.icon).toBeDefined();
        expect(typeof entry.icon).toBe("function");
      });

      it("returns correct entry for schema_diff", () => {
        const entry = findByRunType("schema_diff");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Schema Diff");
        expect(entry.icon).toBeDefined();
      });

      it("returns correct entry for query", () => {
        const entry = findByRunType("query");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Query");
        expect(entry.icon).toBeDefined();
        expect(entry.RunResultView).toBeDefined();
      });

      it("returns correct entry for query_base", () => {
        const entry = findByRunType("query_base");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Query Base");
        expect(entry.icon).toBeDefined();
        expect(entry.RunResultView).toBeDefined();
      });

      it("returns correct entry for query_diff", () => {
        const entry = findByRunType("query_diff");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Query Diff");
        expect(entry.icon).toBeDefined();
        expect(entry.RunResultView).toBeDefined();
      });

      it("returns correct entry for row_count", () => {
        const entry = findByRunType("row_count");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Row Count");
        expect(entry.icon).toBeDefined();
        expect(entry.RunResultView).toBeDefined();
      });

      it("returns correct entry for row_count_diff", () => {
        const entry = findByRunType("row_count_diff");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Row Count Diff");
        expect(entry.icon).toBeDefined();
        expect(entry.RunResultView).toBeDefined();
      });

      it("returns correct entry for profile", () => {
        const entry = findByRunType("profile");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Profile");
        expect(entry.icon).toBeDefined();
        expect(entry.RunResultView).toBeDefined();
        expect(entry.RunForm).toBeDefined();
      });

      it("returns correct entry for profile_diff", () => {
        const entry = findByRunType("profile_diff");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Profile Diff");
        expect(entry.icon).toBeDefined();
        expect(entry.RunResultView).toBeDefined();
        expect(entry.RunForm).toBeDefined();
      });

      it("returns correct entry for value_diff", () => {
        const entry = findByRunType("value_diff");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Value Diff");
        expect(entry.icon).toBeDefined();
        expect(entry.RunResultView).toBeDefined();
        expect(entry.RunForm).toBeDefined();
      });

      it("returns correct entry for value_diff_detail", () => {
        const entry = findByRunType("value_diff_detail");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Value Diff Detail");
        expect(entry.icon).toBeDefined();
        expect(entry.RunResultView).toBeDefined();
        expect(entry.RunForm).toBeDefined();
      });

      it("returns correct entry for top_k_diff", () => {
        const entry = findByRunType("top_k_diff");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Top-K Diff");
        expect(entry.icon).toBeDefined();
        expect(entry.RunResultView).toBeDefined();
        expect(entry.RunForm).toBeDefined();
      });

      it("returns correct entry for histogram_diff", () => {
        const entry = findByRunType("histogram_diff");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Histogram Diff");
        expect(entry.icon).toBeDefined();
        expect(entry.RunResultView).toBeDefined();
        expect(entry.RunForm).toBeDefined();
      });

      it("returns correct entry for sandbox", () => {
        const entry = findByRunType("sandbox");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Sandbox");
        expect(entry.icon).toBeDefined();
      });

      it("returns correct entry for simple", () => {
        const entry = findByRunType("simple");

        expect(entry).toBeDefined();
        expect(entry.title).toBe("Simple");
        expect(entry.icon).toBeDefined();
      });
    });

    // ==========================================================================
    // Icon Consistency Tests
    // ==========================================================================

    describe("icon consistency", () => {
      it("all run types have icons that are functions", () => {
        const runTypes: RunType[] = [
          "lineage_diff",
          "schema_diff",
          "query",
          "query_base",
          "query_diff",
          "row_count",
          "row_count_diff",
          "profile",
          "profile_diff",
          "value_diff",
          "value_diff_detail",
          "top_k_diff",
          "histogram_diff",
          "sandbox",
          "simple",
        ];

        for (const runType of runTypes) {
          const entry = findByRunType(runType);
          expect(typeof entry.icon).toBe("function");
        }
      });
    });

    // ==========================================================================
    // Title Consistency Tests
    // ==========================================================================

    describe("title consistency", () => {
      it("all run types have non-empty string titles", () => {
        const runTypes: RunType[] = [
          "lineage_diff",
          "schema_diff",
          "query",
          "query_base",
          "query_diff",
          "row_count",
          "row_count_diff",
          "profile",
          "profile_diff",
          "value_diff",
          "value_diff_detail",
          "top_k_diff",
          "histogram_diff",
          "sandbox",
          "simple",
        ];

        for (const runType of runTypes) {
          const entry = findByRunType(runType);
          expect(entry.title).toBeTruthy();
          expect(typeof entry.title).toBe("string");
          expect(entry.title.length).toBeGreaterThan(0);
        }
      });

      it("titles are human-readable with proper capitalization", () => {
        expect(findByRunType("lineage_diff").title).toBe("Lineage Diff");
        expect(findByRunType("schema_diff").title).toBe("Schema Diff");
        expect(findByRunType("query").title).toBe("Query");
        expect(findByRunType("query_base").title).toBe("Query Base");
        expect(findByRunType("query_diff").title).toBe("Query Diff");
        expect(findByRunType("row_count").title).toBe("Row Count");
        expect(findByRunType("row_count_diff").title).toBe("Row Count Diff");
        expect(findByRunType("profile").title).toBe("Profile");
        expect(findByRunType("profile_diff").title).toBe("Profile Diff");
        expect(findByRunType("value_diff").title).toBe("Value Diff");
        expect(findByRunType("value_diff_detail").title).toBe(
          "Value Diff Detail",
        );
        expect(findByRunType("top_k_diff").title).toBe("Top-K Diff");
        expect(findByRunType("histogram_diff").title).toBe("Histogram Diff");
        expect(findByRunType("sandbox").title).toBe("Sandbox");
        expect(findByRunType("simple").title).toBe("Simple");
      });
    });

    // ==========================================================================
    // RunResultView Tests
    // ==========================================================================

    describe("RunResultView availability", () => {
      it("query types have RunResultView", () => {
        expect(findByRunType("query").RunResultView).toBeDefined();
        expect(findByRunType("query_base").RunResultView).toBeDefined();
        expect(findByRunType("query_diff").RunResultView).toBeDefined();
      });

      it("row count types have RunResultView", () => {
        expect(findByRunType("row_count").RunResultView).toBeDefined();
        expect(findByRunType("row_count_diff").RunResultView).toBeDefined();
      });

      it("profile types have RunResultView", () => {
        expect(findByRunType("profile").RunResultView).toBeDefined();
        expect(findByRunType("profile_diff").RunResultView).toBeDefined();
      });

      it("value diff types have RunResultView", () => {
        expect(findByRunType("value_diff").RunResultView).toBeDefined();
        expect(findByRunType("value_diff_detail").RunResultView).toBeDefined();
      });

      it("top_k_diff has RunResultView", () => {
        expect(findByRunType("top_k_diff").RunResultView).toBeDefined();
      });

      it("histogram_diff has RunResultView", () => {
        expect(findByRunType("histogram_diff").RunResultView).toBeDefined();
      });

      it("lineage_diff does not have RunResultView", () => {
        expect(findByRunType("lineage_diff").RunResultView).toBeUndefined();
      });

      it("schema_diff does not have RunResultView", () => {
        expect(findByRunType("schema_diff").RunResultView).toBeUndefined();
      });

      it("sandbox does not have RunResultView", () => {
        expect(findByRunType("sandbox").RunResultView).toBeUndefined();
      });

      it("simple does not have RunResultView", () => {
        expect(findByRunType("simple").RunResultView).toBeUndefined();
      });
    });

    // ==========================================================================
    // RunForm Tests
    // ==========================================================================

    describe("RunForm availability", () => {
      it("profile types have RunForm", () => {
        expect(findByRunType("profile").RunForm).toBeDefined();
        expect(findByRunType("profile_diff").RunForm).toBeDefined();
      });

      it("value_diff types have RunForm", () => {
        expect(findByRunType("value_diff").RunForm).toBeDefined();
        expect(findByRunType("value_diff_detail").RunForm).toBeDefined();
      });

      it("top_k_diff has RunForm", () => {
        expect(findByRunType("top_k_diff").RunForm).toBeDefined();
      });

      it("histogram_diff has RunForm", () => {
        expect(findByRunType("histogram_diff").RunForm).toBeDefined();
      });

      it("query types do not have RunForm", () => {
        expect(findByRunType("query").RunForm).toBeUndefined();
        expect(findByRunType("query_base").RunForm).toBeUndefined();
        expect(findByRunType("query_diff").RunForm).toBeUndefined();
      });

      it("row count types do not have RunForm", () => {
        expect(findByRunType("row_count").RunForm).toBeUndefined();
        expect(findByRunType("row_count_diff").RunForm).toBeUndefined();
      });
    });

    // ==========================================================================
    // Type Safety Tests
    // ==========================================================================

    describe("type safety", () => {
      it("maintains type inference for specific run types", () => {
        // This test verifies TypeScript type inference at compile time
        // If it compiles, the types are correct
        const queryEntry = findByRunType("query");
        const profileEntry = findByRunType("profile_diff");
        const lineageEntry = findByRunType("lineage_diff");

        // These should all compile without errors
        expect(queryEntry.title).toBe("Query");
        expect(profileEntry.title).toBe("Profile Diff");
        expect(lineageEntry.title).toBe("Lineage Diff");
      });
    });

    // ==========================================================================
    // Edge Case Tests
    // ==========================================================================

    describe("edge cases", () => {
      it("handles all valid run types without errors", () => {
        const runTypes: RunType[] = [
          "lineage_diff",
          "schema_diff",
          "query",
          "query_base",
          "query_diff",
          "row_count",
          "row_count_diff",
          "profile",
          "profile_diff",
          "value_diff",
          "value_diff_detail",
          "top_k_diff",
          "histogram_diff",
          "sandbox",
          "simple",
        ];

        for (const runType of runTypes) {
          expect(() => findByRunType(runType)).not.toThrow();
        }
      });

      it("returns consistent references for the same run type", () => {
        const entry1 = findByRunType("query");
        const entry2 = findByRunType("query");

        // Should return the same object reference
        expect(entry1).toBe(entry2);
      });
    });
  });
});
