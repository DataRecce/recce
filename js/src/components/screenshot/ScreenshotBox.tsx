import { Box, BoxProps } from "@chakra-ui/react";
import { useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";

interface ScreenshotBoxProps extends BoxProps {
  children?: React.ReactNode;
}

export const ScreenshotBox = ({
  children,
  ...restProps
}: ScreenshotBoxProps) => {
  const { ref, CopyToClipboardButton } = useCopyToClipboardButton({ backgroundColor: 'white' });
  return (
    <>
      <Box ref={ref} {...restProps} overflow='auto'>
        {children}
      </Box>
      <CopyToClipboardButton imageType="png" />
    </>
  );
};
