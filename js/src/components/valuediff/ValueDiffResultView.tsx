import {
  Box,
  Center,
  Flex,
  forwardRef,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuGroup,
  MenuItem,
  MenuList,
  Portal,
  Spacer,
} from "@chakra-ui/react";

import { ColumnOrColumnGroup } from "react-data-grid";
import { ValueDiffParams, ValueDiffResult } from "@/lib/api/valuediff";
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";
import { VscKebabVertical, VscKey } from "react-icons/vsc";
import {
  RecceActionOptions,
  useRecceActionContext,
} from "@/lib/hooks/RecceActionContext";
import { useRef } from "react";

interface ValueDiffResultViewProp
  extends RunResultViewProps<ValueDiffParams, ValueDiffResult> {}

function ColumnNameCell({
  params,
  column,
}: {
  params: ValueDiffParams;
  column: string;
}) {
  const { runAction } = useRecceActionContext();
  const handleValueDiffDetail = (
    paramsOverride?: Partial<ValueDiffParams>,
    options?: RecceActionOptions
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

      <Menu isLazy>
        {({ isOpen }) => (
          <>
            <MenuButton
              className="row-context-menu"
              visibility={isOpen ? "visible" : "hidden"}
              width={isOpen ? "auto" : "0px"}
              minWidth={isOpen ? "auto" : "0px"}
              as={IconButton}
              icon={<Icon as={VscKebabVertical} />}
              variant="unstyled"
              size={"sm"}
            />

            <MenuList lineHeight="20px">
              <MenuGroup title="Action" as={Box} fontSize="8pt">
                <MenuItem
                  fontSize="10pt"
                  onClick={() => handleValueDiffDetail({}, { showForm: true })}
                >
                  Show mismatched values...
                </MenuItem>
                <MenuItem
                  fontSize="10pt"
                  onClick={() =>
                    handleValueDiffDetail(
                      { columns: [column] },
                      { showForm: false }
                    )
                  }
                >
                  Show mismatched values for &apos;{column}&apos;
                </MenuItem>
              </MenuGroup>
            </MenuList>
          </>
        )}
      </Menu>
    </Flex>
  );
}

function _ValueDiffResultView({ run }: ValueDiffResultViewProp, ref: any) {
  const result = run.result as ValueDiffResult;
  const params = run.params as ValueDiffParams;
  const cellClass = (row: any) => {
    const value: number | undefined = row[2];

    return value !== undefined && value !== null && value < 1
      ? "diff-cell-modified"
      : "";
  };
  const primaryKeys = Array.isArray(params.primary_key)
    ? params.primary_key
    : [params.primary_key];

  const columns: ColumnOrColumnGroup<any, any>[] = [
    {
      key: "__is_pk__",
      name: "",
      width: 30,
      maxWidth: 30,
      renderCell: ({ row }) => {
        return (
          <Center height="100%">
            {primaryKeys.includes(row[0]) && <Icon as={VscKey}></Icon>}
          </Center>
        );
      },
    },
    {
      key: "0",
      name: "Column",
      resizable: true,
      renderCell: ({ row, column }) => {
        return <ColumnNameCell column={row[column.key]} params={params} />;
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
        const value: number | undefined = row[column.key];
        return (
          <Box textAlign="end">
            {value != undefined && value !== null
              ? `${(value * 100).toFixed(2)} %`
              : "N/A"}
          </Box>
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
        ref={ref}
        style={{
          blockSize: "auto",
          maxHeight: "100%",
          overflow: "auto",
          borderBlock: "1px solid lightgray",
          flex: "1",
        }}
        columns={columns}
        rows={result.data.data}
        renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
        defaultColumnOptions={{ resizable: true }}
        className="rdg-light"
        enableScreenshot={true}
      />
    </Flex>
  );
}

export const ValueDiffResultView = forwardRef(_ValueDiffResultView);