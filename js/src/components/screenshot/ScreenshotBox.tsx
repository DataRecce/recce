import { Box, BoxProps } from "@chakra-ui/react";
import {
  useCopyToClipboardButton,
  useImageBoardModal,
} from "@/lib/hooks/ScreenShot";
import { useCallback } from "react";

interface ScreenshotBoxProps extends BoxProps {
  backgroundColor?: string;
  blockSize?: string;
  children?: React.ReactNode;
}

export const ScreenshotBox = ({
  backgroundColor = "white",
  blockSize,
  children,
  ...restProps
}: ScreenshotBoxProps) => {
  const { onOpen, setImgBlob, ImageBoardModal } = useImageBoardModal();
  const onClipboardNotDefined = useCallback(
    (blob: Blob) => {
      setImgBlob(blob);
      onOpen();
    },
    [setImgBlob, onOpen]
  );

  const { ref, CopyToClipboardButton } = useCopyToClipboardButton({
    backgroundColor: backgroundColor,
    onClipboardNotDefined,
  });

  return (
    <>
      <Box ref={ref} {...restProps} overflow="auto">
        <Box
          backgroundColor={backgroundColor}
          height="100%"
          blockSize={blockSize}
        >
          {children}
        </Box>
      </Box>
      <CopyToClipboardButton imageType="png" />
      <ImageBoardModal />
    </>
  );
};
