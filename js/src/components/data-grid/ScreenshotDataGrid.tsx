import "react-data-grid/lib/styles.css";
import DataGrid, { DataGridProps } from "react-data-grid";
import { Flex, forwardRef, Text } from "@chakra-ui/react";

interface ScreenshotDataGridProps extends DataGridProps<any> {}

export const ScreenshotDataGrid = forwardRef(({ ...props }: ScreenshotDataGridProps, ref: any) => {
  return (
    <>
      <DataGrid ref={ref} {...props} />
    </>
  );
});

export function EmptyRowsRenderer() {
  return (
    <Flex
      h="35px"
      alignItems="center"
      justifyContent="center"
      bg="gray.100"
      style={{ textAlign: "center", gridColumn: "1/-1" }}>
      <Text fontWeight="600"> No rows</Text>
    </Flex>
  );
}
