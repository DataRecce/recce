import { Center, Flex } from "@chakra-ui/react";
import { isNumber } from "lodash";
import { forwardRef, Ref } from "react";
import { DataGridHandle } from "react-data-grid";
import {
  isRowCountDiffRun,
  isRowCountRun,
  RowObjectType,
} from "@/lib/api/types";
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";
import { deltaPercentageString } from "./delta";

type RowCountDiffResultViewProp = RunResultViewProps;

interface RowCountDiffRow extends RowObjectType {
  name: string;
  base: number | string;
  current: number | string;
}

function _RowCountDiffResultView(
  { run }: RowCountDiffResultViewProp,
  ref: Ref<DataGridHandle>,
) {
  if (!isRowCountDiffRun(run)) {
    throw new Error("Run type must be row_count_diff");
  }
  function columnCellClass(row: RowObjectType) {
    const typedRow = row as unknown as RowCountDiffRow;
    if (typedRow.base === typedRow.current) {
      return "column-body-normal";
    } else if (typedRow.base < typedRow.current || typedRow.base === "N/A") {
      return "column-body-added";
    } else if (typedRow.base > typedRow.current || typedRow.current === "N/A") {
      return "column-body-removed";
    }
    return "column-body-normal";
  }

  const runResult = run.result ?? {};

  const columns = [
    { key: "name", name: "Name", cellClass: columnCellClass },
    { key: "base", name: "Base Rows", cellClass: columnCellClass },
    { key: "current", name: "Current Rows", cellClass: columnCellClass },
    { key: "delta", name: "Delta", cellClass: columnCellClass },
  ];

  const rows: RowCountDiffRow[] = Object.keys(run.result ?? {}).map((key) => {
    const result = runResult[key];
    const base = isNumber(result.base) ? result.base : null;
    const current = isNumber(result.curr) ? result.curr : null;
    let delta = "=";

    if (base !== null && current !== null) {
      delta = base !== current ? deltaPercentageString(base, current) : "=";
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
      base: base ?? "N/A",
      current: current ?? "N/A",
      delta: delta,
      __status: undefined,
    };
  });

  if (rows.length === 0) {
    return (
      <Center bg="rgb(249,249,249)" height="100%">
        No nodes matched
      </Center>
    );
  }

  return (
    <Flex direction="column">
      {Object.keys(runResult).length > 0 && (
        <>
          <ScreenshotDataGrid
            ref={ref}
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
          />
        </>
      )}
    </Flex>
  );
}

type RowCountResultViewProp = RunResultViewProps;

interface RowCountRow extends RowObjectType {
  name: string;
  current: number | string;
}

function _RowCountResultView(
  { run }: RowCountResultViewProp,
  ref: Ref<DataGridHandle>,
) {
  if (!isRowCountRun(run)) {
    throw new Error("Run type must be row_count");
  }
  const runResult = run.result ?? {};

  const columns = [
    { key: "name", name: "Name" },
    { key: "current", name: "Row Count" },
  ];

  const rows: RowCountRow[] = Object.keys(run.result ?? {}).map((key) => {
    const result = runResult[key];
    const current = isNumber(result.curr) ? result.curr : null;

    return {
      name: key,
      current: current ?? "N/A",
      __status: undefined,
    };
  });

  if (rows.length === 0) {
    return (
      <Center bg="rgb(249,249,249)" height="100%">
        No nodes matched
      </Center>
    );
  }

  return (
    <Flex direction="column">
      {Object.keys(runResult).length > 0 && (
        <ScreenshotDataGrid
          ref={ref}
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
        />
      )}
    </Flex>
  );
}

export const RowCountDiffResultView = forwardRef(_RowCountDiffResultView);
export const RowCountResultView = forwardRef(_RowCountResultView);
