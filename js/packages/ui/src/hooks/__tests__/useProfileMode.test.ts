/**
 * @file useProfileMode.test.ts
 * @description Tests for localStorage-backed profile render mode hook.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEY, useProfileMode } from "../useProfileMode";

describe("useProfileMode", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to 'grid' when localStorage is empty", () => {
    const { result } = renderHook(() => useProfileMode());
    expect(result.current[0]).toBe("grid");
  });

  it("reads an existing stored value", () => {
    localStorage.setItem(STORAGE_KEY, "strip");
    const { result } = renderHook(() => useProfileMode());
    expect(result.current[0]).toBe("strip");
  });

  it("falls back to 'grid' when stored value is invalid", () => {
    localStorage.setItem(STORAGE_KEY, "nonsense");
    const { result } = renderHook(() => useProfileMode());
    expect(result.current[0]).toBe("grid");
  });

  it("falls back to 'grid' for the removed 'wide' mode", () => {
    localStorage.setItem(STORAGE_KEY, "wide");
    const { result } = renderHook(() => useProfileMode());
    expect(result.current[0]).toBe("grid");
  });

  it("setter writes the new value to localStorage", () => {
    const { result } = renderHook(() => useProfileMode());
    act(() => {
      result.current[1]("strip");
    });
    expect(result.current[0]).toBe("strip");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("strip");
  });

  it("setter accepts both valid modes", () => {
    const { result } = renderHook(() => useProfileMode());
    act(() => {
      result.current[1]("strip");
    });
    expect(result.current[0]).toBe("strip");
    act(() => {
      result.current[1]("grid");
    });
    expect(result.current[0]).toBe("grid");
  });
});
