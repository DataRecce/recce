import { mergeKeys } from "./mergeKeys";

export function formatSelectColumns(
  baseColumns: string[],
  currentColumns: string[],
): string[] {
  const mergedColumns = mergeKeys(baseColumns, currentColumns);

  // both side have no schema
  if (mergedColumns.length === 0) {
    return [];
  }

  // if either side has schema (added and removed model, no catalog.json)
  if (baseColumns.length === 0 || currentColumns.length === 0) {
    return mergedColumns.map((col, idx) => {
      const last = idx === mergedColumns.length - 1;
      if (last) {
        return col;
      }
      return col + ",";
    });
  }

  let lastActualColumn = "";
  mergedColumns.forEach((col) => {
    if (baseColumns.includes(col) && currentColumns.includes(col)) {
      lastActualColumn = col;
    }
  });

  const selectColumns = mergedColumns.map((col, idx) => {
    let formatCol;

    if (!baseColumns.includes(col)) {
      formatCol = `--- ${col} (Added)`;
    } else if (!currentColumns.includes(col)) {
      formatCol = `--- ${col} (Removed)`;
    } else {
      formatCol = col;
    }

    if (col === lastActualColumn || idx === mergedColumns.length - 1) {
      return formatCol;
    }
    return formatCol + ",";
  });

  return selectColumns;
}
