import { TopKDiffParams } from "@/lib/api/profile";
import { RunEditViewProps } from "../run/types";
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import _ from "lodash";
import { Box, FormControl, FormLabel, Select } from "@chakra-ui/react";
import { extractColumnNames } from "../valuediff/ValueDiffEditView";


interface TopKDiffEditViewProps extends RunEditViewProps<TopKDiffParams> {}

export function TopKDiffEditView({
  params,
  onParamsChanged,
}: TopKDiffEditViewProps) {
  const lineageGraph = useLineageGraphsContext();
  const node = _.find(lineageGraph.lineageGraphSets?.all.nodes, {
    name: params?.model,
  });
  const columns = node ? extractColumnNames(node) : [];

  return (
    <Box m="16px">
      <FormControl>
        <FormLabel>Pick a column to show top-k</FormLabel>
        <Select
          placeholder="Select column"
          value={params?.column_name}
          onChange={(e) => {
            const column = e.target.value;
            onParamsChanged({ ...params, column_name: column });
          }}
        >
          {columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}

