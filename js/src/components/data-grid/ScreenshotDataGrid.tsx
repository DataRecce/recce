import "react-data-grid/lib/styles.css";
import { Flex, Text } from "@chakra-ui/react";
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
    <Flex
      h="35px"
      alignItems="center"
      justifyContent="center"
      bg="gray.100"
      style={{ textAlign: "center", gridColumn: "1/-1" }}
    >
      <Text fontWeight="600"> {emptyMessage ?? "No rows"}</Text>
    </Flex>
  );
}
