import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check } from "@/lib/api/checks";
import { fetchModelRowCount } from "@/lib/api/models";
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import { Flex } from "@chakra-ui/react";
import { useQueries } from "@tanstack/react-query";
import DataGrid from "react-data-grid";
import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { RowCountDiffParams } from "@/lib/api/adhocQuery";


interface RowCountDiffViewProps {
  check: Check;
}

interface RowCountDiffRow {
  name: string;
  base: number | string;
  current: number | string;
}

export function RowCountDiffView({ check }: RowCountDiffViewProps) {
  function columnCellClass(row: RowCountDiffRow) {
    if (row.base === row.current) {
      return "column-body-normal";
    } else if (row.base < row.current || row.base === "N/A") {
      return "column-body-added";
    } else if (row.base > row.current || row.current === "N/A"){
      return "column-body-removed";
    }
    return "column-body-normal";
  }

  const columns = [
    { key: "name", name: "Name", cellClass: columnCellClass },
    { key: "base", name: "Base Rows", cellClass: columnCellClass },
    { key: "current", name: "Current Rows", cellClass: columnCellClass },
  ];

  const rows: RowCountDiffRow[] = Object.keys(check.last_run?.result || {}).map((key) => {
    const result = check.last_run?.result[key];
    const base = result?.base || null;
    const current = result?.curr || null;
    return {
      name: key,
      base: base === null ? "N/A" : Number(base),
      current: current === null ? "N/A" : Number(current),
    };
  });

  return (
    <Flex direction="column">
      {Object.keys(check.last_run?.result).length > 0 && (<>
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
            className="rdg-light"
            enableScreenshot={true}
          />
      </>)}
    </Flex>
  );
}
