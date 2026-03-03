/**
 * @file registry.test.ts
 * @description Tests for the extensible run type registry
 *
 * Tests verify:
 * - defaultRunTypeConfig has all required run types
 * - createRunTypeRegistry merges configs correctly
 * - findByRunType returns correct entries
 * - createBoundFindByRunType creates working lookup functions
 * - Registry extension patterns work correctly
 */

import type { RunType } from "../../../api";
import { RUN_TYPES } from "../../../api";
import {
  createBoundFindByRunType,
  createRunTypeRegistry,
  defaultRunTypeConfig,
  findByRunType,
  type IconComponent,
  type RunTypeConfig,
  type RunTypeRegistry,
} from "../registry";

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

describe("registry", () => {
  describe("defaultRunTypeConfig", () => {
    it("contains entries for all run types", () => {
      for (const runType of RUN_TYPES) {
        expect(defaultRunTypeConfig[runType]).toBeDefined();
      }
    });

    it("all entries have title and icon", () => {
      for (const runType of RUN_TYPES) {
        const entry = defaultRunTypeConfig[runType];
        expect(entry.title).toBeTruthy();
        expect(typeof entry.title).toBe("string");
        expect(entry.icon).toBeDefined();
        expect(typeof entry.icon).toBe("function");
      }
    });

    it("has correct titles for all run types", () => {
      expect(defaultRunTypeConfig.lineage_diff.title).toBe("Lineage Diff");
      expect(defaultRunTypeConfig.schema_diff.title).toBe("Schema Diff");
      expect(defaultRunTypeConfig.query.title).toBe("Query");
      expect(defaultRunTypeConfig.query_base.title).toBe("Query Base");
      expect(defaultRunTypeConfig.query_diff.title).toBe("Query Diff");
      expect(defaultRunTypeConfig.row_count.title).toBe("Row Count");
      expect(defaultRunTypeConfig.row_count_diff.title).toBe("Row Count Diff");
      expect(defaultRunTypeConfig.profile.title).toBe("Profile");
      expect(defaultRunTypeConfig.profile_diff.title).toBe("Profile Diff");
      expect(defaultRunTypeConfig.value_diff.title).toBe("Value Diff");
      expect(defaultRunTypeConfig.value_diff_detail.title).toBe(
        "Value Diff Detail",
      );
      expect(defaultRunTypeConfig.top_k_diff.title).toBe("Top-K Diff");
      expect(defaultRunTypeConfig.histogram_diff.title).toBe("Histogram Diff");
      expect(defaultRunTypeConfig.sandbox.title).toBe("Sandbox");
      expect(defaultRunTypeConfig.simple.title).toBe("Simple");
    });
  });

  describe("createRunTypeRegistry", () => {
    it("returns a complete registry with defaults", () => {
      const registry = createRunTypeRegistry({});

      for (const runType of RUN_TYPES) {
        expect(registry[runType]).toBeDefined();
        expect(registry[runType].title).toBe(
          defaultRunTypeConfig[runType].title,
        );
      }
    });

    it("overrides icon when provided", () => {
      const registry = createRunTypeRegistry({
        query: { icon: MockIcon },
      });

      expect(registry.query.icon).toBe(MockIcon);
      expect(registry.query.title).toBe("Query"); // Title preserved
    });

    it("overrides title when provided", () => {
      const registry = createRunTypeRegistry({
        query: { title: "Custom Query Title" },
      });

      expect(registry.query.title).toBe("Custom Query Title");
    });

    it("supports multiple overrides", () => {
      const registry = createRunTypeRegistry({
        query: { icon: MockIcon, title: "SQL Query" },
        profile: { icon: CustomIcon },
        row_count: { title: "Row Counter" },
      });

      expect(registry.query.icon).toBe(MockIcon);
      expect(registry.query.title).toBe("SQL Query");
      expect(registry.profile.icon).toBe(CustomIcon);
      expect(registry.profile.title).toBe("Profile");
      expect(registry.row_count.title).toBe("Row Counter");
    });

    it("does not mutate defaultRunTypeConfig", () => {
      const originalQueryTitle = defaultRunTypeConfig.query.title;

      createRunTypeRegistry({
        query: { title: "Modified Title" },
      });

      expect(defaultRunTypeConfig.query.title).toBe(originalQueryTitle);
    });

    it("ignores invalid run types gracefully", () => {
      // TypeScript would catch this at compile time, but verify runtime behavior
      const registry = createRunTypeRegistry({
        invalid_type: { title: "Invalid" },
      } as Record<string, Partial<RunTypeConfig>>);

      // Should still have all valid types
      for (const runType of RUN_TYPES) {
        expect(registry[runType]).toBeDefined();
      }
    });
  });

  describe("findByRunType", () => {
    it("returns correct entry for each run type", () => {
      for (const runType of RUN_TYPES) {
        const entry = findByRunType(runType);
        expect(entry).toBe(defaultRunTypeConfig[runType]);
      }
    });

    it("returns customized entry when using bound lookup with overrides", () => {
      const customRegistry = createRunTypeRegistry({
        query: { icon: MockIcon, title: "Custom Query" },
      });
      const findInCustomRegistry = createBoundFindByRunType(customRegistry);

      const entry = findInCustomRegistry("query");
      expect(entry.icon).toBe(MockIcon);
      expect(entry.title).toBe("Custom Query");
    });

    it("maintains type safety", () => {
      // These should all compile without errors
      const queryEntry = findByRunType("query");
      const profileEntry = findByRunType("profile_diff");
      const lineageEntry = findByRunType("lineage_diff");

      expect(queryEntry.title).toBe("Query");
      expect(profileEntry.title).toBe("Profile Diff");
      expect(lineageEntry.title).toBe("Lineage Diff");
    });
  });

  describe("createBoundFindByRunType", () => {
    it("creates a function that looks up in the bound registry", () => {
      const registry = createRunTypeRegistry({
        query: { icon: MockIcon },
      });

      const findInRegistry = createBoundFindByRunType(registry);

      expect(findInRegistry("query").icon).toBe(MockIcon);
      expect(findInRegistry("profile").title).toBe("Profile");
    });

    it("different bound functions use different registries", () => {
      const registry1 = createRunTypeRegistry({
        query: { title: "Registry 1 Query" },
      });
      const registry2 = createRunTypeRegistry({
        query: { title: "Registry 2 Query" },
      });

      const find1 = createBoundFindByRunType(registry1);
      const find2 = createBoundFindByRunType(registry2);

      expect(find1("query").title).toBe("Registry 1 Query");
      expect(find2("query").title).toBe("Registry 2 Query");
    });

    it("returns consistent references for same run type", () => {
      const registry = createRunTypeRegistry({});
      const findInRegistry = createBoundFindByRunType(registry);

      const entry1 = findInRegistry("query");
      const entry2 = findInRegistry("query");

      expect(entry1).toBe(entry2);
    });
  });

  describe("extension patterns", () => {
    it("supports OSS-style full registry creation", () => {
      // Simulate how OSS would create a registry with all icons/components
      const ossRegistry = createRunTypeRegistry({
        query: { icon: MockIcon },
        query_base: { icon: MockIcon },
        query_diff: { icon: MockIcon },
        profile: { icon: MockIcon },
        profile_diff: { icon: MockIcon },
        // ... other types
      });

      expect(ossRegistry.query.icon).toBe(MockIcon);
      expect(ossRegistry.lineage_diff.icon).toBeDefined(); // Uses default placeholder
    });

    it("supports Cloud-style extension with custom types", () => {
      // Cloud could add custom run types (not in base RunType union)
      // This is a pattern test - actual implementation would need type extension
      const baseRegistry = createRunTypeRegistry({
        query: { icon: MockIcon },
      });

      // Extend with spread pattern
      const cloudRegistry = {
        ...baseRegistry,
        custom_cloud_type: {
          title: "Cloud Feature",
          icon: CustomIcon,
        },
      };

      // Access via bracket notation since query exists on RunTypeRegistry
      expect((cloudRegistry as RunTypeRegistry).query.icon).toBe(MockIcon);
      expect(cloudRegistry.custom_cloud_type.title).toBe("Cloud Feature");
    });

    it("supports partial override pattern", () => {
      // Override only the icon while keeping other properties
      const customQueryConfig: Partial<RunTypeConfig> = {
        icon: CustomIcon,
      };

      const registry = createRunTypeRegistry({
        query: customQueryConfig,
      });

      expect(registry.query.icon).toBe(CustomIcon);
      expect(registry.query.title).toBe("Query"); // Preserved from default
    });
  });
});
