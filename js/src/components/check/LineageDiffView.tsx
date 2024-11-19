import { Check } from "@/lib/api/checks";
import { LineageView, LineageViewRef } from "../lineage/LineageView";
import { Flex } from "@chakra-ui/react";
import { ReactFlowProvider } from "reactflow";
import { forwardRef, Ref } from "react";

export interface LineageDiffViewProps {
  check: Check;
}

function _LineageDiffView(
  { check }: LineageDiffViewProps,
  ref: Ref<LineageViewRef>
) {
  const viewOptions = { ...check.params, ...check.view_options };

  return (
    <Flex direction="column" height="100%">
      <ReactFlowProvider>
        <LineageView viewOptions={viewOptions} interactive={false} ref={ref} />
      </ReactFlowProvider>
    </Flex>
  );
}

export const LineageDiffView = forwardRef<LineageViewRef, LineageDiffViewProps>(
  _LineageDiffView
);
