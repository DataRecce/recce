/**
 * Single source of truth for a column's change *cause* in the schema diff.
 *
 * Every surface that paints a column — the name-cell badge, the row
 * background, the tooltip — must agree on whether a column is "changed" (its
 * own definition, type, or order moved) or merely "impacted" (a type shift
 * propagated from an upstream change it did not make). Deriving that
 * independently at each surface let them drift: a column could show the
 * impacted badge sitting on a "changed"-coloured row. Resolve it once here
 * and have every surface consume the result.
 *
 * Note: the type-icon transition (base → current) is intentionally NOT driven
 * by this. "What the type became" is a separate question from "who caused
 * it", and the icon renders on any raw type delta regardless of cause.
 */
export type ColumnChangeStatus =
  | "added"
  | "removed"
  | "changed"
  | "impacted"
  | "unknown"
  | "unchanged";

export interface ColumnChangeInput {
  baseIndex?: number;
  currentIndex?: number;
  baseType?: string;
  currentType?: string;
  reordered?: boolean;
  definitionChanged?: boolean;
  changeUnknown?: boolean;
}

/**
 * Resolve the change cause for a single column.
 *
 * Precedence:
 *   added / removed                                  (presence)
 *   inherited type shift on an impacted column       → impacted
 *   own type change, definition change, or reorder   → changed
 *   unresolved change status                         → unknown
 *   plain downstream impact (no type delta)          → impacted
 *   otherwise                                        → unchanged
 *
 * @param row        the column's diff fields
 * @param isImpacted whether the column is downstream-impacted (from CLL)
 */
export function getColumnChangeStatus(
  row: ColumnChangeInput,
  isImpacted: boolean | undefined,
): ColumnChangeStatus {
  const isAdded = row.baseIndex === undefined && row.currentIndex !== undefined;
  if (isAdded) return "added";
  const isRemoved =
    row.baseIndex !== undefined && row.currentIndex === undefined;
  if (isRemoved) return "removed";

  const typeChanged = row.baseType !== row.currentType;
  const locallyChanged =
    row.definitionChanged === true || row.reordered === true;

  // A type delta with no local change, on a downstream-impacted column, is an
  // inherited shift — impact, not a change the column made itself.
  if (
    typeChanged &&
    !locallyChanged &&
    isImpacted &&
    row.changeUnknown !== true
  ) {
    return "impacted";
  }
  if (typeChanged || locallyChanged) return "changed";
  if (row.changeUnknown === true) return "unknown";
  if (isImpacted) return "impacted";
  return "unchanged";
}
