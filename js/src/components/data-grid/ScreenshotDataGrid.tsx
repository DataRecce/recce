import "react-data-grid/lib/styles.css";
import DataGrid, { DataGridProps } from "react-data-grid";
import { Flex, Text } from "@chakra-ui/react";
import { forwardRef } from "react";

type ScreenshotDataGridProps = DataGridProps<any>;

export const ScreenshotDataGrid = forwardRef(({ ...props }: ScreenshotDataGridProps, ref: any) => {
  return (
    <DataGrid
      ref={ref}
      className={props.className ? props.className + "no-track-pii-safe" : "no-track-pii-safe"}
      rowClass={() => "no-track-pii-safe"}
      {...props}
    />
  );
});

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
