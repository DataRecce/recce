import { RunFormProps } from "../run/types";
import {
  Box,
  Checkbox,
  FormControl,
  FormLabel,
  Input,
  VStack,
} from "@chakra-ui/react";

import { Select } from "chakra-react-select";
import { useEffect, useState } from "react";
import useModelColumns from "@/lib/hooks/useModelColumns";

interface ValueDiffFormParams {
  model: string;
  primary_key?: string | (string | undefined)[];
  columns?: string[];
}

interface ValueDiffFormProp extends RunFormProps<ValueDiffFormParams> {}

export function ValueDiffForm({
  params,
  onParamsChanged,
  setIsReadyToExecute,
}: ValueDiffFormProp) {
  const [allColumns, setAllColumns] = useState<boolean>(
    !params.columns || params.columns.length === 0
  );

  const model = params?.model;
  const primaryKey = params?.primary_key;

  const {
    columns,
    primaryKey: nodePrimaryKey,
    isLoading,
    error,
  } = useModelColumns(params.model);

  useEffect(() => {
    if (!primaryKey && nodePrimaryKey) {
      onParamsChanged({
        ...params,
        primary_key: nodePrimaryKey,
      });
    }
  }, [primaryKey, nodePrimaryKey, params, onParamsChanged]);

  useEffect(() => {
    setIsReadyToExecute(primaryKey && model ? true : false);
  }, [primaryKey, model, setIsReadyToExecute]);

  const columnNames = columns.map((c) => c.name);

  // primaryKey can be array or string, map to array
  const primaryKeys = Array.isArray(primaryKey)
    ? primaryKey
    : !!primaryKey
    ? [primaryKey]
    : undefined;

  if (isLoading) {
    return <Box>Loading...</Box>;
  }

  if (error) {
    return (
      <Box>
        Error: Please provide the catalog.json to list column candidates
      </Box>
    );
  }

  return (
    <VStack gap={5} m="8px 24px" paddingBottom="200px">
      <FormControl>
        <FormLabel>Model</FormLabel>
        <Input isReadOnly={true} value={params?.model} />
      </FormControl>
      <FormControl>
        <FormLabel>Primary key</FormLabel>
        <Select
          placeholder="Select primary key"
          isMulti
          closeMenuOnSelect={false}
          options={(columnNames || []).map((c) => ({ label: c, value: c }))}
          value={(primaryKeys || []).map((c) => ({
            label: c,
            value: c,
          }))}
          onChange={(options) => {
            onParamsChanged({
              ...params,
              primary_key:
                options.length == 1
                  ? options[0].value
                  : options.map((v) => v.value),
            });
          }}
        ></Select>
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
          }}
        >
          All columns
        </Checkbox>
        {!allColumns && (
          <Select
            isMulti
            closeMenuOnSelect={false}
            options={(columnNames || []).map((c) => ({ label: c, value: c }))}
            value={(params.columns || []).map((c) => ({
              label: c,
              value: c,
            }))}
            onChange={(options) => {
              onParamsChanged({
                ...params,
                columns: (options || []).map((v) => v.value),
              });
            }}
          ></Select>
        )}
      </FormControl>
    </VStack>
  );
}
