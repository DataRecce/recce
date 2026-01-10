"use client";

import { useEffect, useState } from "react";
import { useRecceThemeOptional } from "../providers/contexts/ThemeContext";

/**
 * Simple dark mode detection hook
 *
 * Uses RecceTheme context when available for reliable dark mode detection.
 * Falls back to DOM class detection when not within RecceProvider,
 * allowing components to work in both contexts (e.g., OSS app with next-themes
 * and Recce Cloud with RecceProvider).
 *
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
  // Try to use theme context (returns null if not in provider)
  const themeContext = useRecceThemeOptional();
  const [mounted, setMounted] = useState(false);
  const [isDarkClass, setIsDarkClass] = useState(false);

  useEffect(() => {
    setMounted(true);

    // If no context, fall back to DOM class detection
    // This allows the hook to work in OSS app (next-themes) and Recce Cloud (RecceProvider)
    if (!themeContext) {
      const checkDarkClass = () => {
        setIsDarkClass(document.documentElement.classList.contains("dark"));
      };
      checkDarkClass();

      // Watch for class changes (both next-themes and RecceProvider toggle .dark)
      const observer = new MutationObserver(checkDarkClass);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => observer.disconnect();
    }
  }, [themeContext]);

  // Prevent hydration mismatch by returning false during SSR
  if (!mounted) return false;

  // Prefer context if available, otherwise use DOM detection
  return themeContext ? themeContext.resolvedMode === "dark" : isDarkClass;
}
