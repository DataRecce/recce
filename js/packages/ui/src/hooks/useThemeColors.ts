"use client";

import { useTheme as useMuiTheme } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { useRecceThemeOptional } from "../providers/contexts/ThemeContext";
import { colors } from "../theme/colors";
import { useIsDark } from "./useIsDark";

/**
 * Theme-aware color utility hook
 *
 * Returns a consistent set of colors based on the current theme mode.
 *
 * **Dual-Context Support:**
 * This hook works in two contexts:
 * 1. **With RecceProvider** (recce-cloud-infra): Uses ThemeContext for theme detection
 * 2. **Without RecceProvider** (Recce OSS with next-themes): Falls back to useIsDark
 *    which uses DOM class detection (.dark on <html>)
 *
 * This allows @datarecce/ui components to work in both environments without
 * requiring the host application to wrap everything in RecceProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isDark, background, text, border } = useThemeColors();
 *
 *   return (
 *     <Box sx={{
 *       bgcolor: background.paper,
 *       color: text.primary,
 *       borderColor: border.default,
 *     }}>
 *       Content
 *     </Box>
 *   );
 * }
 * ```
 */
export function useThemeColors() {
  const muiTheme = useMuiTheme();
  // Try context first (returns null if not in RecceProvider)
  const themeContext = useRecceThemeOptional();
  // Fallback to useIsDark which has DOM class detection
  const isDarkFallback = useIsDark();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine dark mode: prefer context if available, otherwise use fallback
  const isDark = mounted
    ? themeContext
      ? themeContext.resolvedMode === "dark"
      : isDarkFallback
    : false;

  return {
    /** Whether the current theme is dark mode */
    isDark,

    /** MUI theme object for direct access when needed */
    theme: muiTheme,

    /** Background colors */
    background: {
      /** Default page background */
      default: isDark ? colors.neutral[900] : colors.white,
      /** Paper/card background */
      paper: isDark ? colors.neutral[800] : colors.white,
      /** Subtle background for slight elevation (e.g., hover states, inputs) */
      subtle: isDark ? colors.neutral[800] : colors.neutral[50],
      /** Emphasized background for higher contrast areas */
      emphasized: isDark ? colors.neutral[700] : colors.neutral[100],
    },

    /** Text colors */
    text: {
      /** Primary text color */
      primary: isDark ? colors.neutral[50] : colors.neutral[900],
      /** Secondary/muted text color */
      secondary: isDark ? colors.neutral[400] : colors.neutral[600],
      /** Disabled text color */
      disabled: isDark ? colors.neutral[500] : colors.neutral[400],
      /** Inverted text (for use on dark backgrounds in light mode, etc.) */
      inverted: isDark ? colors.neutral[900] : colors.neutral[50],
    },

    /** Border colors */
    border: {
      /** Light border for subtle separations */
      light: isDark ? colors.neutral[700] : colors.neutral[200],
      /** Default border color */
      default: isDark ? colors.neutral[600] : colors.neutral[300],
      /** Strong border for emphasis */
      strong: isDark ? colors.neutral[500] : colors.neutral[400],
    },

    /** Status/semantic colors */
    status: {
      /** Added/success backgrounds */
      added: {
        bg: isDark ? colors.green[900] : colors.green[100],
        text: isDark ? colors.neutral[50] : colors.neutral[900],
      },
      /** Removed/error backgrounds */
      removed: {
        bg: isDark ? colors.red[950] : colors.red[200],
        text: isDark ? colors.neutral[50] : colors.neutral[900],
      },
      /** Modified/warning backgrounds */
      modified: {
        bg: isDark ? colors.yellow[900] : colors.amber[100],
        text: isDark ? colors.neutral[50] : colors.neutral[900],
      },
    },

    /** Interactive element colors */
    interactive: {
      /** Hover state background */
      hover: isDark ? colors.neutral[700] : colors.neutral[100],
      /** Active/pressed state background */
      active: isDark ? colors.neutral[600] : colors.neutral[200],
      /** Focus ring color */
      focus: colors.iochmara[500],
    },
  };
}

export type ThemeColors = ReturnType<typeof useThemeColors>;
