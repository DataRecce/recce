import { Box, Field, NativeSelect } from "@chakra-ui/react";
import { useEffect } from "react";
import { TopKDiffParams } from "@/lib/api/profile";
import useModelColumns from "@/lib/hooks/useModelColumns";
import { RunFormProps } from "../run/types";

type TopKDiffFormProps = RunFormProps<TopKDiffParams>;

export function TopKDiffForm({
  params,
  onParamsChanged,
  setIsReadyToExecute,
}: TopKDiffFormProps) {
  const { columns, isLoading, error } = useModelColumns(params.model);
  const columnNames = columns.map((c) => c.name);

  useEffect(() => {
    setIsReadyToExecute(!!params.column_name);
  }, [params, setIsReadyToExecute]);

  if (isLoading) {
    return <Box>Loading...</Box>;
  }

  if (columnNames.length === 0 || error) {
    return (
      <Box>
        Error: Please provide the &apos;catalog.json&apos; to list column
        candidates
      </Box>
    );
  }

  return (
    <Box m="16px">
      <Field.Root>
        <Field.Label>Pick a column to show top-k</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            placeholder="Select column"
            value={params.column_name}
            onChange={(e) => {
              const column = e.target.value;
              onParamsChanged({ ...params, column_name: column });
            }}
          >
            {columnNames.map((c) => (
              <option key={c} value={c} className="no-track-pii-safe">
                {c}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Field.Root>
    </Box>
  );
}
