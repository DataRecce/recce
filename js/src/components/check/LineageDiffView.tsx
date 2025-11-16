import { Flex } from "@chakra-ui/react";
import { ReactFlowProvider } from "@xyflow/react";
import { forwardRef, Ref } from "react";
import { Check } from "@/lib/api/checks";
import { LineageDiffViewOptions } from "@/lib/api/lineagecheck";
import { LineageView, LineageViewRef } from "../lineage/LineageView";

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
    <Flex direction="column" height="100%">
      <ReactFlowProvider>
        <LineageView viewOptions={viewOptions} interactive={false} ref={ref} />
      </ReactFlowProvider>
    </Flex>
  );
}

export const LineageDiffView = forwardRef<LineageViewRef, LineageDiffViewProps>(
  _LineageDiffView,
);
