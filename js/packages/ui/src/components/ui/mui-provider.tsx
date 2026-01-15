"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect } from "react";
import { theme } from "../../theme";

interface MuiProviderProps {
  children: ReactNode;
  /**
   * Force a specific theme mode. If not provided, follows system/user preference.
   */
  forcedTheme?: "light" | "dark";
  /**
   * Whether to include MUI's CssBaseline for consistent baseline styles.
   * Disabled by default to avoid conflicts with Chakra/Tailwind during migration.
   */
  enableCssBaseline?: boolean;
}

/**
 * MUI Theme Provider for Recce
 *
 * This provider integrates MUI theming with the existing next-themes
 * color mode system used by Chakra UI. MUI 7 CSS Variables mode is used,
 * which responds to the `.dark` class on document.documentElement.
 *
 * Usage:
 * ```tsx
 * <MuiProvider>
 *   <MuiButton>Click me</MuiButton>
 * </MuiProvider>
 * ```
 */
export function MuiProvider({
  children,
  forcedTheme,
  enableCssBaseline = false,
}: MuiProviderProps) {
  const { resolvedTheme } = useTheme();

  // Toggle .dark class on document.documentElement for CSS Variables mode
  useEffect(() => {
    const mode = forcedTheme ?? resolvedTheme;
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [forcedTheme, resolvedTheme]);

  // Use single theme - CSS Variables mode handles light/dark via .dark class
  return (
    <MuiThemeProvider theme={theme}>
      {enableCssBaseline && <CssBaseline />}
      {children}
    </MuiThemeProvider>
  );
}

export default MuiProvider;
