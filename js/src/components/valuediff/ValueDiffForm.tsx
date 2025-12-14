import { useEffect, useState } from "react";
import ReactSelect, {
  type CSSObjectWithLabel,
  type MultiValue,
} from "react-select";
import { Box, Checkbox, Field, Input, VStack } from "@/components/ui/mui";
import useModelColumns from "@/lib/hooks/useModelColumns";
import { RunFormProps } from "../run/types";

interface ColumnOption {
  label: string;
  value: string;
}

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
        <Input isReadOnly value={params.model} />
      </Field.Root>
      <Field.Root>
        <Field.Label>Primary key</Field.Label>
        <ReactSelect
          placeholder="Select primary key"
          className="no-track-pii-safe"
          isMulti
          closeMenuOnSelect={false}
          options={columnNames.map((c) => ({ label: c, value: c }))}
          value={(primaryKeys ?? [])
            .filter((c): c is string => c !== undefined)
            .map((c) => ({
              label: c,
              value: c,
            }))}
          onChange={(options: MultiValue<ColumnOption>) => {
            const optionsArray = Array.isArray(options) ? options : [];
            onParamsChanged({
              ...params,
              primary_key:
                optionsArray.length == 1
                  ? optionsArray[0].value
                  : optionsArray.map((v) => v.value),
            });
          }}
          styles={{
            container: (base: CSSObjectWithLabel) => ({
              ...base,
              width: "100%",
            }),
            control: (base: CSSObjectWithLabel) => ({
              ...base,
              minHeight: "40px",
            }),
          }}
        />
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
          <ReactSelect
            isMulti
            className="no-track-pii-safe"
            closeMenuOnSelect={false}
            options={columnNames.map((c) => ({ label: c, value: c }))}
            value={(params.columns ?? []).map((c) => ({
              label: c,
              value: c,
            }))}
            onChange={(newValue: MultiValue<ColumnOption>) => {
              let cols: string[] | undefined;
              const newCols = Array.isArray(newValue)
                ? newValue.map((v) => v.value)
                : [];
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
            styles={{
              container: (base: CSSObjectWithLabel) => ({
                ...base,
                width: "100%",
              }),
              control: (base: CSSObjectWithLabel) => ({
                ...base,
                minHeight: "40px",
              }),
            }}
          />
        )}
      </Field.Root>
    </VStack>
  );
}
