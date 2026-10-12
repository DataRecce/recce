"use client";

import { useTheme as useMuiTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
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
/**
 * Mode-specific color sections.
 *
 * Built once at module load so every section keeps a stable reference for
 * as long as the mode is unchanged. Consumers can safely place a section in a
 * `useMemo` / `useCallback` dependency array without spurious invalidation.
 */
interface ThemeColorSections {
  /** Background colors */
  background: {
    /** Default page background */
    default: string;
    /** Paper/card background */
    paper: string;
    /** Subtle background for slight elevation (e.g., hover states, inputs) */
    subtle: string;
    /** Emphasized background for higher contrast areas */
    emphasized: string;
  };
  /** Text colors */
  text: {
    /** Primary text color */
    primary: string;
    /** Secondary/muted text color */
    secondary: string;
    /** Disabled text color */
    disabled: string;
    /** Inverted text (for use on dark backgrounds in light mode, etc.) */
    inverted: string;
  };
  /** Border colors */
  border: {
    /** Light border for subtle separations */
    light: string;
    /** Default border color */
    default: string;
    /** Strong border for emphasis */
    strong: string;
  };
  /** Status/semantic colors */
  status: {
    /** Added/success backgrounds */
    added: { bg: string; text: string };
    /** Removed/error backgrounds */
    removed: { bg: string; text: string };
    /** Modified/warning backgrounds */
    modified: { bg: string; text: string };
  };
  /** Interactive element colors */
  interactive: {
    /** Hover state background */
    hover: string;
    /** Active/pressed state background */
    active: string;
    /** Focus ring color */
    focus: string;
  };
}

const LIGHT_COLORS: ThemeColorSections = {
  background: {
    default: colors.white,
    paper: colors.white,
    subtle: colors.neutral[50],
    emphasized: colors.neutral[100],
  },
  text: {
    primary: colors.neutral[900],
    secondary: colors.neutral[600],
    disabled: colors.neutral[400],
    inverted: colors.neutral[50],
  },
  border: {
    light: colors.neutral[200],
    default: colors.neutral[300],
    strong: colors.neutral[400],
  },
  status: {
    added: { bg: colors.green[100], text: colors.neutral[900] },
    removed: { bg: colors.red[200], text: colors.neutral[900] },
    modified: { bg: colors.amber[100], text: colors.neutral[900] },
  },
  interactive: {
    hover: colors.neutral[100],
    active: colors.neutral[200],
    focus: colors.iochmara[500],
  },
};

const DARK_COLORS: ThemeColorSections = {
  background: {
    default: colors.neutral[900],
    paper: colors.neutral[800],
    subtle: colors.neutral[800],
    emphasized: colors.neutral[700],
  },
  text: {
    primary: colors.neutral[50],
    secondary: colors.neutral[400],
    disabled: colors.neutral[500],
    inverted: colors.neutral[900],
  },
  border: {
    light: colors.neutral[700],
    default: colors.neutral[600],
    strong: colors.neutral[500],
  },
  status: {
    added: { bg: colors.green[900], text: colors.neutral[50] },
    removed: { bg: colors.red[950], text: colors.neutral[50] },
    modified: { bg: colors.yellow[900], text: colors.neutral[50] },
  },
  interactive: {
    hover: colors.neutral[700],
    active: colors.neutral[600],
    focus: colors.iochmara[500],
  },
};

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

  return useMemo(
    () => ({
      /** Whether the current theme is dark mode */
      isDark,

      /** MUI theme object for direct access when needed */
      theme: muiTheme,

      ...(isDark ? DARK_COLORS : LIGHT_COLORS),
    }),
    [isDark, muiTheme],
  );
}

export type ThemeColors = ReturnType<typeof useThemeColors>;
