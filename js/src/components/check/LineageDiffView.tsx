import { Check } from "@/lib/api/checks";
import LineageView from "../lineage/LineageView";
import { Flex } from "@chakra-ui/react";

export interface LineageDiffViewProps {
  check: Check;
}

export function LineageDiffView({ check }: LineageDiffViewProps) {
  const viewOptions = { ...check.params, ...check.view_options };

  return (
    <Flex direction="column" height="100%">
      <LineageView viewOptions={viewOptions} interactive={false} />
    </Flex>
  );
}
