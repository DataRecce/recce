"use client";

import MuiBox from "@mui/material/Box";
import { forwardRef, type ReactNode } from "react";

/**
 * InputGroup Component - MUI equivalent of Chakra's InputGroup
 *
 * A wrapper for grouping Input with addons.
 */

export interface InputGroupProps {
  children?: ReactNode;
  /** Width */
  width?: string | number;
  /** Additional className */
  className?: string;
  /** Element to display at the start */
  startElement?: ReactNode;
  /** Element to display at the end */
  endElement?: ReactNode;
}

export const InputGroup = forwardRef<HTMLDivElement, InputGroupProps>(
  function InputGroup(
    { children, width, className, startElement, endElement },
    ref,
  ) {
    return (
      <MuiBox
        ref={ref}
        className={className}
        sx={{
          display: "flex",
          alignItems: "center",
          position: "relative",
          width: width || "100%",
        }}
      >
        {startElement && (
          <MuiBox sx={{ position: "absolute", left: 8, zIndex: 1 }}>
            {startElement}
          </MuiBox>
        )}
        {children}
        {endElement && (
          <MuiBox sx={{ position: "absolute", right: 8, zIndex: 1 }}>
            {endElement}
          </MuiBox>
        )}
      </MuiBox>
    );
  },
);

export default InputGroup;
