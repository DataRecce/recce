import { ColumnRenderMode } from "../../lib/api/types";

export function columnPrecisionSelectOptions(
  colName: string,
  onColumnsRenderModeChanged: (col: Record<string, ColumnRenderMode>) => void,
): { value: string; onClick: () => void }[] {
  return [
    {
      value: "Show raw value",
      onClick: () => {
        onColumnsRenderModeChanged({ [colName]: "raw" });
      },
    },
    {
      value: "Show 2 decimal points",
      onClick: () => {
        onColumnsRenderModeChanged({ [colName]: 2 });
      },
    },
    {
      value: "Show as percentage",
      onClick: () => {
        onColumnsRenderModeChanged({ [colName]: "percent" });
      },
    },
    {
      value: "Show with net change",
      onClick: () => {
        onColumnsRenderModeChanged({ [colName]: "delta" });
      },
    },
  ];
}
