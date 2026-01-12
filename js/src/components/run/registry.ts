/**
 * @file run/registry.ts
 * @description OSS run type registry extending @datarecce/ui with OSS-specific components.
 *
 * This file extends the base registry from @datarecce/ui with OSS-specific:
 * - Result view components (QueryResultView, ProfileDiffResultView, etc.)
 * - Form components (ProfileDiffForm, ValueDiffForm, etc.)
 *
 * All types, icons, and base registry come from @datarecce/ui.
 */

import type { RunType } from "@datarecce/ui/api";
import {
  HistogramDiffForm,
  ProfileDiffForm,
  TopKDiffForm,
  ValueDiffForm,
  ValueDiffResultView,
} from "@datarecce/ui/components";
import {
  QueryDiffResultView,
  QueryResultView,
} from "@datarecce/ui/components/query";
import {
  registry as baseRegistry,
  type RefTypes,
  type RegistryEntry,
  type RunFormParamTypes,
  type RunRegistry,
  type ViewOptionTypes,
} from "@datarecce/ui/components/run";
import { type DataGridHandle } from "../data-grid/ScreenshotDataGrid";
import {
  ProfileDiffResultView,
  ProfileResultView,
} from "../profile/ProfileDiffResultView";
import { ValueDiffDetailResultView } from "../valuediff/ValueDiffDetailResultView";

// ============================================================================
// Re-export types from @datarecce/ui
// ============================================================================

export type {
  RefTypes,
  RegistryEntry,
  RunFormParamTypes,
  RunRegistry,
  ViewOptionTypes,
};

// Also re-export the base registry and utilities for consumers
export {
  createBoundFindByRunType,
  createRunTypeRegistry,
  defaultRunTypeConfig,
  registry as baseRegistry,
} from "@datarecce/ui/components/run";

// ============================================================================
// OSS Registry with Components
// ============================================================================

/**
 * The OSS registry extending @datarecce/ui with OSS-specific components.
 *
 * This registry includes all run types with their:
 * - Icons (from @datarecce/ui)
 * - Result view components (OSS-specific where applicable)
 * - Form components (OSS-specific)
 *
 * Type assertions are needed because the result view components have more
 * specific view option types than the generic RunTypeConfig expects.
 */
export const registry: RunRegistry = {
  // Inherit all base entries
  ...baseRegistry,

  // Override with OSS-specific components
  query: {
    ...baseRegistry.query,
    RunResultView:
      QueryResultView as RegistryEntry<DataGridHandle>["RunResultView"],
  },
  query_base: {
    ...baseRegistry.query_base,
    RunResultView:
      QueryResultView as RegistryEntry<DataGridHandle>["RunResultView"],
  },
  query_diff: {
    ...baseRegistry.query_diff,
    RunResultView:
      QueryDiffResultView as RegistryEntry<DataGridHandle>["RunResultView"],
  },
  profile: {
    ...baseRegistry.profile,
    RunResultView:
      ProfileResultView as RegistryEntry<DataGridHandle>["RunResultView"],
    RunForm: ProfileDiffForm,
  },
  profile_diff: {
    ...baseRegistry.profile_diff,
    RunResultView:
      ProfileDiffResultView as RegistryEntry<DataGridHandle>["RunResultView"],
    RunForm: ProfileDiffForm,
  },
  value_diff: {
    ...baseRegistry.value_diff,
    RunResultView:
      ValueDiffResultView as RegistryEntry<DataGridHandle>["RunResultView"],
    RunForm: ValueDiffForm,
  },
  value_diff_detail: {
    ...baseRegistry.value_diff_detail,
    RunResultView:
      ValueDiffDetailResultView as RegistryEntry<DataGridHandle>["RunResultView"],
    RunForm: ValueDiffForm,
  },
  top_k_diff: {
    ...baseRegistry.top_k_diff,
    RunForm: TopKDiffForm,
  },
  histogram_diff: {
    ...baseRegistry.histogram_diff,
    RunForm: HistogramDiffForm,
  },
};

// ============================================================================
// Lookup
// ============================================================================

/**
 * Find a run type configuration by run type.
 * Uses the OSS registry with all icons and components.
 *
 * @param runType - The run type to look up
 * @returns The registry entry for the run type
 *
 * @example
 * ```ts
 * const entry = findByRunType("query");
 * console.log(entry.title); // "Query"
 * console.log(entry.RunResultView); // QueryResultView component
 * ```
 */
export function findByRunType<T extends RunType>(runType: T): RunRegistry[T] {
  return registry[runType];
}
