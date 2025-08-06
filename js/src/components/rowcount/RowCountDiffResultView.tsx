import { Center, Flex } from "@chakra-ui/react";
import { EmptyRowsRenderer, ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";

import { RunResultViewProps } from "../run/types";
import {
  RowCountDiffParams,
  RowCountDiffResult,
  RowCountParams,
  RowCountResult,
} from "@/lib/api/rowcount";
import { deltaPercentageString } from "./delta";
import { isNumber } from "lodash";
import { forwardRef } from "react";

type RowCountDiffResultViewProp = RunResultViewProps<RowCountDiffParams, RowCountDiffResult>;

interface RowCountDiffRow {
  name: string;
  base: number | string;
  current: number | string;
}

function _RowCountDiffResultView({ run }: RowCountDiffResultViewProp, ref: any) {
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

type RowCountResultViewProp = RunResultViewProps<RowCountParams, RowCountResult>;

interface RowCountRow {
  name: string;
  current: number | string;
}

function _RowCountResultView({ run }: RowCountResultViewProp, ref: any) {
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

export const RowCountDiffResultView = forwardRef(_RowCountDiffResultView);
export const RowCountResultView = forwardRef(_RowCountResultView);
