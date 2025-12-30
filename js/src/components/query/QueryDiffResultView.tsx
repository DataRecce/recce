import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { ForwardedRef, forwardRef, Ref, useMemo } from "react";
import {
  QueryDiffViewOptions,
  QueryPreviewChangeParams,
} from "@/lib/api/adhocQuery";

import "./styles.css";
import { ColumnRenderMode, Run } from "@/lib/api/types";
import {
  createDataGrid,
  DiffGridOptions,
} from "@/lib/dataGrid/dataGridFactory";
import {
  type DataGridHandle,
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { RunToolbar } from "../run/RunToolbar";
import { RunResultViewProps } from "../run/types";
import { ChangedOnlyCheckbox } from "./ChangedOnlyCheckbox";
import { DiffDisplayModeSwitch } from "./ToggleSwitch";

export interface QueryDiffResultViewProps
  extends RunResultViewProps<QueryDiffViewOptions> {
  onAddToChecklist?: (run: Run) => void;
  baseTitle?: string;
  currentTitle?: string;
}

const PrivateQueryDiffResultView = (
  {
    run,
    onAddToChecklist,
    viewOptions,
    onViewOptionsChanged,
    baseTitle,
    currentTitle,
  }: QueryDiffResultViewProps,

  ref: Ref<DataGridHandle>,
) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const primaryKeys = useMemo(
    () => viewOptions?.primary_keys ?? [],
    [viewOptions],
  );
  const changedOnly = useMemo(
    () => viewOptions?.changed_only ?? false,
    [viewOptions],
  );
  const pinnedColumns = useMemo(
    () => viewOptions?.pinned_columns ?? [],
    [viewOptions],
  );
  const displayMode = useMemo(
    () => viewOptions?.display_mode ?? "inline",
    [viewOptions],
  );
  const columnsRenderMode = useMemo(
    () => viewOptions?.columnsRenderMode ?? {},
    [viewOptions],
  );
  if (run.type !== "query_diff") {
    throw new Error("QueryDiffResult view should be rendered as query_diff");
  }

  const gridData = useMemo(() => {
    const onColumnsRenderModeChanged = (
      cols: Record<string, ColumnRenderMode>,
    ) => {
      const newRenderModes = {
        ...(viewOptions?.columnsRenderMode ?? {}),
        ...cols,
      };
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          columnsRenderMode: newRenderModes,
        });
      }
    };

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
    const options: DiffGridOptions = {
      changedOnly,
      onPrimaryKeyChange: handlePrimaryKeyChanged,
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      columnsRenderMode,
      onColumnsRenderModeChanged,
      baseTitle,
      currentTitle,
      displayMode,
    };

    return createDataGrid(run, options) ?? { columns: [], rows: [] };
  }, [
    run,
    viewOptions,
    changedOnly,
    pinnedColumns,
    displayMode,
    onViewOptionsChanged,
    baseTitle,
    currentTitle,
    columnsRenderMode,
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

  const limit = run.result?.current?.limit ?? 0;
  const warningLimit =
    limit > 0 && (run.result?.current?.more || run.result?.base?.more)
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
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        No data
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        bgcolor: isDark ? "grey.900" : "grey.50",
        height: "100%",
      }}
    >
      <RunToolbar
        run={run}
        viewOptions={viewOptions}
        onViewOptionsChanged={onViewOptionsChanged}
        warnings={warnings}
      >
        <DiffDisplayModeSwitch
          displayMode={displayMode}
          onDisplayModeChanged={(displayMode) => {
            if (onViewOptionsChanged) {
              onViewOptionsChanged({
                ...viewOptions,
                display_mode: displayMode,
              });
            }
          }}
        />

        <ChangedOnlyCheckbox
          changedOnly={viewOptions?.changed_only}
          onChange={() => {
            const changedOnly = !viewOptions?.changed_only;
            if (onViewOptionsChanged) {
              onViewOptionsChanged({
                ...viewOptions,
                changed_only: changedOnly,
              });
            }
          }}
        />
      </RunToolbar>
      <ScreenshotDataGrid
        ref={ref}
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        renderers={{
          noRowsFallback: (
            <EmptyRowsRenderer emptyMessage="No mismatched rows" />
          ),
        }}
        defaultColumnOptions={{
          resizable: true,
          maxWidth: 800,
          minWidth: 35,
        }}
      />
    </Box>
  );
};

