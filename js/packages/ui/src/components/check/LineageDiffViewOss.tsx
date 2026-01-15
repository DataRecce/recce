import Box from "@mui/material/Box";
import { ReactFlowProvider } from "@xyflow/react";
import { forwardRef, Ref } from "react";
import type { Check, LineageDiffViewOptions } from "../../api";
import type { LineageViewRef } from "../lineage/LineageViewOss";
import { LineageViewOss as LineageView } from "../lineage/LineageViewOss";

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

export const LineageDiffViewOss = forwardRef<
  LineageViewRef,
  LineageDiffViewProps
>(_LineageDiffView);
