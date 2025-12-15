import type { BoxProps } from "@mui/material/Box";
import Box from "@mui/material/Box";
import { forwardRef, Ref } from "react";

interface ScreenshotBoxProps extends BoxProps {
  backgroundColor?: string;
  blockSize?: string;
  children?: React.ReactNode;
}

export const ScreenshotBox = forwardRef(
  (
    {
      backgroundColor = "white",
      blockSize,
      children,
      ...restProps
    }: ScreenshotBoxProps,
    ref: Ref<HTMLDivElement>,
  ) => {
    return (
      <Box
        ref={ref}
        {...restProps}
        sx={{ overflowY: "auto", overflowX: "hidden", ...restProps.sx }}
      >
        <Box
          sx={{
            backgroundColor,
            height: "100%",
            blockSize,
          }}
        >
          {children}
        </Box>
      </Box>
    );
  },
);
