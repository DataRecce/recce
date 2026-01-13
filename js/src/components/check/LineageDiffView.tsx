import { type Check, type LineageDiffViewOptions } from "@datarecce/ui/api";
import {
  LineageViewOss as LineageView,
  type LineageViewRef,
} from "@datarecce/ui/components/lineage/LineageViewOss";
import Box from "@mui/material/Box";
import { ReactFlowProvider } from "@xyflow/react";
import { forwardRef, Ref } from "react";

export interface LineageDiffViewProps {
  check: Check;
}

function _LineageDiffView(
  { check }: LineageDiffViewProps,
  ref: Ref<LineageViewRef>,
) {
  const viewOptions = {
    ...(check.params as Record<string, unknown>),
    ...(check.view_options as LineageDiffViewOptions),
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ReactFlowProvider>
        <LineageView viewOptions={viewOptions} interactive={false} ref={ref} />
      </ReactFlowProvider>
    </Box>
  );
}

export const LineageDiffView = forwardRef<LineageViewRef, LineageDiffViewProps>(
  _LineageDiffView,
);
