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

import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import ReactSelect, {
  type CSSObjectWithLabel,
  type MultiValue,
} from "react-select";
import { useIsDark, useModelColumns } from "../../hooks";
import { colors } from "../../theme";
import type { RunFormProps } from "../run";

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
  const isDark = useIsDark();
  const [allColumns, setAllColumns] = useState<boolean>(
    !params.columns || params.columns.length === 0,
  );

  const model = params.model;
  const primaryKey = params.primary_key;

  const selectStyles = useMemo(
    () => ({
      container: (base: CSSObjectWithLabel) => ({
        ...base,
        width: "100%",
      }),
      control: (base: CSSObjectWithLabel) => ({
        ...base,
        minHeight: "40px",
        backgroundColor: isDark ? colors.neutral[700] : base.backgroundColor,
        borderColor: isDark ? colors.neutral[600] : base.borderColor,
      }),
      menu: (base: CSSObjectWithLabel) => ({
        ...base,
        backgroundColor: isDark ? colors.neutral[700] : base.backgroundColor,
      }),
      option: (
        base: CSSObjectWithLabel,
        state: { isFocused: boolean; isSelected: boolean },
      ) => ({
        ...base,
        backgroundColor: state.isSelected
          ? isDark
            ? colors.neutral[600]
            : colors.iochmara[500]
          : state.isFocused
            ? isDark
              ? colors.neutral[600]
              : colors.iochmara[50]
            : isDark
              ? colors.neutral[700]
              : base.backgroundColor,
        color: isDark ? colors.neutral[200] : base.color,
      }),
      multiValue: (base: CSSObjectWithLabel) => ({
        ...base,
        backgroundColor: isDark ? colors.neutral[600] : base.backgroundColor,
      }),
      multiValueLabel: (base: CSSObjectWithLabel) => ({
        ...base,
        color: isDark ? colors.neutral[200] : base.color,
      }),
      multiValueRemove: (base: CSSObjectWithLabel) => ({
        ...base,
        color: isDark ? colors.neutral[400] : base.color,
        "&:hover": {
          backgroundColor: isDark ? colors.neutral[500] : colors.red[200],
          color: isDark ? colors.neutral[200] : colors.red[600],
        },
      }),
      input: (base: CSSObjectWithLabel) => ({
        ...base,
        color: isDark ? colors.neutral[200] : base.color,
      }),
      singleValue: (base: CSSObjectWithLabel) => ({
        ...base,
        color: isDark ? colors.neutral[200] : base.color,
      }),
      placeholder: (base: CSSObjectWithLabel) => ({
        ...base,
        color: isDark ? colors.neutral[400] : base.color,
      }),
    }),
    [isDark],
  );

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
          styles={selectStyles}
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
            styles={selectStyles}
          />
        )}
      </Box>
    </Stack>
  );
}
