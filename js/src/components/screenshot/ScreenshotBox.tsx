import { Box, BoxProps } from "@chakra-ui/react";
import { forwardRef } from "react";

interface ScreenshotBoxProps extends BoxProps {
  backgroundColor?: string;
  blockSize?: string;
  children?: React.ReactNode;
}

export const ScreenshotBox = forwardRef(
  (
    { backgroundColor = "white", blockSize, children, ...restProps }: ScreenshotBoxProps,
    ref: any,
  ) => {
    return (
      <Box ref={ref} {...restProps} overflowY="auto" overflowX="hidden">
        <Box backgroundColor={backgroundColor} height="100%" blockSize={blockSize}>
          {children}
        </Box>
      </Box>
    );
  },
);
