/**
 * @file EnvInfo.test.tsx
 * @description Comprehensive pre-migration tests for EnvInfo component
 *
 * Tests verify:
 * - Rendering environment information display
 * - Dialog opening and closing behavior
 * - DBT-specific information table rendering
 * - SQLMesh-specific information rendering
 * - Review mode vs dev mode information display
 * - Timestamp formatting and relative time display
 * - Schema extraction from lineage graph
 * - Environment tracking analytics
 *
 * Source of truth: OSS functionality - these tests document current behavior
 * before migration to @datarecce/ui
 */

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock @datarecce/ui/contexts
const mockUseLineageGraphContext = jest.fn();
jest.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: jest.fn(() => ({ basePath: "" })),
  useLineageGraphContext: () => mockUseLineageGraphContext(),
}));

// Mock tracking
jest.mock("@datarecce/ui/lib/api/track", () => ({
  EXPLORE_ACTION: {
    ROW_COUNT: "row_count",
    ROW_COUNT_DIFF: "row_count_diff",
    VALUE_DIFF: "value_diff",
  },
  EXPLORE_SOURCE: {
    LINEAGE_VIEW_TOP_BAR: "lineage_view_top_bar",
  },
  trackEnvironmentConfig: jest.fn(),
  trackExploreAction: jest.fn(),
}));

// Mock react-icons
jest.mock("react-icons/io5", () => ({
  IoClose: () => <span data-testid="close-icon">X</span>,
}));

jest.mock("react-icons/lu", () => ({
  LuExternalLink: () => <span data-testid="external-link-icon">↗</span>,
}));

jest.mock("react-icons/pi", () => ({
  PiInfo: () => <span data-testid="info-icon">i</span>,
}));

// ============================================================================
// Imports
// ============================================================================

import type { LineageGraph } from "@datarecce/ui";
import { EnvInfo } from "@datarecce/ui/components/app";
import { trackEnvironmentConfig } from "@datarecce/ui/lib/api/track";
import {
  extractSchemas,
  formatTimestamp,
  formatTimeToNow,
} from "@datarecce/ui/utils";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockEnvInfo = (overrides = {}) => ({
  adapterType: "dbt" as const,
  git: {
    branch: "main",
    commit: "abc123",
    repository: "test/repo",
  },
  pullRequest: {
    id: "123",
    title: "Test PR",
    url: "https://github.com/test/repo/pull/123",
  },
  dbt: {
    base: {
      dbt_version: "1.7.0",
      generated_at: "2024-01-01T10:00:00Z",
    },
    current: {
      dbt_version: "1.7.1",
      generated_at: "2024-01-02T10:00:00Z",
    },
  },
  ...overrides,
});

const createMockLineageGraph = (): LineageGraph => ({
  nodes: {
    node1: {
      id: "node1",
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: {
        id: "node1",
        name: "node1",
        from: "both",
        data: {
          base: {
            id: "node1",
            unique_id: "node1",
            name: "node1",
            schema: "schema_a",
          },
          current: {
            id: "node1",
            unique_id: "node1",
            name: "node1",
            schema: "schema_a",
          },
        },
        resourceType: "model",
        packageName: "test",
        parents: {},
        children: {},
      },
    },
    node2: {
      id: "node2",
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: {
        id: "node2",
        name: "node2",
        from: "both",
        data: {
          base: {
            id: "node2",
            unique_id: "node2",
            name: "node2",
            schema: "schema_b",
          },
          current: {
            id: "node2",
            unique_id: "node2",
            name: "node2",
            schema: "schema_c",
          },
        },
        resourceType: "model",
        packageName: "test",
        parents: {},
        children: {},
      },
    },
  },
  edges: {},
  modifiedSet: [],
  manifestMetadata: { base: undefined, current: undefined },
  catalogMetadata: { base: undefined, current: undefined },
});

// ============================================================================
// Test Setup
// ============================================================================

