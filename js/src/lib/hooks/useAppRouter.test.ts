/**
 * Unit tests for useAppRouter hooks
 *
 * Tests the navigation utilities that replaced Wouter's useLocation
 */

import { act, renderHook } from "@testing-library/react";
import { useAppLocation, useAppNavigation, useAppRoute } from "./useAppRouter";

describe("useAppLocation", () => {
  beforeEach(() => {
    global.mockNextNavigation.reset();
  });

  it("returns current pathname", () => {
    global.mockNextNavigation.setPathname("/lineage");

    const { result } = renderHook(() => useAppLocation());
    const [location] = result.current;

    expect(location).toBe("/lineage");
  });

  it("returns pathname for different routes", () => {
    global.mockNextNavigation.setPathname("/checks");

    const { result } = renderHook(() => useAppLocation());
    const [location] = result.current;

    expect(location).toBe("/checks");
  });

  it("navigates to new path with push", () => {
    global.mockNextNavigation.setPathname("/lineage");
    const router = global.mockNextNavigation.getRouter();

    const { result } = renderHook(() => useAppLocation());
    const [, setLocation] = result.current;

    act(() => {
      setLocation("/checks?id=abc-123");
    });

    expect(router.push).toHaveBeenCalledWith("/checks?id=abc-123", {
      scroll: true,
    });
  });

  it("navigates with replace option", () => {
    global.mockNextNavigation.setPathname("/lineage");
    const router = global.mockNextNavigation.getRouter();

    const { result } = renderHook(() => useAppLocation());
    const [, setLocation] = result.current;

    act(() => {
      setLocation("/query", { replace: true });
    });

    expect(router.replace).toHaveBeenCalledWith("/query", { scroll: true });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("navigates with scroll disabled", () => {
    global.mockNextNavigation.setPathname("/lineage");
    const router = global.mockNextNavigation.getRouter();

    const { result } = renderHook(() => useAppLocation());
    const [, setLocation] = result.current;

    act(() => {
      setLocation("/query", { scroll: false });
    });

    expect(router.push).toHaveBeenCalledWith("/query", { scroll: false });
  });

  it("navigates with replace and scroll disabled", () => {
    global.mockNextNavigation.setPathname("/lineage");
    const router = global.mockNextNavigation.getRouter();

    const { result } = renderHook(() => useAppLocation());
    const [, setLocation] = result.current;

    act(() => {
      setLocation("/checks", { replace: true, scroll: false });
    });

    expect(router.replace).toHaveBeenCalledWith("/checks", { scroll: false });
  });
});

describe("useAppRoute", () => {
  beforeEach(() => {
    global.mockNextNavigation.reset();
  });

  it("matches exact path", () => {
    global.mockNextNavigation.setPathname("/lineage");

    const { result } = renderHook(() => useAppRoute("/lineage"));
    const [isMatch] = result.current;

    expect(isMatch).toBe(true);
  });

  it("does not match different path", () => {
    global.mockNextNavigation.setPathname("/query");

    const { result } = renderHook(() => useAppRoute("/lineage"));
    const [isMatch] = result.current;

    expect(isMatch).toBe(false);
  });

  it("matches path with parameter pattern", () => {
    global.mockNextNavigation.setPathname("/checks/abc-123");
    global.mockNextNavigation.setParams({ checkId: "abc-123" });

    const { result } = renderHook(() => useAppRoute("/checks/:checkId"));
    const [isMatch, params] = result.current;

    expect(isMatch).toBe(true);
    expect(params.checkId).toBe("abc-123");
  });

  it("does not match partial path", () => {
    global.mockNextNavigation.setPathname("/checks/abc-123/details");

    const { result } = renderHook(() => useAppRoute("/checks/:checkId"));
    const [isMatch] = result.current;

    expect(isMatch).toBe(false);
  });

  it("matches wildcard pattern", () => {
    global.mockNextNavigation.setPathname("/checks/abc-123/details/more");

    const { result } = renderHook(() => useAppRoute("/checks/*"));
    const [isMatch] = result.current;

    expect(isMatch).toBe(true);
  });

  it("returns empty params when no dynamic segments", () => {
    global.mockNextNavigation.setPathname("/lineage");
    global.mockNextNavigation.setParams({});

    const { result } = renderHook(() => useAppRoute("/lineage"));
    const [, params] = result.current;

    expect(params).toEqual({});
  });
});

describe("useAppNavigation", () => {
  beforeEach(() => {
    global.mockNextNavigation.reset();
  });

  it("provides pathname", () => {
    global.mockNextNavigation.setPathname("/checks");

    const { result } = renderHook(() => useAppNavigation());

    expect(result.current.pathname).toBe("/checks");
  });

  it("provides params", () => {
    global.mockNextNavigation.setParams({ checkId: "test-id" });

    const { result } = renderHook(() => useAppNavigation());

    expect(result.current.params).toEqual({ checkId: "test-id" });
  });

  it("provides navigation methods", () => {
    const { result } = renderHook(() => useAppNavigation());

    expect(typeof result.current.push).toBe("function");
    expect(typeof result.current.replace).toBe("function");
    expect(typeof result.current.back).toBe("function");
    expect(typeof result.current.forward).toBe("function");
    expect(typeof result.current.refresh).toBe("function");
    expect(typeof result.current.prefetch).toBe("function");
  });

  it("calls router.back when back is invoked", () => {
    const router = global.mockNextNavigation.getRouter();

    const { result } = renderHook(() => useAppNavigation());

    act(() => {
      result.current.back();
    });

    expect(router.back).toHaveBeenCalled();
  });

  it("calls router.forward when forward is invoked", () => {
    const router = global.mockNextNavigation.getRouter();

    const { result } = renderHook(() => useAppNavigation());

    act(() => {
      result.current.forward();
    });

    expect(router.forward).toHaveBeenCalled();
  });
});
