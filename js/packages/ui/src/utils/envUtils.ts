/**
 * @file envUtils.ts
 * @description Environment information utilities for extracting data from lineage graphs.
 */

import type { LineageGraph, LineageGraphNode } from "../contexts/lineage";

/**
 * Extract unique schema names from the lineage graph.
 *
 * Iterates through all nodes in the lineage graph and collects
 * unique schema names from both base and current environments.
 *
 * `data.schema` describes the current environment and `data.baseSchema` the
 * base one; they only differ when the two environments live in different
 * schemas. Reading a single field for both sets is the DRC-3975 regression —
 * it showed the current schema in the panel's Base column for every project.
 *
 * @param lineageGraph - The lineage graph data
 * @returns Tuple of [baseSchemas, currentSchemas] as Sets
 *
 * @example
 * ```ts
 * const { lineageGraph } = useLineageGraphContext();
 * const [baseSchemas, currentSchemas] = extractSchemas(lineageGraph);
 *
 * console.log(baseSchemas);    // Set { "schema_v1", "public" }
 * console.log(currentSchemas); // Set { "schema_v2", "public" }
 * ```
 */
export function extractSchemas(
  lineageGraph: LineageGraph | undefined,
): [Set<string>, Set<string>] {
  const baseSchemas = new Set<string>();
  const currentSchemas = new Set<string>();

  if (lineageGraph?.nodes) {
    const nodes: LineageGraphNode[] = Object.values(lineageGraph.nodes);
    for (const node of nodes) {
      const baseSchema = node.data.baseSchema ?? node.data.schema;
      if (baseSchema && node.data.changeStatus !== "added") {
        baseSchemas.add(baseSchema);
      }
      if (node.data.schema && node.data.changeStatus !== "removed") {
        currentSchemas.add(node.data.schema);
      }
    }
  }
  return [baseSchemas, currentSchemas];
}
