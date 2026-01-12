/**
 * @file toValueDataGrid.ts
 * @description Re-exports from @datarecce/ui for Value Diff grid generator
 *
 * This file re-exports the toValueDataGrid function and types from @datarecce/ui
 * for backward compatibility with existing OSS imports.
 */

export type {
  ValueDataGridOptions,
  ValueDataGridResult,
} from "@datarecce/ui/components/ui/dataGrid";

export { toValueDataGrid } from "@datarecce/ui/components/ui/dataGrid";
