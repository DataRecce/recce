import { Check } from "@/lib/api/checks";
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import { SchemaView } from "../schema/SchemaView";

interface SchemaDiffViewProps {
  check: Check;
}

export function SchemaDiffView({ check }: SchemaDiffViewProps)  {
  const { lineageGraphSets } = useLineageGraphsContext();
  const id = check.type === "schema_diff" ? (check.params as any).model_id : undefined;
  const node = id ? lineageGraphSets?.all.nodes[id] : undefined;
  if (node) {
    return <SchemaView base={node.data.base} current={node.data.current} />;
  }
}
