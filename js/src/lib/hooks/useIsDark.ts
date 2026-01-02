"use client";

import { useTheme as useNextTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Dark mode detection hook for CSS Variables mode
 *
 * Uses next-themes.resolvedTheme which is reliable with
 * MUI CSS Variables mode (colorSchemeSelector: "class").
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
  const { resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by returning false during SSR
  return mounted ? resolvedTheme === "dark" : false;
}
