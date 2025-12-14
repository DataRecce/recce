import { useEffect, useState } from "react";
import ReactSelect from "react-select";
import { Box, Checkbox, Field, Input, VStack } from "@/components/ui/mui";
import useModelColumns from "@/lib/hooks/useModelColumns";
import { RunFormProps } from "../run/types";

export interface ProfileDiffFormParams {
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
    setIsReadyToExecute(!!model);
  }, [model, setIsReadyToExecute]);

  const columnNames = columns.map((c) => c.name);

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
        <Field.Label>Columns</Field.Label>
        <Checkbox.Root
          marginBottom="10px"
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
            onChange={(newValue) => {
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
              container: (base) => ({ ...base, width: "100%" }),
              control: (base) => ({ ...base, minHeight: "40px" }),
            }}
          />
        )}
      </Field.Root>
    </VStack>
  );
}
