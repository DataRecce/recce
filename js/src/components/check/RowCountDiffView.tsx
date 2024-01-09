import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check } from "@/lib/api/checks";
import { fetchModelRowCount } from "@/lib/api/models";
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import { Flex } from "@chakra-ui/react";
import { useQueries } from "@tanstack/react-query";
import DataGrid from "react-data-grid";
import { ScreenshotBox } from "../screenshot/ScreenshotBox";


interface RowCountDiffViewProps {
  check: Check;
}

export interface RowCountDiffParams {
  node_ids: string[];
}

interface RowCountDiffRow {
  name: string;
  base: number | string;
  current: number | string;
}

export function RowCountDiffView({ check }: RowCountDiffViewProps) {
  const { lineageGraphSets } = useLineageGraphsContext();
  const params = check.params as RowCountDiffParams;
  const nodeIds = params.node_ids;
  const nodes = nodeIds.map((id) => lineageGraphSets?.all.nodes[id]);

  const rowCountResults = useQueries({
    queries: nodes.map((node) => ({
      queryKey: cacheKeys.rowCount(node?.name!),
      queryFn: () => fetchModelRowCount(node?.name!),
    })),
  });

  function columnCellClass(row: RowCountDiffRow) {
    if (row.base < row.current || row.base === "N/A") {
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
  const rows : RowCountDiffRow[] = rowCountResults.map((result, index) => {
    const node = nodes[index];
    const base = result.data?.base || null;
    const current = result.data?.curr || null;
    return {
      name: node?.name || "",
      base: base === null ? "N/A" : Number(base),
      current: current === null ? "N/A" : Number(current),
    };
  });

  return (
    <Flex direction="column">
      {rowCountResults.length > 0 && (<>
        <ScreenshotBox style={{ maxHeight: "100%", overflow: "auto" }}>
          <DataGrid
            style={{
              height: "100%",

              fontSize: "10pt",
              borderWidth: 1,
              overflowY: "auto",
            }}
            columns={columns}
            rows={rows}
            className="rdg-light"
          />
        </ScreenshotBox>
      </>)}
    </Flex>
  );
}
