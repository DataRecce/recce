import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import ReactSelect, {
  type CSSObjectWithLabel,
  type MultiValue,
} from "react-select";
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
    <Stack spacing={5} sx={{ m: "8px 24px", pb: "200px" }}>
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Model
        </Typography>
        <TextField
          fullWidth
          size="small"
          value={params.model}
          slotProps={{ input: { readOnly: true } }}
        />
      </Box>
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Primary key
        </Typography>
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
      </Box>
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Columns
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={allColumns}
              onChange={(e) => {
                setAllColumns(e.target.checked);
                onParamsChanged({
                  ...params,
                  columns: undefined,
                });
              }}
              size="small"
            />
          }
          label="All columns"
          sx={{ mb: "10px" }}
        />
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
      </Box>
    </Stack>
  );
}
