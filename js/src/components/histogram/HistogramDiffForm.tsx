import { HistogramDiffParams } from "@/lib/api/profile"
import { RunFormProps } from "../run/types"
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import _ from "lodash";
import { extractColumns } from "../valuediff/ValueDiffForm";
import { Box, FormControl, FormLabel, Select } from "@chakra-ui/react";


function isStringDataType(columnType: string) {
  const stringDataTypes = [
    "CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT",
    "NCHAR", "NVARCHAR", "VARCHAR2", "NVARCHAR2", "CLOB", "NCLOB",
    "VARCHAR(MAX)", "XML", "JSON"
  ];
  return stringDataTypes.includes(columnType.toUpperCase());
}

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
    c => !isStringDataType(c.type)) : [];

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