import { Check } from "@/lib/api/checks";
import LineageView from "../lineage/LineageView";
import { Flex } from "@chakra-ui/react";


export interface LineageDiffViewProps {
  check: Check;
}

export function LineageDiffView({ check }: LineageDiffViewProps) {
  const viewMode = check.params?.view_mode || "";

  return (
    <Flex direction="column" height="100%">
      <LineageView
        viewMode={viewMode}
        interactive={false}
        filterNodes={(nodeId) => {
          return check.params?.node_ids?.includes(nodeId);
        }}
      />
    </Flex>
  );
}
