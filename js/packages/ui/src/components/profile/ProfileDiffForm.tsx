"use client";

/**
 * @file ProfileDiffForm.tsx
 * @description Form component for configuring profile diff parameters.
 *
 * This component allows users to:
 * - View the model being profiled
 * - Select specific columns to profile (or all columns)
 *
 * Uses the useModelColumns hook from @datarecce/ui/hooks to fetch column metadata.
 */

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
import { useModelColumns } from "../../hooks";
import type { RunFormProps } from "../run";

interface ColumnOption {
  label: string;
  value: string;
}

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
