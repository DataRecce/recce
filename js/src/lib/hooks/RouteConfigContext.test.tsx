/**
 * Unit tests for RouteConfigContext
 *
 * Tests the path prefixing and stripping functionality for recce-cloud integration
 */

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { RouteConfigProvider, useRouteConfig } from "./RouteConfigContext";
import {
  useAppLocation,
  useAppLocationWithSearch,
  useAppNavigation,
  useAppRoute,
} from "./useAppRouter";

// Helper to create a wrapper with RouteConfigProvider
const createWrapper =
  (basePath: string) =>
  ({ children }: { children: ReactNode }) => (
    <RouteConfigProvider basePath={basePath}>{children}</RouteConfigProvider>
  );

describe("RouteConfigContext", () => {
  describe("useRouteConfig without provider (OSS mode)", () => {
    it("returns default config with empty basePath", () => {
      const { result } = renderHook(() => useRouteConfig());

      expect(result.current.basePath).toBe("");
    });

    it("resolvePath returns path unchanged", () => {
      const { result } = renderHook(() => useRouteConfig());

      expect(result.current.resolvePath("/query")).toBe("/query");
      expect(result.current.resolvePath("/checks?id=123")).toBe(
        "/checks?id=123",
      );
    });

    it("stripBasePath returns pathname unchanged", () => {
      const { result } = renderHook(() => useRouteConfig());

      expect(result.current.stripBasePath("/query")).toBe("/query");
      expect(result.current.stripBasePath("/checks/abc")).toBe("/checks/abc");
    });
  });

  describe("useRouteConfig with provider", () => {
    it("returns configured basePath", () => {
      const wrapper = createWrapper("/oss/abc123");
      const { result } = renderHook(() => useRouteConfig(), { wrapper });

      expect(result.current.basePath).toBe("/oss/abc123");
    });

    it("resolvePath prefixes path with basePath", () => {
      const wrapper = createWrapper("/oss/abc123");
      const { result } = renderHook(() => useRouteConfig(), { wrapper });

      expect(result.current.resolvePath("/query")).toBe("/oss/abc123/query");
      expect(result.current.resolvePath("/checks")).toBe("/oss/abc123/checks");
    });

    it("resolvePath handles paths without leading slash", () => {
      const wrapper = createWrapper("/oss/abc123");
      const { result } = renderHook(() => useRouteConfig(), { wrapper });

      expect(result.current.resolvePath("query")).toBe("/oss/abc123/query");
    });

    it("resolvePath avoids double-prefixing", () => {
      const wrapper = createWrapper("/oss/abc123");
      const { result } = renderHook(() => useRouteConfig(), { wrapper });

      expect(result.current.resolvePath("/oss/abc123/query")).toBe(
        "/oss/abc123/query",
      );
    });

    it("resolvePath handles basePath with trailing slash", () => {
      const wrapper = createWrapper("/oss/abc123/");
      const { result } = renderHook(() => useRouteConfig(), { wrapper });

      expect(result.current.resolvePath("/query")).toBe("/oss/abc123/query");
    });

    it("resolvePath does not prefix absolute URLs with http/https", () => {
      const wrapper = createWrapper("/oss/abc123");
      const { result } = renderHook(() => useRouteConfig(), { wrapper });

      expect(result.current.resolvePath("https://example.com")).toBe(
        "https://example.com",
      );
      expect(result.current.resolvePath("http://example.com")).toBe(
        "http://example.com",
      );
    });

    it("resolvePath does not prefix URLs with other schemes", () => {
      const wrapper = createWrapper("/oss/abc123");
      const { result } = renderHook(() => useRouteConfig(), { wrapper });

      expect(result.current.resolvePath("mailto:test@example.com")).toBe(
        "mailto:test@example.com",
      );
      expect(result.current.resolvePath("tel:+1234567890")).toBe(
        "tel:+1234567890",
      );
      expect(
        result.current.resolvePath("data:text/plain;base64,SGVsbG8="),
      ).toBe("data:text/plain;base64,SGVsbG8=");
      expect(result.current.resolvePath("ftp://ftp.example.com")).toBe(
        "ftp://ftp.example.com",
      );
    });

    it("resolvePath does not prefix hash-only paths", () => {
      const wrapper = createWrapper("/oss/abc123");
      const { result } = renderHook(() => useRouteConfig(), { wrapper });

      expect(result.current.resolvePath("#section")).toBe("#section");
      expect(result.current.resolvePath("#top")).toBe("#top");
    });

    it("stripBasePath removes basePath prefix", () => {
      const wrapper = createWrapper("/oss/abc123");
      const { result } = renderHook(() => useRouteConfig(), { wrapper });

      expect(result.current.stripBasePath("/oss/abc123/query")).toBe("/query");
      expect(result.current.stripBasePath("/oss/abc123/checks/id")).toBe(
        "/checks/id",
      );
    });

    it("stripBasePath returns root for basePath-only pathname", () => {
      const wrapper = createWrapper("/oss/abc123");
      const { result } = renderHook(() => useRouteConfig(), { wrapper });

      expect(result.current.stripBasePath("/oss/abc123")).toBe("/");
    });

    it("stripBasePath leaves non-prefixed paths unchanged", () => {
      const wrapper = createWrapper("/oss/abc123");
      const { result } = renderHook(() => useRouteConfig(), { wrapper });

      expect(result.current.stripBasePath("/other/path")).toBe("/other/path");
      expect(result.current.stripBasePath("/query")).toBe("/query");
    });
  });
});

