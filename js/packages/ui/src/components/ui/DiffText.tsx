"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { type ReactNode, useState } from "react";
import { PiCopy } from "react-icons/pi";
import { colors } from "../../theme/colors";

/**
 * Props for the DiffText component
 */
export interface DiffTextProps {
  /** The text value to display */
  value: string;
  /** Color palette for the diff indicator */
  colorPalette: "red" | "green";
  /** Whether to gray out the text (for null/missing values) */
  grayOut?: boolean;
  /** Hide the copy button */
  noCopy?: boolean;
  /** Custom font size */
  fontSize?: string;
  /**
   * Callback when copy button is clicked.
   * If provided, the component will use this for copy functionality.
   * If not provided, uses navigator.clipboard.writeText.
   */
  onCopy?: (value: string) => void;
}

/**
 * DiffText Component
 *
 * Displays a text value with diff styling (red for removed, green for added).
 * Includes an optional copy-to-clipboard button on hover.
 *
 * @example Basic usage
 * ```tsx
 * import { DiffText } from '@datarecce/ui';
 *
 * // Show a value that was added (green)
 * <DiffText value="new_value" colorPalette="green" />
 *
 * // Show a value that was removed (red)
 * <DiffText value="old_value" colorPalette="red" />
 * ```
 *
 * @example With custom copy callback
 * ```tsx
 * <DiffText
 *   value="copy_me"
 *   colorPalette="green"
 *   onCopy={(value) => {
 *     navigator.clipboard.writeText(value);
 *     showToast(`${value} copied!`);
 *   }}
 * />
 * ```
 *
 * @example Grayed out (null value)
 * ```tsx
 * <DiffText value="null" colorPalette="red" grayOut />
 * ```
 */
export function DiffText({
  value,
  colorPalette,
  grayOut,
  noCopy,
  fontSize,
  onCopy,
}: DiffTextProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get the color values from the theme colors
  const textColor = colors[colorPalette][800];
  const bgColor = colors[colorPalette][100];

  return (
    <Box
      sx={{
        display: "flex",
        p: "2px 5px",
        minWidth: "30px",
        maxWidth: "200px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: textColor,
        bgcolor: bgColor,
        alignItems: "center",
        gap: "2px",
        borderRadius: "8px",
        fontSize,
        flexShrink: noCopy ? 0 : "inherit",
      }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      <Box
        sx={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: grayOut ? "gray" : "inherit",
        }}
      >
        {value}
      </Box>

      <CopyControl
        value={value}
        noCopy={noCopy}
        grayOut={grayOut}
        isHovered={isHovered}
        onCopy={onCopy}
      />
    </Box>
  );
}

interface CopyControlProps {
  value: string;
  grayOut?: boolean;
  noCopy?: boolean;
  isHovered: boolean;
  onCopy?: (value: string) => void;
}

function CopyControl({
  value,
  noCopy,
  grayOut,
  isHovered,
  onCopy,
}: CopyControlProps): ReactNode {
  if (noCopy || grayOut || !isHovered) {
    return null;
  }

  const handleCopy = () => {
    if (onCopy) {
      onCopy(value);
    } else {
      // Default to navigator.clipboard if available
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(value);
      }
    }
  };

  return (
    <Tooltip title="Copy Value">
      <IconButton
        aria-label="Copy"
        size="small"
        onClick={handleCopy}
        sx={{
          minWidth: "0.625rem",
          height: "0.625rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 0,
          color: "inherit",
        }}
      >
        <PiCopy size="0.625rem" />
      </IconButton>
    </Tooltip>
  );
}
