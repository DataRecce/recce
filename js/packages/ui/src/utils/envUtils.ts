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
      if (node.data.data.base?.schema) {
        baseSchemas.add(node.data.data.base.schema);
      }
      if (node.data.data.current?.schema) {
        currentSchemas.add(node.data.data.current.schema);
      }
    }
  }
  return [baseSchemas, currentSchemas];
}
