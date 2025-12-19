import "react-data-grid/lib/styles.css";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import React, { forwardRef } from "react";
import { DataGrid, DataGridHandle, DataGridProps } from "react-data-grid";
import { RowObjectType } from "@/lib/api/types";

export const ScreenshotDataGrid = forwardRef(
  <R = RowObjectType>(
    { ...props }: DataGridProps<R>,
    ref: React.Ref<DataGridHandle>,
  ) => {
    return (
      <DataGrid
        ref={ref}
        className={
          props.className
            ? props.className + " no-track-pii-safe"
            : "no-track-pii-safe"
        }
        rowClass={() => "no-track-pii-safe"}
        {...props}
      />
    );
  },
) as <R = RowObjectType>(
  props: DataGridProps<R> & { ref?: React.Ref<DataGridHandle> },
) => React.ReactElement;

interface EmptyRowsRendererProps {
  emptyMessage?: string;
}

export function EmptyRowsRenderer({ emptyMessage }: EmptyRowsRendererProps) {
  return (
    <Box
      sx={{
        display: "flex",
        height: "35px",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "grey.100",
        textAlign: "center",
        gridColumn: "1/-1",
      }}
    >
      <Typography sx={{ fontWeight: 600 }}>
        {emptyMessage ?? "No rows"}
      </Typography>
    </Box>
  );
}
