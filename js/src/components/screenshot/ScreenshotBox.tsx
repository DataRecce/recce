import { Box, BoxProps } from "@chakra-ui/react";
import { useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";

interface ScreenshotBoxProps extends BoxProps {
  children?: React.ReactNode;
}

export const ScreenshotBox = ({
  children,
  ...restProps
}: ScreenshotBoxProps) => {
  const { ref, CopyToClipboardButton } = useCopyToClipboardButton();
  return (
    <>
      <Box ref={ref} {...restProps}>
        {children}
      </Box>
      <CopyToClipboardButton imageType="png" />
    </>
  );
};
