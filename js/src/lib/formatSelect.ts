import { mergeKeys } from "./mergeKeys";

export function formatSelectColumns(baseColumns: string[], currentColumns: string[]) {
  const mergedColumns = mergeKeys(baseColumns, currentColumns);
  const selectColumns = mergedColumns.map((col) => {
    if (!baseColumns.includes(col)) {
      return { col: `--- ${col} (Added)`, isActual: false };
    } else if (!currentColumns.includes(col)) {
      return { col: `--- ${col} (Removed)`, isActual: false };
    }
    return { col, isActual: true };
  });

  let lastActualIdx = -1;
  for (let i = selectColumns.length - 1; i >= 0; i--) {
    if (selectColumns[i].isActual) {
      lastActualIdx = i;
      break;
    }
  }

  const selectColumnsInfo = selectColumns.map((info, index) => {
    return {
      ...info,
      isLastActual: info.isActual && index === lastActualIdx,
      isLast: index === selectColumns.length - 1,
    };
  });

  const formatColumns: string[] = [];
  selectColumnsInfo.forEach((colInfo) => {
    if (colInfo.isLastActual || colInfo.isLast) {
      formatColumns.push(colInfo.col); // Last column and actual column, no comma
    } else {
      formatColumns.push(colInfo.col + ","); // Not the last actual, add comma
    }
  });

  return formatColumns.join("\n  ");
}
