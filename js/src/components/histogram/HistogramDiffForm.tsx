import { HistogramDiffParams } from "@/lib/api/profile"
import { RunFormProps } from "../run/types"
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import _ from "lodash";
import { extractColumns } from "../valuediff/ValueDiffForm";
import { Box, FormControl, FormLabel, Select } from "@chakra-ui/react";

interface HistogramDiffEditProps extends RunFormProps<HistogramDiffParams> {}

export function HistogramDiffForm({
  params,
  onParamsChanged,
  setIsReadyToExecute,
}: HistogramDiffEditProps) {
  const lineageGraph = useLineageGraphsContext();
  const node = _.find(lineageGraph.lineageGraphSets?.all.nodes, {
    name: params?.model,
  });
  const columns = node ? extractColumns(node).filter(
    c => c.type === 'BIGINT' || c.type === 'INTEGER' || c.type === 'DOUBLE' || c.type === 'DATE') : [];

  return (
    <Box m="16px">
      <FormControl>
        <FormLabel>Pick a column to show Histogram Diff</FormLabel>
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
