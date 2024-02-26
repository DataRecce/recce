import { HistogramDiffParams } from "@/lib/api/profile"
import { RunEditViewProps } from "../run/types"
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import _ from "lodash";
import { extractColumns } from "../valuediff/ValueDiffEditView";
import { Box, FormControl, FormLabel, Select } from "@chakra-ui/react";

interface HistogramDiffEditProps extends RunEditViewProps<HistogramDiffParams> {}

export function HistogramDiffEditView({
  params,
  onParamsChanged,
  setIsReadyToExecute,
}: HistogramDiffEditProps) {
  const lineageGraph = useLineageGraphsContext();
  const node = _.find(lineageGraph.lineageGraphSets?.all.nodes, {
    name: params?.model,
  });
  const columns = node ? extractColumns(node).filter(c => c.type === 'BIGINT' || c.type === 'INTEGER' || c.type === 'DOUBLE') : [];

  return (
    <Box m="16px">
      <FormControl>
        <FormLabel>Pick a column to show top-k</FormLabel>
        <Select
          placeholder="Select column"
          value={params?.column_name}
          onChange={(e) => {
            const columnName = e.target.value;
            setIsReadyToExecute((!!columnName) ? true : false);
            const columnType = columns.find((c) => c.name === columnName)?.type || "";
            onParamsChanged({ ...params, column_name: columnName, column_type: columnType });
          }}
        >
          {columns.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} : {c.type}
            </option>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
