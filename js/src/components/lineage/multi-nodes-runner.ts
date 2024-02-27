import { submitRun, waitRun } from "@/lib/api/runs";
import { LineageGraphNode } from "./lineage";
import { Run } from "@/lib/api/types";

export const submitRuns = async (
  nodes: LineageGraphNode[],
  type: string,
  getParams: (node: LineageGraphNode) => any,
  onRunUpdate: (node: LineageGraphNode, run: Run) => void
) => {
  const selectedNodes = nodes.filter((node) => node.isSelected);
  if (!selectedNodes || selectedNodes.length === 0) {
    return;
  }

  for (const node of selectedNodes) {
    const params = getParams(node);
    const { run_id } = await submitRun(type, params, { nowait: true });
    const run = await waitRun(run_id, 2 * 1000);
    onRunUpdate(node, run);
  }
};
