import { TopKDiffParams } from "@/lib/api/profile";
import { RunFormProps } from "../run/types";
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import _ from "lodash";
import { Box, FormControl, FormLabel, Select } from "@chakra-ui/react";
import { extractColumnNames } from "../valuediff/ValueDiffForm";
import { useEffect } from "react";

interface TopKDiffFormProps extends RunFormProps<TopKDiffParams> {}

export function TopKDiffForm({
  params,
  onParamsChanged,
  setIsReadyToExecute,
}: TopKDiffFormProps) {
  const { lineageGraph } = useLineageGraphsContext();
  const node = _.find(lineageGraph?.nodes, {
    name: params?.model,
  });
  const columns = node ? extractColumnNames(node) : [];

  useEffect(() => {
    setIsReadyToExecute(!!params.column_name);
  }, [params, setIsReadyToExecute]);

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
