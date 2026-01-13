"use client";

/**
 * @file run/registry.ts
 * @description Run type registry with icons and components.
 *
 * This module provides:
 * - `RegistryEntry` interface for typed registry entries
 * - `RunRegistry` interface for the full registry mapping
 * - `registry` const with all run type configurations
 * - `findByRunType()` helper for looking up registry entries
 *
 * All run type icons are from react-icons. Components available in
 * @datarecce/ui are included; others are undefined and can be extended.
 */

import { LuChartBarBig } from "react-icons/lu";
import { MdFormatListNumberedRtl, MdSchema } from "react-icons/md";
import {
  TbAlignBoxLeftStretch,
  TbBrandStackshare,
  TbChartHistogram,
  TbEyeEdit,
  TbEyeSearch,
  TbSql,
} from "react-icons/tb";
import type { RunType } from "../../api";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";
import { HistogramDiffForm } from "../histogram/HistogramDiffForm";
import { HistogramDiffResultView } from "../histogram/HistogramResultView";
import { ProfileDiffForm } from "../profile/ProfileDiffForm";
import {
  ProfileDiffResultView,
  ProfileResultView,
} from "../profile/ProfileResultView";
import { QueryDiffResultView } from "../query/QueryDiffResultView";
import { QueryResultView } from "../query/QueryResultView";
import {
  RowCountDiffResultView,
  RowCountResultView,
} from "../rowcount/RowCountResultView";
import { TopKDiffForm } from "../top-k/TopKDiffForm";
import { TopKDiffResultView } from "../top-k/TopKDiffResultView";
import { ValueDiffDetailResultView } from "../valuediff/ValueDiffDetailResultView";
import { ValueDiffForm } from "../valuediff/ValueDiffForm";
import { ValueDiffResultView } from "../valuediff/ValueDiffResultView";
import type {
  RefTypes,
  RegistryEntry,
  RunFormParamTypes,
  RunTypeConfig,
  ViewOptionTypes,
} from "./types";

// ============================================================================
// Re-export types for consumers
// ============================================================================

export type {
  IconComponent,
  PartialRunTypeRegistry,
  RefTypes,
  RegistryEntry,
  RunFormParamTypes,
  RunFormProps,
  RunResultViewProps,
  RunResultViewRef,
  RunTypeConfig,
  RunTypeRegistry,
  ViewOptionTypes,
} from "./types";

// ============================================================================
// Run Registry Interface
// ============================================================================

/**
 * Interface for the run registry with specific component types for each run type.
 * This provides precise typing for each entry's ref type and view options.
 */
export interface RunRegistry {
  query: RegistryEntry<DataGridHandle>;
  query_base: RegistryEntry<DataGridHandle>;
  query_diff: RegistryEntry<DataGridHandle>;
  row_count: RegistryEntry<DataGridHandle>;
  row_count_diff: RegistryEntry<DataGridHandle>;
  profile: RegistryEntry<DataGridHandle>;
  profile_diff: RegistryEntry<DataGridHandle>;
  value_diff: RegistryEntry<DataGridHandle>;
  value_diff_detail: RegistryEntry<DataGridHandle>;
  top_k_diff: RegistryEntry<HTMLDivElement>;
  histogram_diff: RegistryEntry<HTMLDivElement>;
  lineage_diff: RegistryEntry<never>;
  schema_diff: RegistryEntry<never>;
  sandbox: RegistryEntry<never>;
  simple: RegistryEntry<never>;
}

// ============================================================================
// Registry
// ============================================================================

/**
 * The run type registry with all icons and available components.
 *
 * Components in @datarecce/ui are included directly. Components still in
 * OSS (QueryResultView, ProfileDiffResultView, ValueDiffResultView, etc.)
 * are undefined here and should be injected by consumers.
 *
 * @example
 * ```ts
 * const entry = registry.query;
 * console.log(entry.title); // "Query"
 * console.log(entry.icon); // TbSql
 * ```
 */
