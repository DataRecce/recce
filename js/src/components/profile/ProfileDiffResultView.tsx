import { Box, Button, Center, Flex, forwardRef, Icon, Spacer } from "@chakra-ui/react";

import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";

import { ProfileDiffParams, ProfileDiffResult, ProfileDiffViewOptions } from "@/lib/api/profile";
import { useMemo } from "react";
import { toDataDiffGrid } from "../query/querydiff";
import { RunToolbar } from "../run/RunToolbar";

interface ProfileDiffToolbarProps {
  viewOptions?: ProfileDiffViewOptions;
  onViewOptionsChanged?: (viewOptions: ProfileDiffViewOptions) => void;
}

export const ProfileDiffToolbar = ({
  viewOptions,
  onViewOptionsChanged,
}: ProfileDiffToolbarProps) => {
  return (
    <Flex
      borderBottom="1px solid lightgray"
      justifyContent="flex-end"
      gap="5px"
      alignItems="center"
      px="10px">
      <Spacer />
      <Button>Toggle</Button>
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
      displayMode: "inline",
    });
  }, [result, primaryKey, pinnedColumns, viewOptions, onViewOptionsChanged]);

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  return (
    <Flex direction="column" backgroundColor="rgb(249, 249, 249)" height={"100%"}>
      <ProfileDiffToolbar viewOptions={viewOptions} />
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
