import { Check } from "@/lib/api/checks";
import { ProfileDiffDataGrid } from "../lineage/ProfileDiffGrid";
import { Box } from "@chakra-ui/react";
import { ProfileDiffResult } from "@/lib/api/profile";
import { ScreenshotBox } from "../screenshot/ScreenshotBox";

interface ProfileDiffViewProps {
  check: Check;
}

export function ProfileDiffView({ check }: ProfileDiffViewProps) {
  return (
    <Box flex="1" style={{ contain: "size" }}>
      <ScreenshotBox  style={{ maxHeight: "100%", overflow: "auto" }}>
        <ProfileDiffDataGrid
          isFetching={false}
          result={check?.last_run?.result as ProfileDiffResult}
        />
      </ScreenshotBox>
    </Box>
  );
}
