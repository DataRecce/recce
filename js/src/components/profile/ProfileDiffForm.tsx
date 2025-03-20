import { RunFormProps } from "../run/types";
import { useEffect, useState } from "react";
import useModelColumns from "@/lib/hooks/useModelColumns";
import { Select } from "chakra-react-select";
import { Box, Checkbox, FormControl, FormLabel, Input, VStack } from "@chakra-ui/react";

interface ProfileDiffFormParams {
  model: string;
  primary_key?: string | (string | undefined)[];
  columns?: string[];
}

type ProfileDiffFormProp = RunFormProps<ProfileDiffFormParams>;

export function ProfileDiffForm({
  params,
  onParamsChanged,
  setIsReadyToExecute,
}: ProfileDiffFormProp) {
  const [allColumns, setAllColumns] = useState<boolean>(
    !params.columns || params.columns.length === 0,
  );

  const model = params.model;

  const { columns, isLoading, error } = useModelColumns(params.model);

  useEffect(() => {
    setIsReadyToExecute(model ? true : false);
  }, [model, setIsReadyToExecute]);

  const columnNames = columns.map((c) => c.name);

  if (isLoading) {
    return <Box>Loading...</Box>;
  }

  if (columnNames.length === 0 || error) {
    return <Box>Error: Please provide the &apos;catalog.json&apos; to list column candidates</Box>;
  }

  return (
    <VStack gap={5} m="8px 24px" paddingBottom="200px">
      <FormControl>
        <FormLabel>Model</FormLabel>
        <Input isReadOnly={true} value={params.model} />
      </FormControl>
      <FormControl>
        <FormLabel>Columns</FormLabel>
        <Checkbox
          marginBottom="10px"
          isChecked={allColumns}
          onChange={(e) => {
            setAllColumns(e.target.checked);
            onParamsChanged({
              ...params,
              columns: undefined,
            });
          }}>
          All columns
        </Checkbox>
        {!allColumns && (
          <Select
            isMulti
            closeMenuOnSelect={false}
            options={columnNames.map((c) => ({ label: c, value: c }))}
            value={(params.columns ?? []).map((c) => ({
              label: c,
              value: c,
            }))}
            onChange={(newValue) => {
              let cols: string[] | undefined;
              const newCols = newValue.map((v) => v.value);
              if (newCols.length === 0) {
                cols = undefined;
              } else {
                cols = newCols;
              }
              onParamsChanged({
                ...params,
                columns: cols,
              });
            }}></Select>
        )}
      </FormControl>
    </VStack>
  );
}
