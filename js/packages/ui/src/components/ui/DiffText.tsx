"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { type ReactNode, useState } from "react";
import { PiCopy } from "react-icons/pi";
import { useIsDark } from "../../hooks/useIsDark";
import { type ComparisonRole, getSemanticColorTheme } from "../../theme";
import { colors } from "../../theme/colors";

export interface DiffTextCommonProps {
  /** The text value to display */
  value: string;
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

export interface DiffTextSemanticProps {
  comparisonRole: ComparisonRole;
  colorPalette?: never;
}

export interface DiffTextLegacyProps {
  comparisonRole?: never;
  /** @deprecated Use comparisonRole="base" or comparisonRole="current". */
  colorPalette: "red" | "green";
}

/** Props for the DiffText component. */
export type DiffTextProps = DiffTextCommonProps &
  (DiffTextSemanticProps | DiffTextLegacyProps);

/**
 * DiffText Component
 *
 * Displays a text value with semantic diff styling for base and current values.
 * Includes an optional copy-to-clipboard button on hover.
 *
 * @example Basic usage
 * ```tsx
 * import { DiffText } from '@datarecce/ui';
 *
 * // Show a current value
 * <DiffText value="new_value" comparisonRole="current" />
 *
 * // Show a base value
 * <DiffText value="old_value" comparisonRole="base" />
 * ```
 *
 * @example With custom copy callback
 * ```tsx
 * <DiffText
 *   value="copy_me"
 *   comparisonRole="current"
 *   onCopy={(value) => {
 *     navigator.clipboard.writeText(value);
 *     showToast(`${value} copied!`);
 *   }}
 * />
 * ```
 *
 * @example Grayed out (null value)
 * ```tsx
 * <DiffText value="null" comparisonRole="base" grayOut />
 * ```
 */
export function DiffText({
  value,
  comparisonRole,
  colorPalette,
  grayOut,
  noCopy,
  fontSize,
  onCopy,
}: DiffTextProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isDark = useIsDark();
  const semantic = getSemanticColorTheme(isDark);

  const { bgColor, textColor } = comparisonRole
    ? {
        textColor: semantic.comparison[comparisonRole].foreground,
        bgColor: semantic.comparison[comparisonRole].background,
      }
    : {
        textColor: isDark
          ? colors[colorPalette][300]
          : colors[colorPalette][800],
        bgColor: isDark ? colors[colorPalette][900] : colors[colorPalette][100],
      };

  return (
    <Box
      data-comparison-role={comparisonRole}
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
      {comparisonRole && (
        <Box
          component="span"
          sx={{
            border: 0,
            clip: "rect(0 0 0 0)",
            height: "1px",
            margin: "-1px",
            overflow: "hidden",
            padding: 0,
            position: "absolute",
            whiteSpace: "nowrap",
            width: "1px",
          }}
        >
          {comparisonRole === "base" ? "Base: " : "Current: "}
        </Box>
      )}
      <Box
        sx={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: grayOut ? "text.disabled" : "inherit",
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