describe("useAppLocation with RouteConfigContext", () => {
  beforeEach(() => {
    global.mockNextNavigation.reset();
  });

  describe("without provider (backward compatibility)", () => {
    it("returns pathname unchanged", () => {
      global.mockNextNavigation.setPathname("/lineage");

      const { result } = renderHook(() => useAppLocation());
      const [location] = result.current;

      expect(location).toBe("/lineage");
    });

    it("navigates without path prefixing", () => {
      const router = global.mockNextNavigation.getRouter();

      const { result } = renderHook(() => useAppLocation());
      const [, setLocation] = result.current;

      act(() => {
        setLocation("/query?id=123");
      });

      expect(router.push).toHaveBeenCalledWith("/query?id=123", {
        scroll: true,
      });
    });
  });

  describe("with provider", () => {
    it("strips basePath from returned pathname", () => {
      global.mockNextNavigation.setPathname("/oss/abc123/lineage");
      const wrapper = createWrapper("/oss/abc123");

      const { result } = renderHook(() => useAppLocation(), { wrapper });
      const [location] = result.current;

      expect(location).toBe("/lineage");
    });

    it("navigates with path prefixing", () => {
      global.mockNextNavigation.setPathname("/oss/abc123/lineage");
      const router = global.mockNextNavigation.getRouter();
      const wrapper = createWrapper("/oss/abc123");

      const { result } = renderHook(() => useAppLocation(), { wrapper });
      const [, setLocation] = result.current;

      act(() => {
        setLocation("/query");
      });

      expect(router.push).toHaveBeenCalledWith("/oss/abc123/query", {
        scroll: true,
      });
    });

    it("preserves query string with path prefixing", () => {
      global.mockNextNavigation.setPathname("/oss/abc123/lineage");
      const router = global.mockNextNavigation.getRouter();
      const wrapper = createWrapper("/oss/abc123");

      const { result } = renderHook(() => useAppLocation(), { wrapper });
      const [, setLocation] = result.current;

      act(() => {
        setLocation("/checks?id=123&tab=details");
      });

      expect(router.push).toHaveBeenCalledWith(
        "/oss/abc123/checks?id=123&tab=details",
        { scroll: true },
      );
    });

    it("preserves fragment with path prefixing", () => {
      global.mockNextNavigation.setPathname("/oss/abc123/lineage");
      const router = global.mockNextNavigation.getRouter();
      const wrapper = createWrapper("/oss/abc123");

      const { result } = renderHook(() => useAppLocation(), { wrapper });
      const [, setLocation] = result.current;

      act(() => {
        setLocation("/docs#section");
      });

      expect(router.push).toHaveBeenCalledWith("/oss/abc123/docs#section", {
        scroll: true,
      });
    });

    it("preserves both query string and fragment with path prefixing", () => {
      global.mockNextNavigation.setPathname("/oss/abc123/lineage");
      const router = global.mockNextNavigation.getRouter();
      const wrapper = createWrapper("/oss/abc123");

      const { result } = renderHook(() => useAppLocation(), { wrapper });
      const [, setLocation] = result.current;

      act(() => {
        setLocation("/docs?tab=api#section");
      });

      expect(router.push).toHaveBeenCalledWith(
        "/oss/abc123/docs?tab=api#section",
        { scroll: true },
      );
    });

    it("handles query string with multiple ? characters correctly", () => {
      global.mockNextNavigation.setPathname("/oss/abc123/lineage");
      const router = global.mockNextNavigation.getRouter();
      const wrapper = createWrapper("/oss/abc123");

      const { result } = renderHook(() => useAppLocation(), { wrapper });
      const [, setLocation] = result.current;

      act(() => {
        setLocation("/query?param1=value?test&param2=other");
      });

      // Should only split on first ?, treating the rest as query string
      expect(router.push).toHaveBeenCalledWith(
        "/oss/abc123/query?param1=value?test&param2=other",
        { scroll: true },
      );
    });
  });
});