describe("EnvInfo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-15T12:00:00Z"));

    // Default mock context
    mockUseLineageGraphContext.mockReturnValue({
      envInfo: createMockEnvInfo(),
      reviewMode: false,
      lineageGraph: createMockLineageGraph(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders environment info button", () => {
      render(<EnvInfo />);

      expect(screen.getByTestId("info-icon")).toBeInTheDocument();
    });

    it("displays schema names for base and current", () => {
      render(<EnvInfo />);

      expect(screen.getByText("schema_a, schema_b")).toBeInTheDocument();
      expect(screen.getByText("schema_a, schema_c")).toBeInTheDocument();
    });

    it("displays relative time for base and current", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: createMockEnvInfo(),
        reviewMode: false,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      // Should show relative times (14 days ago and 13 days ago)
      expect(screen.getByText(/14 days ago/)).toBeInTheDocument();
      expect(screen.getByText(/13 days ago/)).toBeInTheDocument();
    });

    it("opens dialog when info button is clicked", () => {
      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText("Environment Information")).toBeInTheDocument();
    });

    it("closes dialog when close button is clicked", async () => {
      render(<EnvInfo />);

      // Open dialog
      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      // Close dialog
      const closeButton = screen
        .getAllByTestId("close-icon")[0]
        .closest("button");
      if (closeButton) {
        fireEvent.click(closeButton);
      }

      // Dialog should be closed - wait for transition
      await waitFor(() => {
        expect(
          screen.queryByText("Environment Information"),
        ).not.toBeInTheDocument();
      });
    });

    it("closes dialog when Close button in actions is clicked", async () => {
      render(<EnvInfo />);

      // Open dialog
      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      // Close via action button
      const closeActionButton = screen.getByRole("button", { name: /Close/i });
      fireEvent.click(closeActionButton);

      // Dialog should be closed - wait for transition
      await waitFor(() => {
        expect(
          screen.queryByText("Environment Information"),
        ).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // DBT Information Tests
  // ==========================================================================

  describe("DBT information", () => {
    it("displays DBT section when adapter type is dbt", () => {
      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText("DBT")).toBeInTheDocument();
    });

    it("displays schema table with base and current columns", () => {
      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText("base")).toBeInTheDocument();
      expect(screen.getByText("current")).toBeInTheDocument();
      expect(screen.getByText("schema")).toBeInTheDocument();
    });

    it("displays DBT versions", () => {
      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText("version")).toBeInTheDocument();
      expect(screen.getByText("1.7.0")).toBeInTheDocument();
      expect(screen.getByText("1.7.1")).toBeInTheDocument();
    });

    it("displays formatted timestamps", () => {
      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText("timestamp")).toBeInTheDocument();
      // Timestamps are formatted in local timezone, so check for pattern instead of exact values
      // The pattern is YYYY-MM-DDTHH:mm:ss
      const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
      const timestampCells = screen.getAllByText(timestampPattern);
      // Should have 2 timestamp cells (base and current)
      expect(timestampCells.length).toBeGreaterThanOrEqual(2);
    });

    it("does not display DBT section when adapter is not dbt", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: createMockEnvInfo({ adapterType: "sqlmesh" }),
        reviewMode: false,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.queryByText("DBT")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // SQLMesh Information Tests
  // ==========================================================================

  describe("SQLMesh information", () => {
    it("displays SQLMesh section when adapter type is sqlmesh", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: {
          adapterType: "sqlmesh",
          sqlmesh: {
            base_env: "prod",
            current_env: "dev",
          },
        },
        reviewMode: false,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText("SQLMesh")).toBeInTheDocument();
    });

    it("displays environment names for base and current", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: {
          adapterType: "sqlmesh",
          sqlmesh: {
            base_env: "prod",
            current_env: "dev",
          },
        },
        reviewMode: false,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText("Environment")).toBeInTheDocument();
      expect(screen.getByText("prod")).toBeInTheDocument();
      expect(screen.getByText("dev")).toBeInTheDocument();
    });

    it("does not display SQLMesh section when adapter is not sqlmesh", () => {
      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.queryByText("SQLMesh")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Review Mode Tests
  // ==========================================================================

  describe("review mode", () => {
    it("displays Review Information header in review mode", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: createMockEnvInfo(),
        reviewMode: true,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText("Review Information")).toBeInTheDocument();
    });

    it("displays Dev Information header when not in review mode", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: createMockEnvInfo(),
        reviewMode: false,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText("Dev Information")).toBeInTheDocument();
    });

    it("displays pull request URL as link in review mode", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: createMockEnvInfo(),
        reviewMode: true,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      const prLink = screen.getByRole("link");
      expect(prLink).toHaveAttribute(
        "href",
        "https://github.com/test/repo/pull/123",
      );
      expect(prLink).toHaveAttribute("target", "_blank");
    });

    it("displays git info in review mode", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: createMockEnvInfo(),
        reviewMode: true,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText(/branch:/)).toBeInTheDocument();
      expect(screen.getByText(/commit:/)).toBeInTheDocument();
      expect(screen.getByText(/repository:/)).toBeInTheDocument();
    });

    it("displays PR info in review mode", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: createMockEnvInfo(),
        reviewMode: true,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText(/id:/)).toBeInTheDocument();
      expect(screen.getByText(/title:/)).toBeInTheDocument();
    });

    it("displays only git info when not in review mode", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: createMockEnvInfo(),
        reviewMode: false,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText(/branch:/)).toBeInTheDocument();
      expect(screen.getByText(/commit:/)).toBeInTheDocument();
      expect(screen.getByText(/repository:/)).toBeInTheDocument();
      // PR info should not be displayed
      expect(screen.queryByText(/Test PR/)).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Environment Tracking Tests
  // ==========================================================================

  describe("environment tracking", () => {
    it("tracks environment configuration on mount", () => {
      render(<EnvInfo />);

      expect(trackEnvironmentConfig).toHaveBeenCalledTimes(1);
    });

    it("only tracks once even on re-renders", () => {
      const { rerender } = render(<EnvInfo />);

      rerender(<EnvInfo />);
      rerender(<EnvInfo />);

      expect(trackEnvironmentConfig).toHaveBeenCalledTimes(1);
    });

    it("tracks with correct adapter type", () => {
      render(<EnvInfo />);

      expect(trackEnvironmentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          adapter_type: "dbt",
        }),
      );
    });

    it("tracks review mode status", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: createMockEnvInfo(),
        reviewMode: true,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      expect(trackEnvironmentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          review_mode: true,
        }),
      );
    });

    it("tracks git info presence", () => {
      render(<EnvInfo />);

      expect(trackEnvironmentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          has_git_info: true,
        }),
      );
    });

    it("tracks PR info presence", () => {
      render(<EnvInfo />);

      expect(trackEnvironmentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          has_pr_info: true,
        }),
      );
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles missing env info gracefully", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: undefined,
        reviewMode: false,
        lineageGraph: undefined,
      });

      render(<EnvInfo />);

      expect(screen.getByTestId("info-icon")).toBeInTheDocument();
    });

    it("handles empty schemas", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: createMockEnvInfo(),
        reviewMode: false,
        lineageGraph: { nodes: {}, edges: [] },
      });

      render(<EnvInfo />);

      // Should render without crashing
      expect(screen.getByTestId("info-icon")).toBeInTheDocument();
    });

    it("handles null dbt info", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: {
          ...createMockEnvInfo(),
          dbt: {
            base: null,
            current: null,
          },
        },
        reviewMode: false,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      // Should still render DBT section but with empty values
      expect(screen.getByText("DBT")).toBeInTheDocument();
    });

    it("handles missing git info in dev mode", () => {
      mockUseLineageGraphContext.mockReturnValue({
        envInfo: {
          ...createMockEnvInfo(),
          git: null,
        },
        reviewMode: false,
        lineageGraph: createMockLineageGraph(),
      });

      render(<EnvInfo />);

      const infoButton = screen.getByRole("button", {
        name: /Environment Info/i,
      });
      fireEvent.click(infoButton);

      expect(screen.getByText("Dev Information")).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe("formatTimestamp", () => {
  it("formats ISO timestamp correctly", () => {
    const result = formatTimestamp("2024-01-15T10:30:45Z");
    // Result is in local timezone, so just verify the format pattern
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("handles different timezone formats", () => {
    const result = formatTimestamp("2024-01-15T10:30:45+00:00");
    // Result is in local timezone, so just verify the format pattern
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("preserves date for same-day local timezone conversion", () => {
    // Test that the function doesn't throw and returns valid format
    const result = formatTimestamp("2024-06-15T12:00:00Z");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    // The date part should be 2024-06 (June)
    expect(result).toMatch(/^2024-06/);
  });
});

describe("formatTimeToNow", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("formats time from past correctly", () => {
    const result = formatTimeToNow("2024-01-15T11:00:00Z");
    expect(result).toContain("ago");
  });

  it("handles recent times", () => {
    const result = formatTimeToNow("2024-01-15T11:59:00Z");
    expect(result).toContain("ago");
  });
});

describe("extractSchemas", () => {
  it("extracts unique schemas from lineage graph", () => {
    const lineageGraph = createMockLineageGraph();
    const [baseSchemas, currentSchemas] = extractSchemas(lineageGraph);

    expect(baseSchemas.size).toBe(2);
    expect(baseSchemas.has("schema_a")).toBe(true);
    expect(baseSchemas.has("schema_b")).toBe(true);

    expect(currentSchemas.size).toBe(2);
    expect(currentSchemas.has("schema_a")).toBe(true);
    expect(currentSchemas.has("schema_c")).toBe(true);
  });

  it("handles undefined lineage graph", () => {
    const [baseSchemas, currentSchemas] = extractSchemas(undefined);

    expect(baseSchemas.size).toBe(0);
    expect(currentSchemas.size).toBe(0);
  });

  it("handles empty nodes", () => {
    const lineageGraph = {
      nodes: {},
      edges: {},
      modifiedSet: [],
      manifestMetadata: { base: undefined, current: undefined },
      catalogMetadata: { base: undefined, current: undefined },
    } as LineageGraph;
    const [baseSchemas, currentSchemas] = extractSchemas(lineageGraph);

    expect(baseSchemas.size).toBe(0);
    expect(currentSchemas.size).toBe(0);
  });

  it("handles nodes without schema", () => {
    const lineageGraph = {
      nodes: {
        node1: {
          id: "node1",
          type: "lineageGraphNode",
          position: { x: 0, y: 0 },
          data: {
            id: "node1",
            name: "node1",
            from: "both",
            data: {
              base: { id: "node1", unique_id: "node1", name: "node1" },
              current: { id: "node1", unique_id: "node1", name: "node1" },
            },
            resourceType: "model",
            packageName: "test",
            parents: {},
            children: {},
          },
        },
      },
      edges: {},
      modifiedSet: [],
      manifestMetadata: { base: undefined, current: undefined },
      catalogMetadata: { base: undefined, current: undefined },
    } as LineageGraph;
    const [baseSchemas, currentSchemas] = extractSchemas(lineageGraph);

    expect(baseSchemas.size).toBe(0);
    expect(currentSchemas.size).toBe(0);
  });

  it("deduplicates schemas", () => {
    const lineageGraph = {
      nodes: {
        node1: {
          id: "node1",
          type: "lineageGraphNode",
          position: { x: 0, y: 0 },
          data: {
            id: "node1",
            name: "node1",
            from: "both",
            data: {
              base: {
                id: "node1",
                unique_id: "node1",
                name: "node1",
                schema: "schema_a",
              },
              current: {
                id: "node1",
                unique_id: "node1",
                name: "node1",
                schema: "schema_a",
              },
            },
            resourceType: "model",
            packageName: "test",
            parents: {},
            children: {},
          },
        },
        node2: {
          id: "node2",
          type: "lineageGraphNode",
          position: { x: 0, y: 0 },
          data: {
            id: "node2",
            name: "node2",
            from: "both",
            data: {
              base: {
                id: "node2",
                unique_id: "node2",
                name: "node2",
                schema: "schema_a",
              },
              current: {
                id: "node2",
                unique_id: "node2",
                name: "node2",
                schema: "schema_a",
              },
            },
            resourceType: "model",
            packageName: "test",
            parents: {},
            children: {},
          },
        },
      },
      edges: {},
      modifiedSet: [],
      manifestMetadata: { base: undefined, current: undefined },
      catalogMetadata: { base: undefined, current: undefined },
    } as LineageGraph;
    const [baseSchemas, currentSchemas] = extractSchemas(lineageGraph);

    expect(baseSchemas.size).toBe(1);
    expect(currentSchemas.size).toBe(1);
  });
});
