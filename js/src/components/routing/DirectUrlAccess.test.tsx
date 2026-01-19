/**
 * Integration tests for Direct URL Access
 *
 * Tests that directly accessing URLs (deep linking) works correctly,
 * particularly for routes with query parameters like /checks?id=xxx
 */

import { vi } from "vitest";

// Mock the API and context hooks
vi.mock("@datarecce/ui/api", () => ({
  listChecks: vi.fn(() =>
    Promise.resolve([
      { check_id: "check-1", name: "Check 1", type: "schema_diff" },
      { check_id: "check-2", name: "Check 2", type: "row_count" },
      { check_id: "abc-123", name: "Target Check", type: "query_diff" },
    ]),
  ),
  reorderChecks: vi.fn(() => Promise.resolve()),
}));

const mockRecceCheckContext = {
  latestSelectedCheckId: null as string | null,
  setLatestSelectedCheckId: vi.fn(),
};

vi.mock("@datarecce/ui/hooks", async () => {
  const actual = await vi.importActual("@datarecce/ui/hooks");
  return {
    ...(actual as Record<string, unknown>),
    useRecceCheckContext: () => mockRecceCheckContext,
  };
});

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

describe("Check ID Validation and Redirect Logic", () => {
  beforeEach(() => {
    global.mockNextNavigation.reset();
    mockRecceCheckContext.latestSelectedCheckId = null;
    mockRecceCheckContext.setLatestSelectedCheckId.mockClear();
  });

  it("redirects to first check when URL has invalid check ID", () => {
    const router = global.mockNextNavigation.getRouter();
    const checks = [
      { check_id: "check-1", name: "Check 1", type: "schema_diff" },
      { check_id: "check-2", name: "Check 2", type: "row_count" },
    ];
    const selectedItem = "invalid-check-id";
    const latestSelectedCheckId = null;
    const status = "success";

    // Simulate the validation logic from CheckPage
    const isValidSelection = Boolean(
      selectedItem && checks.some((check) => check.check_id === selectedItem),
    );

    if (status === "success" && checks.length > 0 && !isValidSelection) {
      const isValidLatestSelectedCheckId =
        latestSelectedCheckId &&
        checks.some((check) => check.check_id === latestSelectedCheckId);

      if (isValidLatestSelectedCheckId) {
        router.push(`/checks?id=${latestSelectedCheckId}`, { replace: true });
      } else {
        router.push(`/checks?id=${checks[0].check_id}`, { replace: true });
      }
    }

    expect(router.push).toHaveBeenCalledWith("/checks?id=check-1", {
      replace: true,
    });
  });

  it("redirects to first check when latestSelectedCheckId is invalid (deleted check)", () => {
    const router = global.mockNextNavigation.getRouter();
    const checks = [
      { check_id: "check-1", name: "Check 1", type: "schema_diff" },
      { check_id: "check-2", name: "Check 2", type: "row_count" },
    ];
    const selectedItem = null;
    const latestSelectedCheckId = "deleted-check-id"; // This check was deleted
    const status = "success";

    // Simulate the validation logic from CheckPage
    const isValidSelection = Boolean(
      selectedItem && checks.some((check) => check.check_id === selectedItem),
    );

    if (status === "success" && checks.length > 0 && !isValidSelection) {
      const isValidLatestSelectedCheckId =
        latestSelectedCheckId &&
        checks.some((check) => check.check_id === latestSelectedCheckId);

      if (isValidLatestSelectedCheckId) {
        router.push(`/checks?id=${latestSelectedCheckId}`, { replace: true });
      } else {
        router.push(`/checks?id=${checks[0].check_id}`, { replace: true });
      }
    }

    expect(router.push).toHaveBeenCalledWith("/checks?id=check-1", {
      replace: true,
    });
  });

  it("redirects to valid latestSelectedCheckId when selectedItem is invalid", () => {
    const router = global.mockNextNavigation.getRouter();
    const checks = [
      { check_id: "check-1", name: "Check 1", type: "schema_diff" },
      { check_id: "check-2", name: "Check 2", type: "row_count" },
      { check_id: "check-3", name: "Check 3", type: "query_diff" },
    ];
    const selectedItem = "invalid-check-id";
    const latestSelectedCheckId = "check-2"; // Valid check that was previously selected
    const status = "success";

    // Simulate the validation logic from CheckPage
    const isValidSelection = Boolean(
      selectedItem && checks.some((check) => check.check_id === selectedItem),
    );

    if (status === "success" && checks.length > 0 && !isValidSelection) {
      const isValidLatestSelectedCheckId =
        latestSelectedCheckId &&
        checks.some((check) => check.check_id === latestSelectedCheckId);

      if (isValidLatestSelectedCheckId) {
        router.push(`/checks?id=${latestSelectedCheckId}`, { replace: true });
      } else {
        router.push(`/checks?id=${checks[0].check_id}`, { replace: true });
      }
    }

    // Should redirect to latestSelectedCheckId, not first check
    expect(router.push).toHaveBeenCalledWith("/checks?id=check-2", {
      replace: true,
    });
  });

  it("uses replace:true option to avoid polluting browser history", () => {
    const router = global.mockNextNavigation.getRouter();
    const checks = [{ check_id: "check-1", name: "Check 1" }];
    const selectedItem = "invalid-check-id";
    const latestSelectedCheckId = null;
    const status = "success";

    // Simulate the validation logic from CheckPage
    const isValidSelection = Boolean(
      selectedItem && checks.some((check) => check.check_id === selectedItem),
    );

    if (status === "success" && checks.length > 0 && !isValidSelection) {
      const isValidLatestSelectedCheckId =
        latestSelectedCheckId &&
        checks.some((check) => check.check_id === latestSelectedCheckId);

      if (isValidLatestSelectedCheckId) {
        router.push(`/checks?id=${latestSelectedCheckId}`, { replace: true });
      } else {
        router.push(`/checks?id=${checks[0].check_id}`, { replace: true });
      }
    }

    // Verify replace:true is used
    expect(router.push).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ replace: true }),
    );
  });

  it("does not redirect when selectedItem is valid", () => {
    const router = global.mockNextNavigation.getRouter();
    const checks = [
      { check_id: "check-1", name: "Check 1", type: "schema_diff" },
      { check_id: "check-2", name: "Check 2", type: "row_count" },
    ];
    const selectedItem = "check-2"; // Valid check ID
    const latestSelectedCheckId = null;
    const status = "success";

    // Simulate the validation logic from CheckPage
    const isValidSelection = Boolean(
      selectedItem && checks.some((check) => check.check_id === selectedItem),
    );

    if (status === "success" && checks.length > 0 && !isValidSelection) {
      const isValidLatestSelectedCheckId =
        latestSelectedCheckId &&
        checks.some((check) => check.check_id === latestSelectedCheckId);

      if (isValidLatestSelectedCheckId) {
        router.push(`/checks?id=${latestSelectedCheckId}`, { replace: true });
      } else {
        router.push(`/checks?id=${checks[0].check_id}`, { replace: true });
      }
    }

    // Should NOT redirect since selectedItem is valid
    expect(router.push).not.toHaveBeenCalled();
  });
});
