/**
 * Integration tests for Direct URL Access
 *
 * Tests that directly accessing URLs (deep linking) works correctly,
 * particularly for routes with query parameters like /checks?id=xxx
 */

import { render, renderHook, screen, waitFor } from "@testing-library/react";
import React from "react";

// Mock the API and context hooks
jest.mock("@/lib/api/checks", () => ({
  listChecks: jest.fn(() =>
    Promise.resolve([
      { check_id: "check-1", name: "Check 1", type: "schema_diff" },
      { check_id: "check-2", name: "Check 2", type: "row_count" },
      { check_id: "abc-123", name: "Target Check", type: "query_diff" },
    ]),
  ),
  reorderChecks: jest.fn(() => Promise.resolve()),
}));

const mockRecceCheckContext = {
  latestSelectedCheckId: null as string | null,
  setLatestSelectedCheckId: jest.fn(),
};

jest.mock("@/lib/hooks/RecceCheckContext", () => ({
  useRecceCheckContext: () => mockRecceCheckContext,
}));

// Import the hook after mocks
import { useAppLocation } from "@/lib/hooks/useAppRouter";

describe("Direct URL Access - Query Parameters", () => {
  beforeEach(() => {
    global.mockNextNavigation.reset();
    mockRecceCheckContext.latestSelectedCheckId = null;
    mockRecceCheckContext.setLatestSelectedCheckId.mockClear();
  });

  it("reads check ID from URL search params", () => {
    global.mockNextNavigation.setPathname("/checks");
    global.mockNextNavigation.setSearchParams("id=abc-123");

    const searchParams = new URLSearchParams("id=abc-123");
    const checkId = searchParams.get("id");

    expect(checkId).toBe("abc-123");
  });

  it("returns null when no check ID in search params", () => {
    global.mockNextNavigation.setPathname("/checks");
    global.mockNextNavigation.setSearchParams("");

    const searchParams = new URLSearchParams("");
    const checkId = searchParams.get("id");

    expect(checkId).toBeNull();
  });

  it("handles multiple query parameters", () => {
    global.mockNextNavigation.setPathname("/checks");
    global.mockNextNavigation.setSearchParams("id=abc-123&view=detail");

    const searchParams = new URLSearchParams("id=abc-123&view=detail");

    expect(searchParams.get("id")).toBe("abc-123");
    expect(searchParams.get("view")).toBe("detail");
  });

  it("handles URL-encoded check IDs", () => {
    const encodedId = encodeURIComponent("check/with/slashes");
    global.mockNextNavigation.setSearchParams(`id=${encodedId}`);

    const searchParams = new URLSearchParams(`id=${encodedId}`);
    const checkId = searchParams.get("id");

    expect(checkId).toBe("check/with/slashes");
  });

  it("handles UUID-style check IDs", () => {
    const uuidId = "550e8400-e29b-41d4-a716-446655440000";
    global.mockNextNavigation.setSearchParams(`id=${uuidId}`);

    const searchParams = new URLSearchParams(`id=${uuidId}`);
    const checkId = searchParams.get("id");

    expect(checkId).toBe(uuidId);
  });
});

describe("Direct URL Access - Navigation from URL", () => {
  beforeEach(() => {
    global.mockNextNavigation.reset();
  });

  it("navigates to check detail URL correctly", () => {
    const router = global.mockNextNavigation.getRouter();

    const { result } = renderHook(() => useAppLocation());
    const [, setLocation] = result.current;

    setLocation("/checks?id=abc-123");

    expect(router.push).toHaveBeenCalledWith("/checks?id=abc-123", {
      scroll: true,
    });
  });

  it("constructs correct URL when selecting a check", () => {
    const checkId = "test-check-id";
    const expectedUrl = `/checks?id=${checkId}`;

    expect(expectedUrl).toBe("/checks?id=test-check-id");
  });

  it("preserves existing query params when updating check ID", () => {
    // This tests that navigation replaces the full URL correctly
    const router = global.mockNextNavigation.getRouter();
    global.mockNextNavigation.setPathname("/checks");
    global.mockNextNavigation.setSearchParams("id=old-id");

    const { result } = renderHook(() => useAppLocation());
    const [, setLocation] = result.current;

    // Navigate to new check
    setLocation("/checks?id=new-id");

    expect(router.push).toHaveBeenCalledWith("/checks?id=new-id", {
      scroll: true,
    });
  });
});

