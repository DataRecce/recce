import { Center, Flex, forwardRef, Spacer } from "@chakra-ui/react";

import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";

import { ProfileDiffParams, ProfileDiffResult, ProfileDiffViewOptions } from "@/lib/api/profile";
import { useMemo } from "react";
import { toDataDiffGrid } from "../query/querydiff";
import { RunToolbar } from "../run/RunToolbar";
import { DiffDislayModeSwitch } from "../query/ToggleSwitch";
import { display } from "html2canvas/dist/types/css/property-descriptors/display";

interface ProfileDiffResultViewProp
  extends RunResultViewProps<ProfileDiffParams, ProfileDiffResult, ProfileDiffViewOptions> {}

const PrivateProfileDiffResultView = (
  { run, viewOptions, onViewOptionsChanged }: ProfileDiffResultViewProp,
  ref: any,
) => {
  const result = run.result;
  const pinnedColumns = useMemo(() => viewOptions?.pinned_columns || [], [viewOptions]);
  const displayMode = useMemo(() => viewOptions?.display_mode || "inline", [viewOptions]);

  const field = (result?.current?.columns || []).find(
    (f) => f.name.toLowerCase() === "column_name",
  );
  const primaryKey = field?.name || "column_name";

  const gridData = useMemo(() => {
    const handlePinnedColumnsChanged = (pinnedColumns: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          pinned_columns: pinnedColumns,
        });
      }
    };

    return toDataDiffGrid(result?.base, result?.current, {
      primaryKeys: [primaryKey],
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      displayMode,
    });
  }, [result, primaryKey, pinnedColumns, displayMode, viewOptions, onViewOptionsChanged]);

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  return (
    <Flex direction="column" backgroundColor="rgb(249, 249, 249)" height={"100%"}>
      <RunToolbar run={run}>
        <DiffDislayModeSwitch
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
      </RunToolbar>
      <ScreenshotDataGrid
        ref={ref}
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        defaultColumnOptions={{ resizable: true, maxWidth: 800, minWidth: 35 }}
        className="rdg-light"
        enableScreenshot={true}
      />
    </Flex>
  );
};

export const ProfileDiffResultView = forwardRef(PrivateProfileDiffResultView);
