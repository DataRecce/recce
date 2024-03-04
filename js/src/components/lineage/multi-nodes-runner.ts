import { submitRun, waitRun } from "@/lib/api/runs";
import { LineageGraphNode } from "./lineage";
import { Run } from "@/lib/api/types";
import { on } from "events";

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
  onProgress: (progress: { completed: number; total: number }) => void,
  onNodeUpdated: (node: LineageGraphNode) => void
) => {
  const selectedNodes = nodes.filter((node) => node.isSelected);
  if (!selectedNodes || selectedNodes.length === 0) {
    return;
  }

  for (const node of selectedNodes) {
    node.action = { status: "pending" };
    onNodeUpdated(node);
  }

  let completed = 0;
  const total = selectedNodes.length;
  onProgress({ completed, total });

  for (const node of selectedNodes) {
    const { params, skipReason } = getParams(node);
    if (skipReason) {
      node.action = {
        status: "skipped",
        skipReason,
      };
      onNodeUpdated(node);
    } else {
      try {
        const { run_id } = await submitRun(type, params, { nowait: true });
        node.action = {
          status: "running",
        };
        onNodeUpdated(node);

        while (true) {
          const run = await waitRun(run_id, 2);
          const status = run.error
            ? "failure"
            : run.result
            ? "success"
            : "running";
          node.action = {
            status,
            run,
          };
          onNodeUpdated(node);

          if (run.error || run.result) {
            break;
          }
        }
      } catch (e) {
        // don't need to do anything here, the error will be shown in the summary
      }
    }
    completed++;
    onProgress({ completed, total });
  }
};
