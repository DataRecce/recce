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
  /** The node's `unique_id`, used to build `<nodeId>_<column>` ids. */
  nodeId?: string;
  /**
   * This node's own column names (base ∪ current). Impacted ids are attributed
   * to this node by exact `<nodeId>_<column>` membership against these names —
   * NOT by prefix-stripping, which mis-fires whenever one node id is a prefix
   * of another (`model.shop.orders` would otherwise absorb a column of
   * `model.shop.orders_summary`, since CLL ids are an underscore-joined
   * `{node_id}_{column_name}` with no unambiguous boundary).
   */
  nodeColumnNames?: ReadonlySet<string>;
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
  nodeColumnNames,
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
  // Attribute impacted ids to this node by exact `<nodeId>_<column>` membership
  // over the node's own columns — never by prefix-stripping the global set,
  // which would mis-attribute a sibling model's columns (DRC-3390 review #1).
  if (impactedColumns && nodeId && nodeColumnNames) {
    for (const name of nodeColumnNames) {
      if (impactedColumns.has(`${nodeId}_${name}`)) names.add(name);
    }
  }
  const changedColumns = [...names];

  // changedColumns is always an array here (feature on), so length 0 == empty.
  const hasChangedScope = changedColumns.length > 0;

  // A whole-model change widens to every column: the change isn't pinned to
  // specific columns, so any column's *values* may have shifted even when its
  // definition is untouched, and the changed-column subset would under-cover.
  const scopedColumns =
    profileAllColumns || wholeModelChange || !hasChangedScope
      ? undefined
      : changedColumns;

  const profileEnabled =
    hasChangedScope || wholeModelChange || profileAllColumns;

  const profilingAll = scopedColumns === undefined && profileEnabled;

  return { changedColumns, scopedColumns, profileEnabled, profilingAll };
}
