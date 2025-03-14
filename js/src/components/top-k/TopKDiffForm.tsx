import { TopKDiffParams } from "@/lib/api/profile";
import { RunFormProps } from "../run/types";
import { Box, FormControl, FormLabel, Select } from "@chakra-ui/react";
import { useEffect } from "react";
import useModelColumns from "@/lib/hooks/useModelColumns";

type TopKDiffFormProps = RunFormProps<TopKDiffParams>;

export function TopKDiffForm({ params, onParamsChanged, setIsReadyToExecute }: TopKDiffFormProps) {
  const { columns, isLoading, error } = useModelColumns(params.model);
  const columnNames = columns.map((c) => c.name);

  useEffect(() => {
    setIsReadyToExecute(!!params.column_name);
  }, [params, setIsReadyToExecute]);

  if (isLoading) {
    return <Box>Loading...</Box>;
  }

  if (columnNames.length === 0 || error) {
    return <Box>Error: Please provide the &apos;catalog.json&apos; to list column candidates</Box>;
  }

  return (
    <Box m="16px">
      <FormControl>
        <FormLabel>Pick a column to show top-k</FormLabel>
        <Select
          placeholder="Select column"
          value={params.column_name}
          onChange={(e) => {
            const column = e.target.value;
            onParamsChanged({ ...params, column_name: column });
          }}>
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
