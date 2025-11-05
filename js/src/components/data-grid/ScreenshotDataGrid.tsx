import "react-data-grid/lib/styles.css";
import { DataGrid, DataGridHandle, DataGridProps } from "react-data-grid";
import { Flex, Text } from "@chakra-ui/react";
import React, { forwardRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScreenshotDataGridProps = DataGridProps<any>;

export const ScreenshotDataGrid = forwardRef(
  ({ ...props }: ScreenshotDataGridProps, ref: React.Ref<DataGridHandle>) => {
    return (
      <DataGrid
        ref={ref}
        className={props.className ? props.className + "no-track-pii-safe" : "no-track-pii-safe"}
        rowClass={() => "no-track-pii-safe"}
        {...props}
      />
    );
  },
);

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
      style={{ textAlign: "center", gridColumn: "1/-1" }}>
      <Text fontWeight="600"> {emptyMessage ?? "No rows"}</Text>
    </Flex>
  );
}
