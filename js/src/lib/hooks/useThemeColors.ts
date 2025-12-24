"use client";

import { useTheme as useMuiTheme } from "@mui/material/styles";
import { useTheme as useNextTheme } from "next-themes";
import { useEffect, useState } from "react";
import { colors } from "@/components/ui/mui-theme";

/**
 * Theme-aware color utility hook
 *
 * Uses next-themes to determine dark/light mode, which is more reliable
 * when the host app uses MUI CSS variables mode with nested ThemeProviders.
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
  const { resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use next-themes to determine dark mode (more reliable with CSS variables mode)
  const isDark = mounted ? resolvedTheme === "dark" : false;

  return {
    /** Whether the current theme is dark mode */
    isDark,

    /** MUI theme object for direct access when needed */
    theme: muiTheme,

    /** Background colors */
    background: {
      /** Default page background */
      default: isDark ? colors.neutral[900] : "#FFFFFF",
      /** Paper/card background */
      paper: isDark ? colors.neutral[800] : "#FFFFFF",
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
        bg: isDark ? "#1a4d1a" : "#cefece",
        text: isDark ? colors.neutral[50] : colors.neutral[900],
      },
      /** Removed/error backgrounds */
      removed: {
        bg: isDark ? "#5c1f1f" : "#ffc5c5",
        text: isDark ? colors.neutral[50] : colors.neutral[900],
      },
      /** Modified/warning backgrounds */
      modified: {
        bg: isDark ? "#5c4a1a" : "#fff3cd",
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
