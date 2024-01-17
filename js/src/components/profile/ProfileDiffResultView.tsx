import { Box, Center, Flex, Icon } from "@chakra-ui/react";

import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/RunModal";

import { ProfileDiffParams, ProfileDiffResult } from "@/lib/api/profile";
import { useMemo } from "react";
import { toDataDiffGrid } from "./profilediff";

interface ProfileDiffResultViewProp
  extends RunResultViewProps<ProfileDiffParams, ProfileDiffResult> {}

export function ProfileDiffResultView({ run }: ProfileDiffResultViewProp) {
  const result = run.result;
  const params = run.params;

  const gridData = useMemo(() => {
    return toDataDiffGrid(result?.base, result?.current);
  }, [result]);

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  return (
    <>
      <ScreenshotDataGrid
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        defaultColumnOptions={{ resizable: true, maxWidth: 800, minWidth: 35 }}
        className="rdg-light"
        enableScreenshot={true}
      />
    </>
  );
}
