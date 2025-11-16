import {
  Box,
  Center,
  Flex,
  Icon,
  IconButton,
  Menu,
  Portal,
  Spacer,
} from "@chakra-ui/react";
import React, { forwardRef, Ref } from "react";
import { ColumnOrColumnGroup, DataGridHandle } from "react-data-grid";
import { PiDotsThreeVertical } from "react-icons/pi";
import { VscKey } from "react-icons/vsc";
import { DataFrame, isValueDiffRun, RowObjectType } from "@/lib/api/types";
import { ValueDiffParams, ValueDiffResult } from "@/lib/api/valuediff";
import {
  RecceActionOptions,
  useRecceActionContext,
} from "@/lib/hooks/RecceActionContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { dataFrameToRowObjects } from "@/utils/transforms";
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";

type ValueDiffResultViewProp = RunResultViewProps;

function ColumnNameCell({
  params,
  column,
}: {
  params: ValueDiffParams;
  column: string;
}) {
  const { runAction } = useRecceActionContext();
  const { featureToggles } = useRecceInstanceContext();
  const handleValueDiffDetail = (
    paramsOverride?: Partial<ValueDiffParams>,
    options?: RecceActionOptions,
  ) => {
    const newParams = {
      ...params,
      ...paramsOverride,
    };

    runAction("value_diff_detail", newParams, options);
  };

  return (
    <Flex>
      <Box overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
        {column}
      </Box>
      <Spacer />

      <Menu.Root lazyMount>
        <Menu.Trigger asChild>
          <IconButton
            className="row-context-menu"
            variant="plain"
            size={"sm"}
            disabled={featureToggles.disableDatabaseQuery}
          >
            <PiDotsThreeVertical />
          </IconButton>
        </Menu.Trigger>

        <Portal>
          <Menu.Positioner>
            <Menu.Content lineHeight="20px">
              <Menu.ItemGroup title="Action" as={Box} fontSize="8pt">
                <Menu.Item
                  value="show-mismatched-values"
                  fontSize="10pt"
                  onClick={() => {
                    handleValueDiffDetail({}, { showForm: true });
                  }}
                >
                  Show mismatched values...
                </Menu.Item>
                <Menu.Item
                  value="show-mismatched-columns"
                  fontSize="10pt"
                  onClick={() => {
                    handleValueDiffDetail(
                      { columns: [column] },
                      { showForm: false },
                    );
                  }}
                >
                  Show mismatched values for &apos;{column}&apos;
                </Menu.Item>
              </Menu.ItemGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </Flex>
  );
}

function _ValueDiffResultView(
  { run }: ValueDiffResultViewProp,
  ref: Ref<DataGridHandle>,
) {
  if (!isValueDiffRun(run)) {
    throw new Error("Run type must be value_diff");
  }

  const result = run.result as ValueDiffResult;
  const params = run.params as ValueDiffParams;
  const cellClass = (row: RowObjectType) => {
    const value = row[2] as unknown as number | undefined;
    return value != null && value < 1 ? "diff-cell-modified" : "";
  };
  const primaryKeys = Array.isArray(params.primary_key)
    ? params.primary_key
    : [params.primary_key];

  // used as a type fix below
  const basicColumns: DataFrame["columns"] = [
    {
      key: "0",
      name: "Column",
      type: "text",
    },
    {
      key: "1",
      name: "Matched",
      type: "number",
    },
    {
      key: "2",
      name: "Matched %",
      type: "number",
    },
  ];

  const columns: ColumnOrColumnGroup<RowObjectType>[] = [
    {
      key: "__is_pk__",
      name: "",
      width: 30,
      maxWidth: 30,
      renderCell: ({ row }) => {
        return (
          <Center height="100%">
            {primaryKeys.includes(String(row[0])) && <Icon as={VscKey}></Icon>}
          </Center>
        );
      },
    },
    {
      key: "0",
      name: "Column",
      resizable: true,
      renderCell: ({ row, column }) => {
        return (
          <ColumnNameCell column={String(row[column.key])} params={params} />
        );
      },
      cellClass: "cell-show-context-menu",
    },
    {
      key: "1",
      name: "Matched",
      resizable: true,
      cellClass,
    },
    {
      key: "2",
      name: "Matched %",
      resizable: true,
      renderCell: ({ column, row }) => {
        const value = row[column.key] as unknown as number | undefined;
        return (
          <Box textAlign="end">
            {value != null ? `${(value * 100).toFixed(2)} %` : "N/A"}
          </Box>
        );
      },
      cellClass,
    },
  ];

  result.data.columns = basicColumns;

  return (
    <Flex direction="column" gap="5px" pt="5px" height="100%">
      <Box px="16px">
        Model: {params.model}, {result.summary.total} total (
        {result.summary.total - result.summary.added - result.summary.removed}{" "}
        common, {result.summary.added} added, {result.summary.removed} removed)
      </Box>

      <ScreenshotDataGrid
        ref={ref}
        style={{
          blockSize: "auto",
          maxHeight: "100%",
          overflow: "auto",
          borderBlock: "1px solid lightgray",
        }}
        columns={columns}
        rows={dataFrameToRowObjects(result.data)}
        renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
        defaultColumnOptions={{ resizable: true }}
        className="rdg-light"
      />
    </Flex>
  );
}

export const ValueDiffResultView = forwardRef(_ValueDiffResultView);
