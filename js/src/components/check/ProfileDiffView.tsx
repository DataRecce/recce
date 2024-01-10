import { Check } from "@/lib/api/checks";
import { ProfileDiffDataGrid } from "../lineage/ProfileDiffGrid";
import { Box } from "@chakra-ui/react";
import { ProfileDiffResult } from "@/lib/api/profile";

interface ProfileDiffViewProps {
  check: Check;
}

export function ProfileDiffView({ check }: ProfileDiffViewProps) {
  return (
    <Box flex="1" style={{ contain: "size" }}>
        <ProfileDiffDataGrid
          isFetching={false}
          result={check?.last_run?.result as ProfileDiffResult}
          enableScreenshot={true}
        />
    </Box>
  );
}
