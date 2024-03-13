import "react-data-grid/lib/styles.css";
import DataGrid, { DataGridProps } from "react-data-grid";
import { Flex, Text } from "@chakra-ui/react";
import {
  useCopyToClipboardButton,
  useImageBoardModal,
} from "@/lib/hooks/ScreenShot";
import { useCallback } from "react";

interface ScreenshotDataGridProps extends DataGridProps<any> {
  enableScreenshot?: boolean;
}

export function ScreenshotDataGrid({
  enableScreenshot = true,
  ...props
}: ScreenshotDataGridProps) {
  const { onOpen, setImgBlob, ImageBoardModal } = useImageBoardModal();
  const onClipboardNotDefined = useCallback(
    (blob: Blob) => {
      setImgBlob(blob);
      onOpen();
    },
    [setImgBlob, onOpen]
  );
  const { ref, CopyToClipboardButton } = useCopyToClipboardButton({
    onClipboardNotDefined,
  });
  return (
    <>
      <DataGrid ref={ref} {...props} />
      {enableScreenshot && (
        <>
          <CopyToClipboardButton imageType="png" />
          <ImageBoardModal />
        </>
      )}
    </>
  );
}

export function EmptyRowsRenderer() {
  return (
    <Flex
      h="35px"
      alignItems="center"
      justifyContent="center"
      bg="gray.100"
      style={{ textAlign: "center", gridColumn: "1/-1" }}
    >
      <Text fontWeight="600"> No rows</Text>
    </Flex>
  );
}
