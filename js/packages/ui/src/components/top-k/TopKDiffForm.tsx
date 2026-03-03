"use client";

/**
 * @file TopKDiffForm.tsx
 * @description Form component for Top-K diff parameters.
 *
 * This component allows users to select a column for top-K analysis.
 * It displays a dropdown of available columns from the model and
 * requires catalog.json to be available for column listing.
 */

import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import NativeSelect from "@mui/material/NativeSelect";
import { useEffect } from "react";
import type { TopKDiffParams } from "../../api";
import { useModelColumns } from "../../hooks";
import type { RunFormProps } from "../run";

type TopKDiffFormProps = RunFormProps<TopKDiffParams>;

export function TopKDiffForm({
  params,
  onParamsChanged,
  setIsReadyToExecute,
}: TopKDiffFormProps) {
  const { columns, isLoading, error } = useModelColumns(params.model);
  const columnNames = columns.map((c) => c.name);

  useEffect(() => {
    setIsReadyToExecute(!!params.column_name);
  }, [params, setIsReadyToExecute]);

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
    <Box sx={{ m: "16px" }}>
      <FormControl fullWidth>
        <FormLabel sx={{ mb: 1 }}>Pick a column to show top-k</FormLabel>
        <NativeSelect
          value={params.column_name}
          onChange={(e) => {
            const column = e.target.value;
            onParamsChanged({ ...params, column_name: column });
          }}
        >
          <option value="">Select column</option>
          {columnNames.map((c) => (
            <option key={c} value={c} className="no-track-pii-safe">
              {c}
            </option>
          ))}
        </NativeSelect>
      </FormControl>
    </Box>
  );
}
