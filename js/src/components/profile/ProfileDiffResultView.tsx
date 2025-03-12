import { Center, Flex, forwardRef, Spacer } from "@chakra-ui/react";

import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";

import { ProfileDiffParams, ProfileDiffResult, ProfileDiffViewOptions } from "@/lib/api/profile";
import { useMemo } from "react";
import { DiffText, toDataDiffGrid } from "../query/querydiff";

import { ToggleSwitch } from "./ToggleSwitch";

interface ProfileDiffToolbarProps {
  viewOptions?: ProfileDiffViewOptions;
  onViewOptionsChanged?: (viewOptions: ProfileDiffViewOptions) => void;
}

const ProfileDiffToolbar = ({ viewOptions, onViewOptionsChanged }: ProfileDiffToolbarProps) => {
  const displayMode = viewOptions?.display_mode ?? "inline";

  return (
    <Flex
      minHeight="32px"
      borderBottom="1px solid lightgray"
      justifyContent="flex-end"
      gap="10px"
      alignItems="center"
      px="10px">
      <Spacer />
      {displayMode === "inline" && (
        <>
          <DiffText value="Base" colorScheme="red" grayOut={false} fontSize="10pt" noCopy />
          <DiffText value="Current" colorScheme="green" grayOut={false} fontSize="10pt" noCopy />
        </>
      )}
      <ToggleSwitch
        value={displayMode === "side_by_side"}
        onChange={(value) => {
          if (onViewOptionsChanged) {
            onViewOptionsChanged({
              ...viewOptions,
              display_mode: value ? "side_by_side" : "inline",
            });
          }
        }}
        textOff="Inline"
        textOn="Side by side"
      />
    </Flex>
  );
};

interface ProfileDiffResultViewProp
  extends RunResultViewProps<ProfileDiffParams, ProfileDiffResult, ProfileDiffViewOptions> {}

const PrivateProfileDiffResultView = (
  { run, viewOptions, onViewOptionsChanged }: ProfileDiffResultViewProp,
  ref: any,
) => {
  const result = run.result;
  const params = run.params;
  const pinnedColumns = useMemo(() => viewOptions?.pinned_columns || [], [viewOptions]);

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
      displayMode: viewOptions?.display_mode ?? "inline",
    });
  }, [result, primaryKey, pinnedColumns, viewOptions, onViewOptionsChanged]);

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  return (
    <Flex direction="column" backgroundColor="rgb(249, 249, 249)" height={"100%"}>
      <ProfileDiffToolbar viewOptions={viewOptions} onViewOptionsChanged={onViewOptionsChanged} />
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
