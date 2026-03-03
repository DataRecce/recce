/**
 * @file RouteConfigContext.test.tsx
 * @description Tests for @datarecce/ui RouteConfigContext
 *
 * Tests verify:
 * - Provider renders children correctly
 * - Default basePath behavior (OSS mode)
 * - Custom basePath behavior (Cloud mode)
 * - resolvePath function handles all edge cases
 * - useRouteConfig returns defaults outside provider
 * - useRouteConfigSafe returns null outside provider
 * - Nested provider behavior
 */

import { render, renderHook, screen } from "@testing-library/react";
import {
  RouteConfigProvider,
  useRouteConfig,
  useRouteConfigSafe,
} from "../RouteConfigContext";

// =============================================================================
// Provider Basics Tests
// =============================================================================

describe("RouteConfigContext", () => {
  describe("Provider Basics", () => {
    it("renders children correctly", () => {
      render(
        <RouteConfigProvider>
          <div data-testid="child">Child Content</div>
        </RouteConfigProvider>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("provides context value to children", () => {
      const TestComponent = () => {
        const { basePath } = useRouteConfig();
        return <div data-testid="base-path">{basePath || "empty"}</div>;
      };

      render(
        <RouteConfigProvider basePath="/oss/abc123">
          <TestComponent />
        </RouteConfigProvider>,
      );

      expect(screen.getByTestId("base-path")).toHaveTextContent("/oss/abc123");
    });
  });

  // =============================================================================
  // Default Behavior (OSS Mode) Tests
  // =============================================================================

  describe("Default Behavior (OSS Mode)", () => {
    it("defaults to empty basePath when not specified", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider>{children}</RouteConfigProvider>
        ),
      });

      expect(result.current.basePath).toBe("");
    });

    it("returns path unchanged when basePath is empty", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider>{children}</RouteConfigProvider>
        ),
      });

      expect(result.current.resolvePath("/query")).toBe("/query");
      expect(result.current.resolvePath("/checks")).toBe("/checks");
      expect(result.current.resolvePath("/checks?id=123")).toBe(
        "/checks?id=123",
      );
    });
  });

  // =============================================================================
  // Cloud Mode Tests
  // =============================================================================

  describe("Cloud Mode (with basePath)", () => {
    it("provides custom basePath when specified", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123">
            {children}
          </RouteConfigProvider>
        ),
      });

      expect(result.current.basePath).toBe("/oss/abc123");
    });

    it("prefixes paths with basePath", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123">
            {children}
          </RouteConfigProvider>
        ),
      });

      expect(result.current.resolvePath("/query")).toBe("/oss/abc123/query");
      expect(result.current.resolvePath("/checks")).toBe("/oss/abc123/checks");
    });

    it("handles preview basePath", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/preview/session123">
            {children}
          </RouteConfigProvider>
        ),
      });

      expect(result.current.resolvePath("/query")).toBe(
        "/preview/session123/query",
      );
    });
  });

  // =============================================================================
  // resolvePath Edge Cases Tests
  // =============================================================================

  describe("resolvePath Edge Cases", () => {
    it("avoids double-prefixing when path already starts with basePath", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123">
            {children}
          </RouteConfigProvider>
        ),
      });

      expect(result.current.resolvePath("/oss/abc123/query")).toBe(
        "/oss/abc123/query",
      );
    });

    it("handles HTTP URLs without prefixing", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123">
            {children}
          </RouteConfigProvider>
        ),
      });

      expect(result.current.resolvePath("http://example.com/path")).toBe(
        "http://example.com/path",
      );
    });

    it("handles HTTPS URLs without prefixing", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123">
            {children}
          </RouteConfigProvider>
        ),
      });

      expect(result.current.resolvePath("https://example.com/path")).toBe(
        "https://example.com/path",
      );
    });

    it("handles hash-only paths without prefixing", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123">
            {children}
          </RouteConfigProvider>
        ),
      });

      expect(result.current.resolvePath("#section")).toBe("#section");
    });

    it("handles paths without leading slash", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123">
            {children}
          </RouteConfigProvider>
        ),
      });

      expect(result.current.resolvePath("query")).toBe("/oss/abc123/query");
    });

    it("handles basePath with trailing slash", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123/">
            {children}
          </RouteConfigProvider>
        ),
      });

      // Should not have double slashes
      expect(result.current.resolvePath("/query")).toBe("/oss/abc123/query");
    });

    it("handles empty path", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123">
            {children}
          </RouteConfigProvider>
        ),
      });

      expect(result.current.resolvePath("")).toBe("/oss/abc123/");
    });
  });

  // =============================================================================
  // Hook Behavior Outside Provider Tests
  // =============================================================================

  describe("useRouteConfig Outside Provider", () => {
    it("returns default config with empty basePath", () => {
      const { result } = renderHook(() => useRouteConfig());

      expect(result.current.basePath).toBe("");
    });

    it("returns identity resolvePath function", () => {
      const { result } = renderHook(() => useRouteConfig());

      expect(result.current.resolvePath("/query")).toBe("/query");
      expect(result.current.resolvePath("/checks")).toBe("/checks");
    });

    it("allows OSS components to work without provider", () => {
      // This demonstrates the intended use case:
      // OSS can use useRouteConfig and it works without any provider
      const TestComponent = () => {
        const { resolvePath } = useRouteConfig();
        const fullPath = resolvePath("/checks");
        return <div data-testid="path">{fullPath}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId("path")).toHaveTextContent("/checks");
    });
  });

  // =============================================================================
  // useRouteConfigSafe Tests
  // =============================================================================

  describe("useRouteConfigSafe", () => {
    it("returns null when called outside provider", () => {
      const { result } = renderHook(() => useRouteConfigSafe());

      expect(result.current).toBeNull();
    });

    it("returns context value when called inside provider", () => {
      const { result } = renderHook(() => useRouteConfigSafe(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123">
            {children}
          </RouteConfigProvider>
        ),
      });

      expect(result.current).not.toBeNull();
      expect(result.current?.basePath).toBe("/oss/abc123");
      expect(result.current?.resolvePath("/query")).toBe("/oss/abc123/query");
    });

    it("allows detection of provider presence", () => {
      // This demonstrates the intended use case:
      // Components can detect if RouteConfigProvider is present
      const TestComponent = () => {
        const config = useRouteConfigSafe();
        const hasProvider = config !== null;
        return (
          <div data-testid="has-provider">{hasProvider ? "yes" : "no"}</div>
        );
      };

      // Without provider
      const { unmount } = render(<TestComponent />);
      expect(screen.getByTestId("has-provider")).toHaveTextContent("no");
      unmount();

      // With provider
      render(
        <RouteConfigProvider basePath="/oss/abc123">
          <TestComponent />
        </RouteConfigProvider>,
      );
      expect(screen.getByTestId("has-provider")).toHaveTextContent("yes");
    });
  });

  // =============================================================================
  // Nested Provider Tests
  // =============================================================================

  describe("Nested Providers", () => {
    it("inner provider overrides outer provider", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/outer/path">
            <RouteConfigProvider basePath="/inner/path">
              {children}
            </RouteConfigProvider>
          </RouteConfigProvider>
        ),
      });

      expect(result.current.basePath).toBe("/inner/path");
      expect(result.current.resolvePath("/query")).toBe("/inner/path/query");
    });
  });

  // =============================================================================
  // Real-World Usage Tests
  // =============================================================================

  describe("Real-World Usage Patterns", () => {
    it("handles setLocation pattern from recce-ui", () => {
      // Simulates how useAppLocation uses resolvePath
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123">
            {children}
          </RouteConfigProvider>
        ),
      });

      // setLocation("/query?tab=results") pattern
      const fullPath = "/query?tab=results";
      const [pathPart, queryPart] = fullPath.split("?");
      const resolvedPath = result.current.resolvePath(pathPart);
      const finalPath = queryPart
        ? `${resolvedPath}?${queryPart}`
        : resolvedPath;

      expect(finalPath).toBe("/oss/abc123/query?tab=results");
    });

    it("works with replace navigation pattern", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/preview/session123">
            {children}
          </RouteConfigProvider>
        ),
      });

      // Navigation that replaces history entry
      expect(result.current.resolvePath("/checks")).toBe(
        "/preview/session123/checks",
      );
    });

    it("preserves query parameters in resolved paths", () => {
      const { result } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123">
            {children}
          </RouteConfigProvider>
        ),
      });

      // Query params should be handled by consumer, not by resolvePath
      const path = "/checks";
      const resolved = result.current.resolvePath(path);
      expect(resolved).toBe("/oss/abc123/checks");

      // Consumer adds query params after resolution
      const withQuery = `${resolved}?id=check-123&view=diff`;
      expect(withQuery).toBe("/oss/abc123/checks?id=check-123&view=diff");
    });
  });

  // =============================================================================
  // Memoization Tests
  // =============================================================================

  describe("Memoization", () => {
    it("returns same resolvePath reference when basePath unchanged", () => {
      const { result, rerender } = renderHook(() => useRouteConfig(), {
        wrapper: ({ children }) => (
          <RouteConfigProvider basePath="/oss/abc123">
            {children}
          </RouteConfigProvider>
        ),
      });

      const firstResolvePath = result.current.resolvePath;
      rerender();
      const secondResolvePath = result.current.resolvePath;

      expect(firstResolvePath).toBe(secondResolvePath);
    });
  });
});
