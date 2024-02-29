import { submitRun, waitRun } from "@/lib/api/runs";
import { LineageGraphNode } from "./lineage";
import { Run } from "@/lib/api/types";

export type GetParamsFn = (node: LineageGraphNode) => {
  params?: any;
  skipReason?: string;
};

export const submitRuns = async (
  nodes: LineageGraphNode[],
  type: string,
  getParams: GetParamsFn,
  onRunUpdate: (node: LineageGraphNode, run: Run) => void
) => {
  const selectedNodes = nodes.filter((node) => node.isSelected);
  if (!selectedNodes || selectedNodes.length === 0) {
    return;
  }

  for (const node of selectedNodes) {
    const { params, skipReason } = getParams(node);
    if (skipReason) {
      continue;
    }

    const { run_id } = await submitRun(type, params, { nowait: true });

    while (true) {
      const run = await waitRun(run_id, 2);
      onRunUpdate(node, run);
      if (run.result || run.error) {
        break;
      }
    }
  }
};
