"use client";

/**
 * @file ValueDiffForm.tsx
 * @description Form component for configuring value diff parameters.
 *
 * This component allows users to:
 * - View the model being compared
 * - Select primary keys for joining records
 * - Select specific columns to compare (or all columns)
 *
 * Uses the useModelColumns hook from @datarecce/ui/hooks to fetch column metadata.
 */

import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useModelColumns } from "../../hooks";
import type { RunFormProps } from "../run";

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
        <Autocomplete
          multiple
          size="small"
          disableCloseOnSelect
          options={columnNames}
          value={(primaryKeys ?? []).filter(
            (c): c is string => c !== undefined,
          )}
          onChange={(_, newValue) => {
            onParamsChanged({
              ...params,
              primary_key: newValue.length === 1 ? newValue[0] : newValue,
            });
          }}
          renderInput={(inputProps) => (
            <TextField
              {...inputProps}
              placeholder={
                (primaryKeys ?? []).length === 0 ? "Select primary key" : ""
              }
              className="no-track-pii-safe"
            />
          )}
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
          <Autocomplete
            multiple
            size="small"
            disableCloseOnSelect
            options={columnNames}
            value={params.columns ?? []}
            onChange={(_, newValue) => {
              onParamsChanged({
                ...params,
                columns: newValue.length === 0 ? undefined : newValue,
              });
            }}
            renderInput={(inputProps) => (
              <TextField
                {...inputProps}
                placeholder={
                  (params.columns ?? []).length === 0 ? "Select columns" : ""
                }
                className="no-track-pii-safe"
              />
            )}
          />
        )}
      </Box>
    </Stack>
  );
}