export const registry: RunRegistry = {
  lineage_diff: {
    title: "Lineage Diff",
    icon: TbBrandStackshare,
  },
  schema_diff: {
    title: "Schema Diff",
    icon: MdSchema,
  },
  query: {
    title: "Query",
    icon: TbSql,
    RunResultView:
      QueryResultView as RegistryEntry<DataGridHandle>["RunResultView"],
  },
  query_base: {
    title: "Query Base",
    icon: TbSql,
    RunResultView:
      QueryResultView as RegistryEntry<DataGridHandle>["RunResultView"],
  },
  query_diff: {
    title: "Query Diff",
    icon: TbSql,
    RunResultView:
      QueryDiffResultView as RegistryEntry<DataGridHandle>["RunResultView"],
  },
  row_count: {
    title: "Row Count",
    icon: MdFormatListNumberedRtl,
    RunResultView:
      RowCountResultView as RegistryEntry<DataGridHandle>["RunResultView"],
  },
  row_count_diff: {
    title: "Row Count Diff",
    icon: MdFormatListNumberedRtl,
    RunResultView:
      RowCountDiffResultView as RegistryEntry<DataGridHandle>["RunResultView"],
  },
  profile: {
    title: "Profile",
    icon: TbEyeSearch,
    RunResultView:
      ProfileResultView as RegistryEntry<DataGridHandle>["RunResultView"],
    RunForm: ProfileDiffForm,
  },
  profile_diff: {
    title: "Profile Diff",
    icon: TbEyeSearch,
    RunResultView:
      ProfileDiffResultView as RegistryEntry<DataGridHandle>["RunResultView"],
    RunForm: ProfileDiffForm,
  },
  value_diff: {
    title: "Value Diff",
    icon: TbAlignBoxLeftStretch,
    RunResultView:
      ValueDiffResultView as RegistryEntry<DataGridHandle>["RunResultView"],
    RunForm: ValueDiffForm,
  },
  value_diff_detail: {
    title: "Value Diff Detail",
    icon: TbAlignBoxLeftStretch,
    RunResultView:
      ValueDiffDetailResultView as RegistryEntry<DataGridHandle>["RunResultView"],
    RunForm: ValueDiffForm,
  },
  top_k_diff: {
    title: "Top-K Diff",
    icon: LuChartBarBig,
    RunResultView:
      TopKDiffResultView as RegistryEntry<HTMLDivElement>["RunResultView"],
    RunForm: TopKDiffForm,
  },
  histogram_diff: {
    title: "Histogram Diff",
    icon: TbChartHistogram,
    RunResultView:
      HistogramDiffResultView as RegistryEntry<HTMLDivElement>["RunResultView"],
    RunForm: HistogramDiffForm,
  },
  sandbox: {
    title: "Sandbox",
    icon: TbEyeEdit,
  },
  simple: {
    title: "Simple",
    icon: TbEyeEdit,
  },
};

// ============================================================================
// Registry Lookup
// ============================================================================

/**
 * Find a run type configuration by run type.
 *
 * @param runType - The run type to look up
 * @returns The registry entry for the run type
 *
 * @example
 * ```ts
 * const entry = findByRunType("query");
 * console.log(entry.title); // "Query"
 * console.log(entry.icon); // TbSql
 * ```
 */
export function findByRunType<T extends RunType>(runType: T): RunRegistry[T] {
  return registry[runType];
}

// ============================================================================
// Legacy Exports (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use `registry` directly instead
 */
export const defaultRunTypeConfig = registry;

/**
 * Creates a run type registry with the provided configurations.
 * Merges with defaults to ensure all run types have entries.
 *
 * @param config - Partial or full registry configuration
 * @returns Complete registry with all run types
 *
 * @example
 * ```ts
 * const customRegistry = createRunTypeRegistry({
 *   query: { ...registry.query, RunResultView: MyQueryResultView }
 * });
 * ```
 */
export function createRunTypeRegistry(
  config: Partial<Record<RunType, Partial<RunTypeConfig>>>,
): RunRegistry {
  const result = { ...registry } as Record<RunType, RunTypeConfig>;

  for (const [type, overrides] of Object.entries(config) as [
    RunType,
    Partial<RunTypeConfig>,
  ][]) {
    if (overrides && type in result) {
      result[type] = {
        ...result[type],
        ...overrides,
      };
    }
  }

  return result as RunRegistry;
}

/**
 * Creates a bound lookup function for a specific registry.
 *
 * @param reg - The registry to bind
 * @returns A function that looks up run types in the bound registry
 *
 * @example
 * ```ts
 * const customRegistry = createRunTypeRegistry({ ... });
 * const findCustomRunType = createBoundFindByRunType(customRegistry);
 * const entry = findCustomRunType("query");
 * ```
 */
export function createBoundFindByRunType(
  reg: RunRegistry,
): <T extends RunType>(runType: T) => RunRegistry[T] {
  return <T extends RunType>(runType: T) => reg[runType];
}
