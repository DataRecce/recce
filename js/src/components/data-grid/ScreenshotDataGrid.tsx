import "react-data-grid/lib/styles.css";
import DataGrid, { DataGridProps } from "react-data-grid";
import { Flex, forwardRef, Text } from "@chakra-ui/react";

type ScreenshotDataGridProps = DataGridProps<any>;

export const ScreenshotDataGrid = forwardRef(({ ...props }: ScreenshotDataGridProps, ref: any) => {
  return (
    <>
      <DataGrid ref={ref} {...props} />
    </>
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
      <Text fontWeight="600"> {emptyMessage ? emptyMessage : "No rows"}</Text>
    </Flex>
  );
}
