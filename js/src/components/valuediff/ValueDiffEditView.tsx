import { ValueDiffParams } from "@/lib/api/valuediff";
import { RunEditViewProps } from "../run/types";
import { Box, FormControl, FormLabel, Select } from "@chakra-ui/react";
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import { LineageGraphNode, NodeData } from "../lineage/lineage";
import _ from "lodash";

interface ValueDiffEditViewProp extends RunEditViewProps<ValueDiffParams> {}

export function extractColumnNames(node: LineageGraphNode) {
  function getNames(nodeData: NodeData) {
    return nodeData && nodeData.columns
      ? Object.values(nodeData.columns).map((column) => column.name)
      : [];
  }

  const baseColumns = getNames(node.data.base!!);
  const currentColumns = getNames(node.data.current!!);

  // keep the columns order
  const union: string[] = [];
  baseColumns.forEach((column) => {
    if (!union.includes(column)) {
      union.push(column);
    }
  });
  currentColumns.forEach((column) => {
    if (!union.includes(column)) {
      union.push(column);
    }
  });

  return union;
}

export function ValueDiffEditView({
  params,
  onParamsChanged,
}: ValueDiffEditViewProp) {
  const lineageGraph = useLineageGraphsContext();
  const node = _.find(lineageGraph.lineageGraphSets?.all.nodes, {
    name: params?.model,
  });

  const columnNames = node ? extractColumnNames(node) : [];

  return (
    <Box m="16px">
      <FormControl>
        <FormLabel>Pick a primary key</FormLabel>
        <Select
          placeholder="Select primary key"
          value={params?.primary_key}
          onChange={(e) => {
            const primaryKey = e.target.value;
            onParamsChanged({ ...params, primary_key: primaryKey });
          }}
        >
          {columnNames.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