describe("useAppNavigation with RouteConfigContext", () => {
  beforeEach(() => {
    global.mockNextNavigation.reset();
  });

  describe("with provider", () => {
    it("strips basePath from returned pathname", () => {
      global.mockNextNavigation.setPathname("/oss/abc123/checks");
      const wrapper = createWrapper("/oss/abc123");

      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      expect(result.current.pathname).toBe("/checks");
    });

    it("push prefixes path with basePath", () => {
      global.mockNextNavigation.setPathname("/oss/abc123/lineage");
      const router = global.mockNextNavigation.getRouter();
      const wrapper = createWrapper("/oss/abc123");

      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.push("/query");
      });

      expect(router.push).toHaveBeenCalledWith("/oss/abc123/query", undefined);
    });

    it("replace prefixes path with basePath", () => {
      global.mockNextNavigation.setPathname("/oss/abc123/lineage");
      const router = global.mockNextNavigation.getRouter();
      const wrapper = createWrapper("/oss/abc123");

      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.replace("/query?id=456#section");
      });

      expect(router.replace).toHaveBeenCalledWith(
        "/oss/abc123/query?id=456#section",
        undefined,
      );
    });
  });
});

describe("useAppRoute with RouteConfigContext", () => {
  beforeEach(() => {
    global.mockNextNavigation.reset();
  });

  describe("with provider", () => {
    it("matches against logical (stripped) pathname", () => {
      global.mockNextNavigation.setPathname("/oss/abc123/checks");
      const wrapper = createWrapper("/oss/abc123");

      const { result } = renderHook(() => useAppRoute("/checks"), { wrapper });
      const [isMatch] = result.current;

      expect(isMatch).toBe(true);
    });

    it("matches dynamic routes against logical pathname", () => {
      global.mockNextNavigation.setPathname("/oss/abc123/checks/id-123");
      global.mockNextNavigation.setParams({ checkId: "id-123" });
      const wrapper = createWrapper("/oss/abc123");

      const { result } = renderHook(() => useAppRoute("/checks/:checkId"), {
        wrapper,
      });
      const [isMatch, params] = result.current;

      expect(isMatch).toBe(true);
      expect(params.checkId).toBe("id-123");
    });

    it("does not match full prefixed path pattern", () => {
      global.mockNextNavigation.setPathname("/oss/abc123/checks");
      const wrapper = createWrapper("/oss/abc123");

      // This should NOT match because we match against logical path (/checks)
      // not the full physical path (/oss/abc123/checks)
      const { result } = renderHook(() => useAppRoute("/oss/abc123/checks"), {
        wrapper,
      });
      const [isMatch] = result.current;

      expect(isMatch).toBe(false);
    });
  });
});
