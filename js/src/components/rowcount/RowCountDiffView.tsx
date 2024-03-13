import { Flex } from "@chakra-ui/react";
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";

import { RunResultViewProps } from "../run/types";
import { RowCountDiffParams, RowCountDiffResult } from "@/lib/api/rowcount";

interface RowCountDiffResultViewProp
  extends RunResultViewProps<RowCountDiffParams, RowCountDiffResult> {}

interface RowCountDiffRow {
  name: string;
  base: number | string;
  current: number | string;
}

export function RowCountDiffResultView({ run }: RowCountDiffResultViewProp) {
  function columnCellClass(row: RowCountDiffRow) {
    if (row.base === row.current) {
      return "column-body-normal";
    } else if (row.base < row.current || row.base === "N/A") {
      return "column-body-added";
    } else if (row.base > row.current || row.current === "N/A") {
      return "column-body-removed";
    }
    return "column-body-normal";
  }

  const runResult = run.result || {};

  const columns = [
    { key: "name", name: "Name", cellClass: columnCellClass },
    { key: "base", name: "Base Rows", cellClass: columnCellClass },
    { key: "current", name: "Current Rows", cellClass: columnCellClass },
    { key: "delta", name: "Delta", cellClass: columnCellClass },
  ];

  const rows: RowCountDiffRow[] = Object.keys(run.result || {}).map((key) => {
    const result = runResult[key];
    const base = result?.base || null;
    const current = result?.curr || null;
    let delta = "No Change";

    if (base !== null && current !== null) {
      if (base < current) {
        delta = `+ ${Math.round(((current - base) / base) * 100)}%`;
      } else if (base > current) {
        delta = `- ${Math.round(((base - current) / base) * 100)}%`;
      } else {
        delta = "No Change";
      }
    } else {
      if (base === current) {
        delta = "N/A";
      } else if (base === null) {
        delta = "Added";
      } else if (current === null) {
        delta = "Removed";
      }
    }

    return {
      name: key,
      base: base === null ? "N/A" : Number(base),
      current: current === null ? "N/A" : Number(current),
      delta: delta,
    };
  });

  return (
    <Flex direction="column">
      {Object.keys(runResult).length > 0 && (
        <>
          <ScreenshotDataGrid
            style={{
              blockSize: "auto",
              maxHeight: "100%",
              overflow: "auto",

              fontSize: "10pt",
              borderWidth: 1,
            }}
            columns={columns}
            rows={rows}
            renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
            className="rdg-light"
            enableScreenshot={true}
          />
        </>
      )}
    </Flex>
  );
}
