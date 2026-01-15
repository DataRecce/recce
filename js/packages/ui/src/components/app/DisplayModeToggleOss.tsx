"use client";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { PiMoon, PiSun } from "react-icons/pi";

/**
 * Display Mode Toggle - switches between light and dark themes
 *
 * Uses next-themes to persist the user's preference.
 * Default is light theme, with future support for system preference.
 */
export const DisplayModeToggleOss = () => {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <IconButton
        size="small"
        sx={{
          color: "rgba(255, 255, 255, 0.8)",
          "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
        }}
        disabled
      >
        <PiSun style={{ width: 18, height: 18 }} />
      </IconButton>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <IconButton
        size="small"
        onClick={toggleTheme}
        sx={{
          color: "rgba(255, 255, 255, 0.8)",
          "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
        }}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? (
          <PiSun style={{ width: 18, height: 18 }} />
        ) : (
          <PiMoon style={{ width: 18, height: 18 }} />
        )}
      </IconButton>
    </Tooltip>
  );
};
