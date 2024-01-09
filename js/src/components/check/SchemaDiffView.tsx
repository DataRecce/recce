import { Check } from "@/lib/api/checks";
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import { SchemaView } from "../schema/SchemaView";

interface SchemaDiffViewProps {
  check: Check;
}

export interface SchemaDiffParams {
  node_id: string;
}

export function SchemaDiffView({ check }: SchemaDiffViewProps)  {
  const { lineageGraphSets } = useLineageGraphsContext();
  const params = check.params as SchemaDiffParams;
  const id = params.node_id;
  const node = id ? lineageGraphSets?.all.nodes[id] : undefined;
  if (node) {
    return <SchemaView base={node.data.base} current={node.data.current} enableScreenShot={true} />;
  }
  // TODO: handle the edge case where the node is not found
  return <></>;
}
