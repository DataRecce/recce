import { submitRun, waitRun } from "@/lib/api/runs";
import { LineageGraphNode } from "./lineage";
import { Run } from "@/lib/api/types";

export type GetParamsFn = (node: LineageGraphNode) => {
  /* params is the input parameters for the run of a node */
  params?: any;
  /* skipReason is a string that explains why the node is skipped */
  skipReason?: string;
};

export const submitRuns = async (
  nodes: LineageGraphNode[],
  type: string,
  getParams: GetParamsFn,
  onNodeUpdate: (node: LineageGraphNode) => void
) => {
  const selectedNodes = nodes.filter((node) => node.isSelected);
  if (!selectedNodes || selectedNodes.length === 0) {
    return;
  }

  for (const node of selectedNodes) {
    node.action = { status: "pending" };
    onNodeUpdate(node);
  }

  for (const node of selectedNodes) {
    const { params, skipReason } = getParams(node);
    if (skipReason) {
      node.action = {
        status: "skipped",
        skipReason,
      };
      onNodeUpdate(node);
      continue;
    }

    const { run_id } = await submitRun(type, params, { nowait: true });
    node.action = {
      status: "running",
    };
    onNodeUpdate(node);

    while (true) {
      const run = await waitRun(run_id, 2);
      const status = run.error ? "failure" : run.result ? "success" : "running";
      node.action = {
        status,
        run,
      };
      onNodeUpdate(node);

      if (run.error || run.result) {
        break;
      }
    }
  }
};
