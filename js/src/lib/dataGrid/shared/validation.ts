/**
 * @file validation.ts
 * @description OSS re-exports for validation utilities
 *
 * This file re-exports validation utilities from @datarecce/ui for backward compatibility.
 * New code should import directly from @datarecce/ui/utils.
 */

// Re-export everything from @datarecce/ui
export {
  DataGridValidationError,
  validateColumnDataAlignment,
  validateColumns,
  validateDataFrame,
  validatePrimaryKeyConfig,
  validateToDataDiffGridInputs,
  validateToDataGridInputs,
  validateToValueDiffGridInputs,
} from "@datarecce/ui/utils";