const PrivateQueryDiffJoinResultView = (
  {
    run,
    viewOptions,
    onViewOptionsChanged,
    baseTitle,
    currentTitle,
  }: QueryDiffResultViewProps,
  ref: Ref<DataGridHandle>,
) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  if (run.type !== "query_diff") {
    throw new Error("QueryDiffResult view should be rendered as query_diff");
  }
  const changedOnly = useMemo(
    () => viewOptions?.changed_only ?? false,
    [viewOptions],
  );
  const pinnedColumns = useMemo(
    () => viewOptions?.pinned_columns ?? [],
    [viewOptions],
  );
  const displayMode = useMemo(
    () => viewOptions?.display_mode ?? "inline",
    [viewOptions],
  );
  const columnsRenderMode = useMemo(
    () => viewOptions?.columnsRenderMode ?? {},
    [viewOptions],
  );

  const gridData = useMemo(() => {
    const onColumnsRenderModeChanged = (
      cols: Record<string, ColumnRenderMode>,
    ) => {
      const newRenderModes = {
        ...(viewOptions?.columnsRenderMode ?? {}),
        ...cols,
      };
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          columnsRenderMode: newRenderModes,
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

    return (
      createDataGrid(run, {
        changedOnly,
        pinnedColumns,
        onPinnedColumnsChange: handlePinnedColumnsChanged,
        baseTitle,
        currentTitle,
        displayMode,
        columnsRenderMode,
        onColumnsRenderModeChanged,
      }) ?? { columns: [], rows: [] }
    );
  }, [
    run,
    viewOptions,
    changedOnly,
    pinnedColumns,
    displayMode,
    onViewOptionsChanged,
    baseTitle,
    currentTitle,
    columnsRenderMode,
  ]);

  const limit = run.result?.diff?.limit ?? 0;
  const warningLimit =
    limit > 0 && run.result?.diff?.more
      ? `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`
      : null;

  const warnings: string[] = [];
  if (warningLimit) {
    warnings.push(warningLimit);
  }

  if (gridData.columns.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        No data
      </Box>
    );
  }

  if (changedOnly && gridData.rows.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          bgcolor: isDark ? "grey.900" : "grey.50",
          height: "100%",
        }}
      >
        <RunToolbar
          run={run}
          viewOptions={viewOptions}
          onViewOptionsChanged={onViewOptionsChanged}
          warnings={warnings}
        />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          No change
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        bgcolor: isDark ? "grey.900" : "grey.50",
        height: "100%",
      }}
    >
      <RunToolbar
        run={run}
        viewOptions={viewOptions}
        onViewOptionsChanged={onViewOptionsChanged}
        warnings={warnings}
      >
        <DiffDisplayModeSwitch
          displayMode={displayMode}
          onDisplayModeChanged={(displayMode) => {
            if (onViewOptionsChanged) {
              onViewOptionsChanged({
                ...viewOptions,
                display_mode: displayMode,
              });
            }
          }}
        />

        <ChangedOnlyCheckbox
          changedOnly={viewOptions?.changed_only}
          onChange={() => {
            const changedOnly = !viewOptions?.changed_only;
            if (onViewOptionsChanged) {
              onViewOptionsChanged({
                ...viewOptions,
                changed_only: changedOnly,
              });
            }
          }}
        />
      </RunToolbar>
      <ScreenshotDataGrid
        ref={ref}
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        renderers={{
          noRowsFallback: (
            <EmptyRowsRenderer emptyMessage="No mismatched rows" />
          ),
        }}
        defaultColumnOptions={{
          resizable: true,
          maxWidth: 800,
          minWidth: 35,
        }}
      />
    </Box>
  );
};

// Create the forwardRef components here, at module level
const QueryDiffResultViewWithRef = forwardRef(PrivateQueryDiffResultView);
const QueryDiffJoinResultViewWithRef = forwardRef(
  PrivateQueryDiffJoinResultView,
);

export const QueryDiffResultView = forwardRef(
  (props: QueryDiffResultViewProps, ref: ForwardedRef<DataGridHandle>) => {
    let baseTitle;
    let currentTitle;
    if (
      props.run.params &&
      (props.run.params as QueryPreviewChangeParams).current_model
    ) {
      // Configure the base and current titles under Sandbox Editor
      baseTitle = "Original";
      currentTitle = "Editor";
    }
    if (
      props.run.result &&
      "diff" in props.run.result &&
      props.run.result.diff != null
    ) {
      return (
        <QueryDiffJoinResultViewWithRef
          {...props}
          ref={ref}
          baseTitle={baseTitle}
          currentTitle={currentTitle}
        />
      );
    } else {
      return (
        <QueryDiffResultViewWithRef
          {...props}
          ref={ref}
          baseTitle={baseTitle}
          currentTitle={currentTitle}
        />
      );
    }
  },
);
