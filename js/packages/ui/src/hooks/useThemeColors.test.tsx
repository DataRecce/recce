/**
 * @file useThemeColors.test.tsx
 * @description Tests for useThemeColors hook
 *
 * Tests verify:
 * - Returns correct colors for light mode
 * - Returns correct colors for dark mode
 * - Works without RecceProvider (fallback path) - AFTER we add fallback
 * - Works with RecceProvider (context path)
 */

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "../providers/contexts/ThemeContext";
import { colors } from "../theme/colors";
import { useThemeColors } from "./useThemeColors";

// Mock MUI theme hook
jest.mock("@mui/material/styles", () => ({
  useTheme: () => ({
    palette: { mode: "light" },
  }),
}));

// Helper to toggle dark class on document
const setDarkClass = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

describe("useThemeColors", () => {
  beforeEach(() => {
    // Reset to light mode before each test
    document.documentElement.classList.remove("dark");
  });

  describe("with RecceProvider", () => {
    it("returns light mode colors when ThemeProvider is in light mode", async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ThemeProvider defaultMode="light">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useThemeColors(), { wrapper });

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.isDark).toBe(false);
      expect(result.current.background.default).toBe(colors.white);
      expect(result.current.text.primary).toBe(colors.neutral[900]);
    });

    it("returns dark mode colors when ThemeProvider is in dark mode", async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ThemeProvider defaultMode="dark">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useThemeColors(), { wrapper });

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.isDark).toBe(true);
      expect(result.current.background.default).toBe(colors.neutral[900]);
      expect(result.current.text.primary).toBe(colors.neutral[50]);
    });
  });

  // SKIP: These tests are intentionally skipped until Task 3 adds fallback behavior.
  // The useThemeColors hook currently requires RecceProvider (throws error without it).
  // Task 3 will add fallback behavior so these tests can pass.
  // To verify this, remove .skip and run the tests - they will fail with:
  //   "useRecceTheme must be used within RecceProvider"
  describe.skip("without RecceProvider (fallback mode)", () => {
    it("returns light mode colors when .dark class is absent", async () => {
      setDarkClass(false);
      const { result } = renderHook(() => useThemeColors());

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.isDark).toBe(false);
      expect(result.current.background.default).toBe(colors.white);
    });

    it("returns dark mode colors when .dark class is present", async () => {
      setDarkClass(true);
      const { result } = renderHook(() => useThemeColors());

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.isDark).toBe(true);
      expect(result.current.background.default).toBe(colors.neutral[900]);
    });
  });

  describe("color structure", () => {
    it("returns all expected color categories", async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ThemeProvider defaultMode="light">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useThemeColors(), { wrapper });

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Verify structure
      expect(result.current).toHaveProperty("isDark");
      expect(result.current).toHaveProperty("theme");
      expect(result.current).toHaveProperty("background");
      expect(result.current).toHaveProperty("text");
      expect(result.current).toHaveProperty("border");
      expect(result.current).toHaveProperty("status");
      expect(result.current).toHaveProperty("interactive");

      // Verify theme property returns MUI theme object
      expect(result.current.theme).toBeDefined();
      expect(result.current.theme.palette).toBeDefined();

      // Verify nested structure
      expect(result.current.background).toHaveProperty("default");
      expect(result.current.background).toHaveProperty("paper");
      expect(result.current.background).toHaveProperty("subtle");
      expect(result.current.background).toHaveProperty("emphasized");
    });
  });

  describe("error handling", () => {
    it("throws error when used without RecceProvider", () => {
      // This test documents the current behavior before Task 3 adds fallback
      expect(() => renderHook(() => useThemeColors())).toThrow(
        "useRecceTheme must be used within RecceProvider",
      );
    });
  });
});
