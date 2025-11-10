import { DataFrame, RowDataTypes, RowObjectType } from "@/lib/api/types";

export function dataFrameToRowObjects(dataFrame: DataFrame): RowObjectType[] {
  return dataFrame.data.map((row, index) => ({
    ...dataFrame.columns.reduce<Record<string, RowDataTypes>>((obj, column, colIndex) => {
      obj[column.name] = row[colIndex];
      return obj;
    }, {}),
    __status: undefined,
    _index: index + 1,
  }));
}
