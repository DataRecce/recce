"use client";

/**
 * @file HistogramDiffForm.tsx
 * @description Form component for configuring histogram diff parameters
 *
 * This component allows users to select a column for histogram diff comparison.
 * It filters columns to only show numeric columns (excluding string, boolean, and datetime types).
 */

import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import NativeSelect from "@mui/material/NativeSelect";
import type { HistogramDiffParams } from "../../api";
import { useModelColumns } from "../../hooks";
import type { RunFormProps } from "../run";
import { classifyType } from "../ui/DataTypeIcon/classifyType";

// ============================================================================
// Type Utilities
// ============================================================================

function isStringDataType(columnType: string) {
  const stringDataTypes = [
    "CHAR",
    "VARCHAR",
    "TINYTEXT",
    "TEXT",
    "MEDIUMTEXT",
    "LONGTEXT",
    "NCHAR",
    "NVARCHAR",
    "VARCHAR2",
    "NVARCHAR2",
    "CLOB",
    "NCLOB",
    "VARCHAR(MAX)",
    "XML",
    "JSON",
  ];
  // Normalize columnType by removing spaces and converting to uppercase
  const normalizedType = columnType.trim().toUpperCase();

  // Check if columnType is in the predefined list
  if (stringDataTypes.includes(normalizedType)) {
    return true;
  }

  // Match types that have a length specification (e.g., VARCHAR(255))
  const regex = /^(VARCHAR|NVARCHAR|VARCHAR2|NVARCHAR2|CHAR|NCHAR)\(\d+\)$/;
  return regex.test(normalizedType);
}

function isBooleanDataType(columnType: string) {
  const booleanDataTypes = [
    "BOOLEAN", // PostgreSQL, SQLite, and others with native boolean support
    "TINYINT(1)", // MySQL/MariaDB uses TINYINT(1) to represent boolean values
    "BIT", // SQL Server and others use BIT to represent boolean values, where 1 is true and 0 is false
    "NUMBER(1)", // Oracle uses NUMBER(1) where 1 is true and 0 is false, as it does not have a native BOOLEAN type
    "BOOL", // Snowflake and PostgreSQL also support BOOL as an alias for BOOLEAN
  ];
  return booleanDataTypes.includes(columnType.toUpperCase());
}

function isDateTimeType(columnType: string) {
  const category = classifyType(columnType);
  if (["date", "datetime", "time"].includes(category)) {
    return true;
  }

  const normalizedType = columnType.trim().toUpperCase();
  return normalizedType === "YEAR" || normalizedType === "INTERVAL";
}

// ============================================================================
// Public Utilities
// ============================================================================

/**
 * Check if a column type supports histogram diff
 * Returns true for numeric types (excludes string, boolean, and datetime)
 */
export function supportsHistogramDiff(columnType: string) {
  return (
    !isStringDataType(columnType) &&
    !isBooleanDataType(columnType) &&
    !isDateTimeType(columnType)
  );
}

// ============================================================================
// Component
// ============================================================================

type HistogramDiffEditProps = RunFormProps<HistogramDiffParams>;

/**
 * Form component for configuring histogram diff parameters
 *
 * Displays a dropdown to select a column for histogram diff comparison.
 * Only numeric columns are shown (string, boolean, and datetime types are filtered out).
 *
 * @example
 * ```tsx
 * <HistogramDiffForm
 *   params={{ model: "orders", column_name: "" }}
 *   onParamsChanged={(params) => setParams(params)}
 *   setIsReadyToExecute={(ready) => setReady(ready)}
 * />
 * ```
 */
export function HistogramDiffForm({
  params,
  onParamsChanged,
  setIsReadyToExecute,
  onSubmitRequested,
}: HistogramDiffEditProps) {
  const {
    columns: allColumns,
    columnAvailability,
    isLoading,
    error,
  } = useModelColumns(params.model);
  const columns = allColumns.filter(
    (c) =>
      !isStringDataType(c.type) &&
      !isBooleanDataType(c.type) &&
      !isDateTimeType(c.type),
  );
  const isAvailableInBothEnvironments = (columnName: string) => {
    const availability = columnAvailability[columnName];
    return availability?.base === true && availability.current === true;
  };
  const eligibleColumns = columns.filter((column) =>
    isAvailableInBothEnvironments(column.name),
  );

  if (isLoading) {
    return <Box>Loading...</Box>;
  }

  if (allColumns.length === 0 || error) {
    return (
      <Box>
        Error: Please provide the &apos;catalog.json&apos; to list column
        candidates
      </Box>
    );
  }

  return (
    <Box sx={{ m: "16px" }}>
      <FormControl fullWidth disabled={eligibleColumns.length === 0}>
        <FormLabel sx={{ mb: 1 }}>
          Pick a column to show Histogram Diff
        </FormLabel>
        <NativeSelect
          value={params.column_name}
          onChange={(e) => {
            const columnName = e.target.value;
            const selectedColumn = columns.find((c) => c.name === columnName);
            const isEligible =
              selectedColumn !== undefined &&
              isAvailableInBothEnvironments(columnName);
            setIsReadyToExecute(isEligible);
            const columnType = selectedColumn?.type ?? "";
            const nextParams = {
              ...params,
              column_name: columnName,
              column_type: columnType,
            };
            onParamsChanged(nextParams);
            if (isEligible && columnType) {
              onSubmitRequested?.(nextParams as HistogramDiffParams);
            }
          }}
        >
          <option value="">
            {eligibleColumns.length !== 0
              ? "Select column"
              : "No numeric column is available in both environments"}
          </option>
          {columns.map((c) => (
            <option
              key={c.name}
              value={c.name}
              className="no-track-pii-safe"
              disabled={!isAvailableInBothEnvironments(c.name)}
            >
              {c.name} : {c.type}
            </option>
          ))}
        </NativeSelect>
      </FormControl>
    </Box>
  );
}
