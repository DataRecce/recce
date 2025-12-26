"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { darkTheme, lightTheme } from "./mui-theme";

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
 * color mode system used by Chakra UI. During the migration period,
 * both Chakra and MUI components will share the same theme mode.
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
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch - next-themes resolvedTheme is undefined on server
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine which theme to use
  // Use light theme during SSR/hydration to match server render
  const theme = useMemo(() => {
    if (!mounted) {
      return lightTheme;
    }
    const mode = forcedTheme ?? resolvedTheme;
    return mode === "dark" ? darkTheme : lightTheme;
  }, [forcedTheme, resolvedTheme, mounted]);

  return (
    <MuiThemeProvider theme={theme}>
      {enableCssBaseline && <CssBaseline />}
      {children}
    </MuiThemeProvider>
  );
}

export default MuiProvider;
