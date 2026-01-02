"use client";

import { useEffect, useState } from "react";
import { useRecceTheme } from "../providers/contexts/ThemeContext";

/**
 * Simple dark mode detection hook
 *
 * Uses RecceTheme context for reliable dark mode detection.
 * For more theme colors, use useThemeColors() instead.
 *
 * @returns true if dark mode is active, false otherwise
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isDark = useIsDark();
 *   return <Box bgcolor={isDark ? "grey.900" : "grey.100"}>Content</Box>;
 * }
 * ```
 */
export function useIsDark(): boolean {
  const { resolvedMode } = useRecceTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by returning false during SSR
  return mounted ? resolvedMode === "dark" : false;
}
