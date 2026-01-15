"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * Theme mode selection for {@link ThemeProvider}.
 */
type ThemeMode = "light" | "dark" | "system";

/**
 * Theme context values exposed by {@link useRecceTheme}.
 */
interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
ThemeContext.displayName = "RecceThemeContext";

/**
 * Access the theme context.
 *
 * @throws Error if used outside {@link RecceProvider}.
 */
export function useRecceTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useRecceTheme must be used within RecceProvider");
  }
  return context;
}

/**
 * Non-throwing version of {@link useRecceTheme}.
 *
 * @returns Theme context values, or null if outside {@link RecceProvider}.
 */
export function useRecceThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}

/**
 * Props for {@link ThemeProvider}.
 */
interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
}

/**
 * Provides theme mode and resolved color scheme for UI components.
 */
export function ThemeProvider({
  children,
  defaultMode = "system",
}: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(defaultMode);

  // SSR-safe initialization: compute initial resolved mode to prevent hydration mismatch
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() => {
    // On server, always return "light" for consistent initial render
    if (typeof window === "undefined") return "light";
    // On client, compute actual value during initialization
    if (defaultMode !== "system") return defaultMode;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    if (mode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      setResolvedMode(mediaQuery.matches ? "dark" : "light");

      const handler = (e: MediaQueryListEvent) => {
        setResolvedMode(e.matches ? "dark" : "light");
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      setResolvedMode(mode);
    }
  }, [mode]);

  useEffect(() => {
    // Skip on server (SSR safety)
    if (typeof window === "undefined") return;
    // Toggle .dark class on document for CSS variables
    document.documentElement.classList.toggle("dark", resolvedMode === "dark");
  }, [resolvedMode]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
