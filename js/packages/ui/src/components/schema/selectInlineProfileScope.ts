/**
 * @file selectInlineProfileScope.ts
 * @description DRC-3390 Stage C — pure scoping logic for the inline paired
 * distribution in the schema view, extracted from `SchemaView` so the wiring
 * is unit-testable in isolation (no React, no lineage context).
 *
 * Given the change signals for a node and the user's "Profile all columns"
 * opt-in, it decides which columns to profile and whether to profile at all.
 * The schema view threads `profileEnabled`/`scopedColumns` into the hook and
 * `profilingAll` into the "Profile all columns" button gate.
 */

/** Per-column change status as supplied by breaking change analysis. */
export type ColumnChangeStatus = "added" | "removed" | "modified" | "unknown";

export interface InlineProfileScopeInput {
  /** Master feature gate (the `new_cll_experience` server flag). */
  newCllExperience: boolean;
  /** This node's own added/removed/modified columns, keyed by column name. */
  columnChanges?: Record<string, ColumnChangeStatus> | null;
  /** Frozen impacted-column ids (`<nodeId>_<column>`) from impact analysis. */
  impactedColumns?: ReadonlySet<string>;
  /** The node's `unique_id`, used to strip the prefix off `impactedColumns`. */
  nodeId?: string;
  /** True when the whole model changed (profile every column). */
  wholeModelChange: boolean;
  /** User opted into profiling every column via the button. */
  profileAllColumns: boolean;
}

export interface InlineProfileScope {
  /**
   * The changed-column subset under new-CLL, or `undefined` when the feature
   * is off. May be an empty array when the feature is on but nothing changed.
   */
  changedColumns: string[] | undefined;
  /**
   * Columns to actually profile: the changed subset by default, widened to
   * every column (`undefined`) on a whole-model change or once the user opts
   * into all.
   */
  scopedColumns: string[] | undefined;
  /** Master gate: whether to run the inline distribution at all. */
  profileEnabled: boolean;
  /**
   * True when the run already covers every column, so there is nothing left
   * to expand into — the "Profile all columns" button hides in this case.
   */
  profilingAll: boolean;
}

/**
 * Scope the inline distribution to *changed* columns under the new-CLL
 * experience (perf: don't profile every column of a model when only a few
 * diverged). The scope is the union of the same two signals the grid already
 * colors from — `columnChanges` (this node's own added/removed/modified
 * columns) and `impactedColumns` (columns impacted downstream). No re-deriving
 * change status from base/current. A whole-model change profiles all columns.
 */
export function selectInlineProfileScope({
  newCllExperience,
  columnChanges,
  impactedColumns,
  nodeId,
  wholeModelChange,
  profileAllColumns,
}: InlineProfileScopeInput): InlineProfileScope {
  if (!newCllExperience) {
    return {
      changedColumns: undefined,
      scopedColumns: undefined,
      profileEnabled: false,
      profilingAll: false,
    };
  }

  const names = new Set<string>(Object.keys(columnChanges ?? {}));
  if (impactedColumns && nodeId) {
    const prefix = `${nodeId}_`;
    for (const id of impactedColumns) {
      if (id.startsWith(prefix)) names.add(id.slice(prefix.length));
    }
  }
  const changedColumns = [...names];

  // changedColumns is always an array here (feature on), so length 0 == empty.
  const hasChangedScope = changedColumns.length > 0;

  const scopedColumns =
    profileAllColumns || !hasChangedScope ? undefined : changedColumns;

  const profileEnabled =
    hasChangedScope || wholeModelChange || profileAllColumns;

  const profilingAll = scopedColumns === undefined && profileEnabled;

  return { changedColumns, scopedColumns, profileEnabled, profilingAll };
}
