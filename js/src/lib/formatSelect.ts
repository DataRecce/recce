import { mergeKeys } from "./mergeKeys";

export function formatSelectColumns(baseColumns: string[], currentColumns: string[]) {
  const mergedColumns = mergeKeys(baseColumns, currentColumns);

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

  return selectColumns.join("\n  ");
}
