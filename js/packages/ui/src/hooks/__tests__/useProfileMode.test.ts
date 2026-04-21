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
    localStorage.setItem(STORAGE_KEY, "wide");
    const { result } = renderHook(() => useProfileMode());
    expect(result.current[0]).toBe("wide");
  });

  it("falls back to 'grid' when stored value is invalid", () => {
    localStorage.setItem(STORAGE_KEY, "nonsense");
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

  it("setter accepts all three valid modes", () => {
    const { result } = renderHook(() => useProfileMode());
    act(() => {
      result.current[1]("wide");
    });
    expect(result.current[0]).toBe("wide");
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
