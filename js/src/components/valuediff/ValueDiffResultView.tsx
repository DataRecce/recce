import { Box, Center, Flex, Icon } from "@chakra-ui/react";

import { Check } from "@/lib/api/checks";
import DataGrid, { ColumnOrColumnGroup } from "react-data-grid";
import { ValueDiffParams, ValueDiffResult } from "@/lib/api/valuediff";
import { ScreenshotBox } from "../screenshot/ScreenshotBox";
import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { Run } from "@/lib/api/types";
import { RunResultViewProps } from "../run/RunModal";
import { VscKey } from "react-icons/vsc";

interface ValueDiffResultViewProp
  extends RunResultViewProps<ValueDiffParams, ValueDiffResult> {}

export function ValueDiffResultView({ run }: ValueDiffResultViewProp) {
  const result = run.result as ValueDiffResult;
  const params = run.params as ValueDiffParams;

  const columns: ColumnOrColumnGroup<any, any>[] = [];

  columns.push({
    key: "name",
    name: "",
    maxWidth: 30,
    renderCell: ({ column, row }) => {
      return (
        <Center height="100%">
          {row.Column === params.primary_key && <Icon as={VscKey}></Icon>}
        </Center>
      );
    },
  });
  result.data.schema.fields.forEach((field: { name: string }) => {
    columns.push({
      name: field.name,
      key: field.name,
      width: undefined,
      resizable: true,
    });
  });

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
