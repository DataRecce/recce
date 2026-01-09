/**
 * @file utils/index.ts
 * @description Utility functions for data manipulation and formatting
 */

// CSV utilities
export {
  type CSVData,
  type CSVExportOptions,
  extractCSVData,
  generateCSVFilename,
  generateTimestamp,
  supportsCSVExport,
  toCSV,
} from "./csv";

export { deltaPercentageString } from "./delta";
export { formatSelectColumns } from "./formatSelect";
export {
  formatDuration,
  type TimeFormatStyle,
} from "./formatTime";
export {
  formatAsAbbreviatedNumber,
  formatIntervalMinMax,
  formatNumber,
} from "./formatters";
export { type MergeStatus, mergeKeys, mergeKeysWithStatus } from "./mergeKeys";
export { isSchemaChanged } from "./schemaDiff";
export {
  dataFrameToRowObjects,
  getCaseInsensitive,
  getValueAtPath,
  hashStringToNumber,
  keyToNumber,
} from "./transforms";
