/**
 * @file csv/excel.ts
 * @description Excel (.xlsx) formatting utilities
 */
import * as XLSX from "xlsx";

/**
 * Convert a cell value to an appropriate Excel value
 * - null/undefined → null (empty cell)
 * - objects/arrays → JSON string
 * - primitives → kept as-is (numbers stay numbers, strings stay strings)
 */
function toExcelValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

/**
 * Convert tabular data to an Excel (.xlsx) ArrayBuffer
 * @param columns - Column headers
 * @param rows - Row data (array of arrays)
 * @returns ArrayBuffer containing valid .xlsx file data
 */
export function toExcelBuffer(
  columns: string[],
  rows: unknown[][],
): ArrayBuffer {
  // Build array-of-arrays with header row first
  const aoa: (string | number | boolean | null)[][] = [
    columns,
    ...rows.map((row) => row.map(toExcelValue)),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const buffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer;

  return buffer;
}
