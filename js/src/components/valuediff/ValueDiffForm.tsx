import { Box, Checkbox, Field, Input, VStack } from "@chakra-ui/react";
import { Select } from "chakra-react-select";
import { useEffect, useState } from "react";
import useModelColumns from "@/lib/hooks/useModelColumns";
import { RunFormProps } from "../run/types";

export interface ValueDiffFormParams {
  model: string;
  primary_key?: string | (string | undefined)[];
  columns?: string[];
}

type ValueDiffFormProp = RunFormProps<ValueDiffFormParams>;

export function ValueDiffForm({
  params,
  onParamsChanged,
  setIsReadyToExecute,
}: ValueDiffFormProp) {
  const [allColumns, setAllColumns] = useState<boolean>(
    !params.columns || params.columns.length === 0,
  );

  const model = params.model;
  const primaryKey = params.primary_key;

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
    setIsReadyToExecute(!!(primaryKey && model));
  }, [primaryKey, model, setIsReadyToExecute]);

  const columnNames = columns.map((c) => c.name);

  // primaryKey can be an array or string, map to array
  const primaryKeys = Array.isArray(primaryKey)
    ? primaryKey
    : primaryKey
      ? [primaryKey]
      : undefined;

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
    <VStack gap={5} m="8px 24px" paddingBottom="200px">
      <Field.Root>
        <Field.Label>Model</Field.Label>
        <Input readOnly={true} value={params.model} />
      </Field.Root>
      <Field.Root>
        <Field.Label>Primary key</Field.Label>
        <Select
          placeholder="Select primary key"
          className="no-track-pii-safe"
          isMulti
          closeMenuOnSelect={false}
          options={columnNames.map((c) => ({ label: c, value: c }))}
          value={(primaryKeys ?? []).map((c) => ({
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
      </Field.Root>
      <Field.Root>
        <Field.Label>Columns</Field.Label>
        <Checkbox.Root
          marginBottom="10px"
          size="xs"
          checked={allColumns}
          onCheckedChange={(e) => {
            setAllColumns(Boolean(e.checked));
            onParamsChanged({
              ...params,
              columns: undefined,
            });
          }}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label>All columns</Checkbox.Label>
        </Checkbox.Root>
        {!allColumns && (
          <Select
            isMulti
            className="no-track-pii-safe"
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
            }}
          ></Select>
        )}
      </Field.Root>
    </VStack>
  );
}
