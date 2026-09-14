import type { SchemaCoverage } from "../../api";

export function formatUncheckedNodeText(coverage: SchemaCoverage): string {
  const countText =
    coverage.status === "unknown" && coverage.unchecked_node_count === 0
      ? "The number of unchecked nodes is unknown."
      : `${coverage.unchecked_node_count} ${
          coverage.unchecked_node_count === 1 ? "node was" : "nodes were"
        } not checked.`;
  if (coverage.unchecked_nodes.length === 0) return countText;

  const remaining =
    coverage.unchecked_node_count - coverage.unchecked_nodes.length;
  const sample = coverage.unchecked_nodes.join(", ");
  const overflow =
    coverage.more && remaining > 0
      ? coverage.unchecked_nodes.length === 1
        ? ` and ${remaining} more`
        : `, and ${remaining} more`
      : "";
  return `${countText} Unchecked nodes: ${sample}${overflow}.`;
}
