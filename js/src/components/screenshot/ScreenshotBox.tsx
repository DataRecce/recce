import { Box, BoxProps } from "@chakra-ui/react";
import { useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";

interface ScreenshotBoxProps extends BoxProps {
  backgroundColor?: string;
  blockSize?: string;
  children?: React.ReactNode;
}

export const ScreenshotBox = ({
  backgroundColor = 'white',
  blockSize,
  children,
  ...restProps
}: ScreenshotBoxProps) => {
  const { ref, CopyToClipboardButton } = useCopyToClipboardButton({ backgroundColor: backgroundColor });

  return (
    <>
      <Box ref={ref} {...restProps} overflow='auto'>
        <Box backgroundColor={backgroundColor} height='100%' blockSize={blockSize}>
          {children}
        </Box>
      </Box>
      <CopyToClipboardButton imageType="png" />
    </>
  );
};
