"use client";

import Box from "@mui/material/Box";
import { memo, type ReactNode } from "react";
import { PiWarning } from "react-icons/pi";
import { useIsDark } from "../../hooks/useIsDark";
import { colors } from "../../theme/colors";

/**
 * Common view options for diff-based result views.
 * Used to control what data is shown in diff results.
 */
export interface DiffViewOptions {
  /** When true, only show rows/columns that have changed */
  changed_only?: boolean;
}

/**
 * Props for the RunToolbar component
 */
export interface RunToolbarProps {
  /** Array of warning messages to display */
  warnings?: string[];
  /** Toolbar actions or other content */
  children?: ReactNode;
  /** Optional CSS class */
  className?: string;
}

/**
 * RunToolbar Component
 *
 * A pure presentation component for displaying run toolbar with warnings.
 * Warnings are displayed with amber background when present.
 *
 * @example Basic usage with warnings
 * ```tsx
 * import { RunToolbar } from '@datarecce/ui/primitives';
 *
 * function RunPane({ run }) {
 *   return (
 *     <RunToolbar warnings={run.warnings}>
 *       <Button onClick={handleExport}>Export</Button>
 *     </RunToolbar>
 *   );
 * }
 * ```
 *
 * @example Without warnings
 * ```tsx
 * <RunToolbar>
 *   <Switch label="Changed only" />
 *   <Button onClick={handleCopy}>Copy</Button>
 * </RunToolbar>
 * ```
 */
function RunToolbarComponent({
  warnings,
  children,
  className,
}: RunToolbarProps) {
  const isDark = useIsDark();
  const hasWarnings = warnings && warnings.length > 0;

  return (
    <Box
      className={className}
      sx={{
        display: "flex",
        borderBottom: "1px solid",
        borderColor: "divider",
        justifyContent: "flex-end",
        gap: "5px",
        alignItems: "center",
        px: "10px",
        bgcolor: hasWarnings
          ? isDark
            ? colors.amber[900]
            : colors.amber[100]
          : "inherit",
        color: hasWarnings
          ? isDark
            ? colors.amber[200]
            : colors.amber[800]
          : "inherit",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 0,
        }}
      >
        {warnings?.map((warning, index) => (
          <Box key={`warning-${index}-${warning.slice(0, 20)}`}>
            <PiWarning
              color={isDark ? colors.amber[400] : colors.amber[600]}
              style={{ verticalAlign: "middle", marginRight: 4 }}
            />
            {warning}
          </Box>
        ))}
      </Box>
      <Box sx={{ flex: 1, minHeight: "32px" }} />
      {children}
    </Box>
  );
}

export const RunToolbar = memo(RunToolbarComponent);
RunToolbar.displayName = "RunToolbar";
