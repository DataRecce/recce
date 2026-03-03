/**
 * @file useIsDark.test.tsx
 * @description Tests for useIsDark hook
 *
 * Tests verify:
 * - Returns false during SSR (hydration safety)
 * - Returns true when .dark class is on <html>
 * - Returns false when .dark class is absent
 * - Works without RecceProvider (fallback path)
 * - Works with RecceProvider (context path)
 */

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "../providers/contexts/ThemeContext";
import { useIsDark } from "./useIsDark";

// Helper to toggle dark class on document
const setDarkClass = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

describe("useIsDark", () => {
  beforeEach(() => {
    // Reset to light mode before each test
    document.documentElement.classList.remove("dark");
  });

  describe("without RecceProvider (fallback mode)", () => {
    it("returns false initially (hydration safety)", () => {
      const { result } = renderHook(() => useIsDark());
      // First render should be false to prevent hydration mismatch
      expect(result.current).toBe(false);
    });

    it("returns false when .dark class is absent", async () => {
      setDarkClass(false);
      const { result } = renderHook(() => useIsDark());

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current).toBe(false);
    });

    it("returns true when .dark class is present", async () => {
      setDarkClass(true);
      const { result } = renderHook(() => useIsDark());

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current).toBe(true);
    });

    it("reacts to class changes via MutationObserver", async () => {
      setDarkClass(false);
      const { result } = renderHook(() => useIsDark());

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(result.current).toBe(false);

      // Toggle to dark
      await act(async () => {
        setDarkClass(true);
        // MutationObserver is async, give it time
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current).toBe(true);
    });
  });

  describe("with RecceProvider (context mode)", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ThemeProvider defaultMode="dark">{children}</ThemeProvider>
    );

    it("returns true when ThemeProvider is in dark mode", async () => {
      const { result } = renderHook(() => useIsDark(), { wrapper });

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current).toBe(true);
    });

    it("returns false when ThemeProvider is in light mode", async () => {
      const lightWrapper = ({ children }: { children: ReactNode }) => (
        <ThemeProvider defaultMode="light">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useIsDark(), {
        wrapper: lightWrapper,
      });

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current).toBe(false);
    });
  });
});
