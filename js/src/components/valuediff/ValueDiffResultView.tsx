import { Box, Center, Flex, Icon } from "@chakra-ui/react";

import { ColumnOrColumnGroup } from "react-data-grid";
import { ValueDiffParams, ValueDiffResult } from "@/lib/api/valuediff";
import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/RunModal";
import { VscKey } from "react-icons/vsc";

interface ValueDiffResultViewProp
  extends RunResultViewProps<ValueDiffParams, ValueDiffResult> {}

export function ValueDiffResultView({ run }: ValueDiffResultViewProp) {
  const result = run.result as ValueDiffResult;
  const params = run.params as ValueDiffParams;
  const cellClass = (row: any) => {
    const value: number | undefined = row["Matched %"];
    return value && value < 100 ? "diff-cell-modified" : "";
  };

  const columns: ColumnOrColumnGroup<any, any>[] = [
    {
      key: "name",
      name: "",
      maxWidth: 30,
      renderCell: ({ row }) => {
        return (
          <Center height="100%">
            {row.Column === params.primary_key && <Icon as={VscKey}></Icon>}
          </Center>
        );
      },
    },
    {
      key: "Column",
      name: "Column",
      resizable: true,
    },
    {
      key: "Matched",
      name: "Matched",
      resizable: true,
      cellClass,
    },
    {
      key: "Matched %",
      name: "Matched %",
      resizable: true,
      renderCell: ({ column, row }) => {
        const value: number | undefined = row[column.key];
        return (
          <Box textAlign="end">{value ? `${value.toFixed(2)} %` : "N/A"}</Box>
        );
      },
      cellClass,
    },
  ];

  return (
    <Flex direction="column" gap="5px" pt="5px" height="100%">
      <Box px="16px">
        Model: {params.model}, {result.summary.total} total (
        {result.summary.total - result.summary.added - result.summary.removed}{" "}
        common, {result.summary.added} added, {result.summary.removed} removed)
      </Box>

      <ScreenshotDataGrid
        style={{
          blockSize: "auto",
          maxHeight: "100%",
          overflow: "auto",
          borderBlock: "1px solid lightgray",
        }}
        columns={columns}
        rows={result.data.data}
        defaultColumnOptions={{ resizable: true }}
        className="rdg-light"
        enableScreenshot={true}
      />
    </Flex>
  );
}
