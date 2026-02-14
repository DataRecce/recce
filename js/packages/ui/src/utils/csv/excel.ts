/**
 * @file csv/excel.ts
 * @description Excel (.xlsx) formatting utilities using write-excel-file
 */
import writeXlsxFile, { type Cell, type Row } from "write-excel-file";

/**
 * Convert a raw cell value to a write-excel-file Cell
 * - null/undefined → null (empty cell)
 * - objects/arrays → JSON string
 * - primitives → kept as-is with explicit type
 */
function toExcelCell(value: unknown): Cell {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object") {
    return { value: JSON.stringify(value), type: String };
  }
  if (typeof value === "number") {
    return { value, type: Number };
  }
  if (typeof value === "boolean") {
    return { value, type: Boolean };
  }
  return { value: String(value), type: String };
}

/**
 * Convert tabular data to an Excel (.xlsx) Blob
 * @param columns - Column headers
 * @param rows - Row data (array of arrays)
 * @returns Promise<Blob> containing valid .xlsx file data
 */
export function toExcelBlob(
  columns: string[],
  rows: unknown[][],
): Promise<Blob> {
  const headerRow: Row = columns.map((col) => ({
    value: col,
    type: String,
  }));

  const dataRows: Row[] = rows.map((row) => row.map(toExcelCell));

  // write-excel-file returns a Blob when no fileName is provided
  return writeXlsxFile([headerRow, ...dataRows], {});
}
