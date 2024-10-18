import "react-data-grid/lib/styles.css";

import {
  QueryDiffParams,
  QueryDiffResult,
  QueryDiffViewOptions,
} from "@/lib/api/adhocQuery";
import { Box, Center, Flex, forwardRef } from "@chakra-ui/react";
import { useMemo } from "react";
import { toDataDiffGrid } from "./querydiff";
import { toValueDiffGrid as toQueryDiffJoinGrid } from "../valuediff/valuediff";

import "./styles.css";
import { Run } from "@/lib/api/types";
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";
import { RunToolbar } from "../run/RunToolbar";

export interface QueryDiffResultViewProps
  extends RunResultViewProps<
    QueryDiffParams,
    QueryDiffResult,
    QueryDiffViewOptions
  > {
  onAddToChecklist?: (run: Run<QueryDiffParams, QueryDiffResult>) => void;
}

const _QueryDiffResultView = (
  {
    run,
    onAddToChecklist,
    viewOptions,
    onViewOptionsChanged,
  }: QueryDiffResultViewProps,
  ref: any
) => {
  const primaryKeys = useMemo(
    () => viewOptions?.primary_keys || [],
    [viewOptions]
  );
  const changedOnly = useMemo(
    () => viewOptions?.changed_only || false,
    [viewOptions]
  );
  const pinnedColumns = useMemo(
    () => viewOptions?.pinned_columns || [],
    [viewOptions]
  );

  const gridData = useMemo(() => {
    const handlePrimaryKeyChanged = (primaryKeys: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          primary_keys: primaryKeys,
        });
      }
    };

    const handlePinnedColumnsChanged = (pinnedColumns: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          pinned_columns: pinnedColumns,
        });
      }
    };

    return toDataDiffGrid(run?.result?.base, run?.result?.current, {
      changedOnly,
      primaryKeys,
      onPrimaryKeyChange: handlePrimaryKeyChanged,
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
    });
  }, [
    run,
    viewOptions,
    changedOnly,
    primaryKeys,
    pinnedColumns,
    onViewOptionsChanged,
  ]);

  const warningPKey = useMemo(() => {
    const pkName = primaryKeys.join(", ");

    if (gridData.invalidPKeyBase && gridData.invalidPKeyCurrent) {
      return `Warning: The primary key '${pkName}' is not unique in the base and current environments`;
    } else if (gridData.invalidPKeyBase) {
      return `Warning: The primary key '${pkName}' is not unique in the base environment`;
    } else if (gridData.invalidPKeyCurrent) {
      return `Warning: The primary key '${pkName}' is not unique in the current environment`;
    }
  }, [gridData.invalidPKeyBase, gridData.invalidPKeyCurrent, primaryKeys]);

  const limit = run.result?.current?.limit || 0;
  const warningLimit =
    limit > 0 && (run?.result?.current?.more || run?.result?.base?.more)
      ? `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`
      : null;

  const warnings: string[] = [];
  if (warningPKey) {
    warnings.push(warningPKey);
  }
  if (warningLimit) {
    warnings.push(warningLimit);
  }

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  if (changedOnly && gridData.rows.length === 0) {
    return (
      <Flex
        direction="column"
        backgroundColor="rgb(249, 249, 249)"
        height={"100%"}
      >
        <RunToolbar
          run={run}
          viewOptions={viewOptions}
          onAddToChecklist={onAddToChecklist}
          onViewOptionsChanged={onViewOptionsChanged}
          warnings={warnings}
        />
        <Center height="100%">No change</Center>;
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      backgroundColor="rgb(249, 249, 249)"
      height={"100%"}
    >
      <RunToolbar
        run={run}
        viewOptions={viewOptions}
        onAddToChecklist={onAddToChecklist}
        onViewOptionsChanged={onViewOptionsChanged}
        warnings={warnings}
      />
      <ScreenshotDataGrid
        ref={ref}
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
        defaultColumnOptions={{
          resizable: true,
          maxWidth: 800,
          minWidth: 35,
        }}
        className="rdg-light"
        enableScreenshot={true}
      />
    </Flex>
  );
};

const _QueryDiffJoinResultView = (
  {
    run,
    onAddToChecklist,
    viewOptions,
    onViewOptionsChanged,
  }: QueryDiffResultViewProps,
  ref: any
) => {
  const changedOnly = useMemo(
    () => viewOptions?.changed_only || false,
    [viewOptions]
  );
  const pinnedColumns = useMemo(
    () => viewOptions?.pinned_columns || [],
    [viewOptions]
  );

  const gridData = useMemo(() => {
    const handlePinnedColumnsChanged = (pinnedColumns: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          pinned_columns: pinnedColumns,
        });
      }
    };

    if (!run.result?.diff || !run?.params?.primary_keys) {
      return { columns: [], rows: [] };
    }

    const primaryKeys = run.params.primary_keys;

    return toQueryDiffJoinGrid(run?.result.diff, primaryKeys, {
      changedOnly,
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
    });
  }, [run, viewOptions, changedOnly, pinnedColumns, onViewOptionsChanged]);

  const limit = run.result?.diff?.limit || 0;
  const warningLimit =
    limit > 0 && run?.result?.diff?.more
      ? `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`
      : null;

  const warnings: string[] = [];
  if (warningLimit) {
    warnings.push(warningLimit);
  }

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  if (changedOnly && gridData.rows.length === 0) {
    return (
      <Flex
        direction="column"
        backgroundColor="rgb(249, 249, 249)"
        height={"100%"}
      >
        <RunToolbar
          run={run}
          viewOptions={viewOptions}
          onAddToChecklist={onAddToChecklist}
          onViewOptionsChanged={onViewOptionsChanged}
          warnings={warnings}
        />
        <Center height="100%">No change</Center>
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      backgroundColor="rgb(249, 249, 249)"
      height={"100%"}
    >
      <RunToolbar
        run={run}
        viewOptions={viewOptions}
        onAddToChecklist={onAddToChecklist}
        onViewOptionsChanged={onViewOptionsChanged}
        warnings={warnings}
      />
      <ScreenshotDataGrid
        ref={ref}
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
        defaultColumnOptions={{
          resizable: true,
          maxWidth: 800,
          minWidth: 35,
        }}
        className="rdg-light"
        enableScreenshot={true}
      />
    </Flex>
  );
};

export const QueryDiffResultView = forwardRef(
  (props: QueryDiffResultViewProps, ref) => {
    if (
      props.run?.result !== undefined &&
      props.run.result.diff !== null &&
      props.run.result.diff !== undefined
    ) {
      const ResultView = forwardRef(_QueryDiffJoinResultView);
      return <ResultView {...props} ref={ref} />;
    } else {
      const ResultView = forwardRef(_QueryDiffResultView);
      return <ResultView {...props} ref={ref} />;
    }
  }
);
