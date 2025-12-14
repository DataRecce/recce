"use client";

import MuiIconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import type { ThemeProviderProps } from "next-themes";
import { ThemeProvider, useTheme } from "next-themes";
import * as React from "react";
import { LuMoon, LuSun } from "react-icons/lu";

export type ColorModeProviderProps = ThemeProviderProps;

export function ColorModeProvider(props: ColorModeProviderProps) {
  return (
    <ThemeProvider attribute="class" disableTransitionOnChange {...props} />
  );
}

export type ColorMode = "light" | "dark";

export interface UseColorModeReturn {
  colorMode: ColorMode;
  setColorMode: (colorMode: ColorMode) => void;
  toggleColorMode: () => void;
}

export function useColorMode(): UseColorModeReturn {
  const { resolvedTheme, setTheme, forcedTheme } = useTheme();
  const colorMode = forcedTheme ?? resolvedTheme;
  const toggleColorMode = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };
  return {
    colorMode: colorMode as ColorMode,
    setColorMode: setTheme,
    toggleColorMode,
  };
}

export function useColorModeValue<T>(light: T, dark: T) {
  const { colorMode } = useColorMode();
  return colorMode === "dark" ? dark : light;
}

export function ColorModeIcon() {
  const { colorMode } = useColorMode();
  return colorMode === "dark" ? <LuMoon /> : <LuSun />;
}

interface ColorModeButtonProps {
  className?: string;
}

// Client-only wrapper component
function ClientOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return fallback ?? null;
  }

  return <>{children}</>;
}

export const ColorModeButton = React.forwardRef<
  HTMLButtonElement,
  ColorModeButtonProps
>(function ColorModeButton(props, ref) {
  const { toggleColorMode } = useColorMode();
  return (
    <ClientOnly fallback={<Skeleton variant="circular" width={32} height={32} />}>
      <MuiIconButton
        onClick={toggleColorMode}
        aria-label="Toggle color mode"
        size="small"
        ref={ref}
        {...props}
        sx={{
          width: 32,
          height: 32,
        }}
      >
        <ColorModeIcon />
      </MuiIconButton>
    </ClientOnly>
  );
});

interface LightDarkModeProps {
  children?: React.ReactNode;
  className?: string;
}

export const LightMode = React.forwardRef<HTMLSpanElement, LightDarkModeProps>(
  function LightMode({ children, ...props }, ref) {
    return (
      <span
        ref={ref}
        style={{ display: "contents" }}
        className="light-mode"
        data-theme="light"
        {...props}
      >
        {children}
      </span>
    );
  },
);

export const DarkMode = React.forwardRef<HTMLSpanElement, LightDarkModeProps>(
  function DarkMode({ children, ...props }, ref) {
    return (
      <span
        ref={ref}
        style={{ display: "contents" }}
        className="dark-mode"
        data-theme="dark"
        {...props}
      >
        {children}
      </span>
    );
  },
);
