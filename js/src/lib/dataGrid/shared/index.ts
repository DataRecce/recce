/**
 * @file shared/index.ts
 * @description Exports for shared data grid utilities
 *
 * Most utilities are now exported directly from @datarecce/ui/utils.
 * This file only exports OSS-specific wrappers that inject render components.
 *
 * For pure utilities, import from @datarecce/ui/utils:
 * - Column builders: buildColumnOrder, getDisplayColumns, etc.
 * - Grid utilities: buildColumnMap, toRenderedValue, etc.
 * - Row builders: buildDiffRows
 * - Validation: validateDataFrame, DataGridValidationError, etc.
 */

// OSS wrappers that inject render components
export {
  type BuildDiffColumnDefinitionsConfig,
  type BuildDiffColumnDefinitionsResult,
  buildDiffColumnDefinitions,
  type DiffColumnDefinition,
} from "./diffColumnBuilder";
export {
  type BuildSimpleColumnDefinitionsConfig,
  type BuildSimpleColumnDefinitionsResult,
  buildSimpleColumnDefinitions,
  type SimpleColumnDefinition,
} from "./simpleColumnBuilder";
export {
  createCellClassBase,
  createCellClassCurrent,
  type DiffColumnConfig,
  type DiffColumnResult,
  toDiffColumn,
} from "./toDiffColumn";