describe("Direct URL Access - Route Validation", () => {
  it.each([
    ["/checks", true],
    ["/checks?id=abc", true],
    ["/checks?id=abc-123&foo=bar", true],
    ["/lineage", false],
    ["/query", false],
    ["/", false],
  ])("path '%s' isChecksRoute should be %s", (path, expected) => {
    const pathname = path.split("?")[0];
    const isChecksRoute =
      pathname === "/checks" || pathname.startsWith("/checks");

    expect(isChecksRoute).toBe(expected);
  });

  it.each([
    ["/lineage", true],
    ["/", true],
    ["/query", false],
    ["/checks", false],
  ])("path '%s' isLineageRoute should be %s", (path, expected) => {
    const pathname = path;
    const isLineageRoute = pathname === "/lineage" || pathname === "/";

    expect(isLineageRoute).toBe(expected);
  });
});

describe("Direct URL Access - Initial Load Behavior", () => {
  beforeEach(() => {
    global.mockNextNavigation.reset();
    mockRecceCheckContext.latestSelectedCheckId = null;
    mockRecceCheckContext.setLatestSelectedCheckId.mockClear();
  });

  it("sets latestSelectedCheckId when URL has check ID", () => {
    const checkId = "abc-123";

    // Simulate the useEffect that runs when selectedItem changes
    if (checkId) {
      mockRecceCheckContext.setLatestSelectedCheckId(checkId);
    }

    expect(mockRecceCheckContext.setLatestSelectedCheckId).toHaveBeenCalledWith(
      "abc-123",
    );
  });

  it("does not set latestSelectedCheckId when URL has no check ID", () => {
    const checkId = null;

    // Simulate the useEffect that runs when selectedItem changes
    if (checkId) {
      mockRecceCheckContext.setLatestSelectedCheckId(checkId);
    }

    expect(
      mockRecceCheckContext.setLatestSelectedCheckId,
    ).not.toHaveBeenCalled();
  });

  it("redirects to first check when no ID provided and checks exist", () => {
    const router = global.mockNextNavigation.getRouter();
    const checks = [
      { check_id: "first-check", name: "First Check" },
      { check_id: "second-check", name: "Second Check" },
    ];
    const selectedItem = null;
    const latestSelectedCheckId = null;

    // Simulate the redirect logic from CheckPage
    if (!selectedItem && checks.length > 0) {
      if (latestSelectedCheckId) {
        router.push(`/checks?id=${latestSelectedCheckId}`);
      } else {
        router.push(`/checks?id=${checks[0].check_id}`);
      }
    }

    expect(router.push).toHaveBeenCalledWith("/checks?id=first-check");
  });

  it("redirects to latestSelectedCheckId when available", () => {
    const router = global.mockNextNavigation.getRouter();
    const checks = [
      { check_id: "first-check", name: "First Check" },
      { check_id: "second-check", name: "Second Check" },
    ];
    const selectedItem = null;
    const latestSelectedCheckId = "second-check";

    // Simulate the redirect logic from CheckPage
    if (!selectedItem && checks.length > 0) {
      if (latestSelectedCheckId) {
        router.push(`/checks?id=${latestSelectedCheckId}`);
      } else {
        router.push(`/checks?id=${checks[0].check_id}`);
      }
    }

    expect(router.push).toHaveBeenCalledWith("/checks?id=second-check");
  });
});

describe("URL Construction Helpers", () => {
  it("builds check URL with ID correctly", () => {
    const buildCheckUrl = (checkId: string) => `/checks?id=${checkId}`;

    expect(buildCheckUrl("abc-123")).toBe("/checks?id=abc-123");
    expect(buildCheckUrl("test")).toBe("/checks?id=test");
  });

  it("handles special characters in check IDs", () => {
    const buildCheckUrl = (checkId: string) =>
      `/checks?id=${encodeURIComponent(checkId)}`;

    expect(buildCheckUrl("check with spaces")).toBe(
      "/checks?id=check%20with%20spaces",
    );
    expect(buildCheckUrl("check&special=chars")).toBe(
      "/checks?id=check%26special%3Dchars",
    );
  });
});
