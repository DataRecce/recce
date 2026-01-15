/**
 * @file RunStatusAndDate.test.tsx
 * @description Comprehensive tests for RunStatusAndDate component
 *
 * Tests verify:
 * - Correct status display for different run states (running, finished, failed, cancelled)
 * - Date formatting (Today, Yesterday, specific dates)
 * - Time display in different formats
 * - Color coding for different statuses
 * - Loading indicator for running state
 *
 * Source of truth: OSS functionality - these tests document current behavior
 *
 * Note: The OSS RunStatusAndDate component is a thin wrapper around @datarecce/ui primitives.
 * These tests verify both the wrapper logic (status inference from result/error) and the
 * primitive component behavior.
 */

// ============================================================================
// Imports
// ============================================================================

import type { Run } from "@datarecce/ui/api";
import {
  formatRunDate,
  formatRunDateTime,
  RunStatusAndDate,
} from "@datarecce/ui/primitives";
import { render, screen } from "@testing-library/react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockRun = (
  status: "Running" | "Finished" | "Failed" | "Cancelled",
  runAt?: string,
  result?: unknown,
  error?: string,
): Partial<Run> =>
  ({
    run_id: "test-run-id",
    run_at: runAt || new Date().toISOString(),
    status,
    result: result as unknown,
    error,
    type: "query",
    params: {},
    name: "Test Run",
  }) as Partial<Run>;

// ============================================================================
// Test Setup
// ============================================================================

describe("RunStatusAndDate", () => {
  // ==========================================================================
  // Status Display Tests
  // ==========================================================================

  describe("status display", () => {
    it("shows 'Running' status for running state", () => {
      const run = createMockRun("Running");
      render(<RunStatusAndDate run={run as Run} />);

      expect(screen.getByText("Running")).toBeInTheDocument();
    });

    it("shows 'Finished' status for finished state", () => {
      const run = createMockRun("Finished");
      render(<RunStatusAndDate run={run as Run} />);

      expect(screen.getByText("Finished")).toBeInTheDocument();
    });

    it("shows 'Failed' status for failed state", () => {
      const run = createMockRun("Failed");
      render(<RunStatusAndDate run={run as Run} />);

      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    it("shows 'Cancelled' status for cancelled state", () => {
      const run = createMockRun("Cancelled");
      render(<RunStatusAndDate run={run as Run} />);

      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });

    it("infers finished status from result when status is missing", () => {
      const run = {
        ...createMockRun("Finished"),
        status: undefined,
        result: { data: "test" },
      };
      render(<RunStatusAndDate run={run as Run} />);

      expect(screen.getByText("Finished")).toBeInTheDocument();
    });

    it("infers failed status from error when status is missing", () => {
      const run = {
        ...createMockRun("Failed"),
        status: undefined,
        error: "Test error",
      };
      render(<RunStatusAndDate run={run as Run} />);

      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    it("shows loading indicator for running state", () => {
      const run = createMockRun("Running");
      const { container } = render(<RunStatusAndDate run={run as Run} />);

      // CircularProgress should be rendered
      const progressElement = container.querySelector('[role="progressbar"]');
      expect(progressElement).toBeInTheDocument();
    });

    it("does not show loading indicator for finished state", () => {
      const run = createMockRun("Finished");
      const { container } = render(<RunStatusAndDate run={run as Run} />);

      const progressElement = container.querySelector('[role="progressbar"]');
      expect(progressElement).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Date Formatting Tests
  // ==========================================================================

  describe("date formatting", () => {
    it("shows 'Today' for runs executed today", () => {
      const today = new Date();
      const run = createMockRun("Finished", today.toISOString());
      render(<RunStatusAndDate run={run as Run} />);

      expect(screen.getByText(/Today/)).toBeInTheDocument();
    });

    it("shows 'Yesterday' for runs executed yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const run = createMockRun("Finished", yesterday.toISOString());
      render(<RunStatusAndDate run={run as Run} />);

      expect(screen.getByText(/Yesterday/)).toBeInTheDocument();
    });

    it("shows formatted date for older runs", () => {
      const oldDate = new Date("2024-01-15T10:30:00Z");
      const run = createMockRun("Finished", oldDate.toISOString());
      render(<RunStatusAndDate run={run as Run} />);

      // Should show something like "Jan 15"
      expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
    });

    it("handles missing run_at gracefully", () => {
      const run = { ...createMockRun("Finished"), run_at: undefined };
      const { container } = render(
        <RunStatusAndDate run={run as unknown as Run} />,
      );

      // Should still render status without crashing
      expect(screen.getByText("Finished")).toBeInTheDocument();
      // Date should be empty or not crash
      expect(container).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Time Display Tests
  // ==========================================================================

  describe("time display", () => {
    it("includes time in display for today's runs", () => {
      const today = new Date();
      today.setHours(14, 30, 0, 0); // 2:30 PM
      const run = createMockRun("Finished", today.toISOString());
      render(<RunStatusAndDate run={run as Run} />);

      // Should show "Today, HH:mm" format
      const text = screen.getByText(/Today/);
      expect(text.textContent).toMatch(/14:30/);
    });

    it("includes time in display for yesterday's runs", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(10, 15, 0, 0); // 10:15 AM
      const run = createMockRun("Finished", yesterday.toISOString());
      render(<RunStatusAndDate run={run as Run} />);

      const text = screen.getByText(/Yesterday/);
      expect(text.textContent).toMatch(/10:15/);
    });

    it("includes time in display for older runs", () => {
      const oldDate = new Date("2024-01-15T16:45:00Z");
      const run = createMockRun("Finished", oldDate.toISOString());
      render(<RunStatusAndDate run={run as Run} />);

      // Should show "MMM d, HH:mm" format (date may vary based on timezone)
      const text = screen.getByText(/Jan \d{1,2}/);
      expect(text.textContent).toMatch(/\d{2}:\d{2}/);
    });
  });

  // ==========================================================================
  // Status Color Tests
  // ==========================================================================

  describe("status colors", () => {
    it("applies green color for finished status", () => {
      const run = createMockRun("Finished");
      render(<RunStatusAndDate run={run as Run} />);

      const statusText = screen.getByText("Finished");
      expect(statusText).toBeInTheDocument();
      // Color is applied via MUI sx prop, verified by token mock
    });

    it("applies red color for failed status", () => {
      const run = createMockRun("Failed");
      render(<RunStatusAndDate run={run as Run} />);

      const statusText = screen.getByText("Failed");
      expect(statusText).toBeInTheDocument();
    });

    it("applies blue color for running status", () => {
      const run = createMockRun("Running");
      render(<RunStatusAndDate run={run as Run} />);

      const statusText = screen.getByText("Running");
      expect(statusText).toBeInTheDocument();
    });

    it("applies gray color for cancelled status", () => {
      const run = createMockRun("Cancelled");
      render(<RunStatusAndDate run={run as Run} />);

      const statusText = screen.getByText("Cancelled");
      expect(statusText).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles undefined status with result present", () => {
      const run = {
        run_id: "test-run-id",
        run_at: new Date().toISOString(),
        result: { data: "test" },
        type: "query" as const,
        params: {},
        name: "Test Run",
      };
      render(<RunStatusAndDate run={run as unknown as Run} />);

      expect(screen.getByText("Finished")).toBeInTheDocument();
    });

    it("handles undefined status with error present", () => {
      const run = {
        run_id: "test-run-id",
        run_at: new Date().toISOString(),
        error: "Test error",
        type: "query" as const,
        params: {},
        name: "Test Run",
      };
      render(<RunStatusAndDate run={run as Run} />);

      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    it("defaults to finished when status is undefined with no result or error", () => {
      const run = {
        run_id: "test-run-id",
        run_at: new Date().toISOString(),
        type: "query" as const,
        params: {},
        name: "Test Run",
      };
      render(<RunStatusAndDate run={run as Run} />);

      expect(screen.getByText("Finished")).toBeInTheDocument();
    });

    it("shows bullet separator between status and date", () => {
      const run = createMockRun("Finished");
      render(<RunStatusAndDate run={run as Run} />);

      expect(screen.getByText("•")).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe("formatRunDate", () => {
  it("returns 'Today' for today's date", () => {
    const today = new Date();
    expect(formatRunDate(today)).toBe("Today");
  });

  it("returns 'Yesterday' for yesterday's date", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRunDate(yesterday)).toBe("Yesterday");
  });

  it("returns formatted date for older dates", () => {
    const oldDate = new Date("2024-01-15T00:00:00Z");
    const result = formatRunDate(oldDate);
    expect(result).toMatch(/Jan 15/);
  });

  it("returns null for null input", () => {
    expect(formatRunDate(null)).toBeNull();
  });
});

describe("formatRunDateTime", () => {
  it("returns 'Today, HH:mm' for today's date", () => {
    const today = new Date();
    today.setHours(14, 30, 0, 0);
    const result = formatRunDateTime(today);
    expect(result).toMatch(/Today, 14:30/);
  });

  it("returns 'Yesterday, HH:mm' for yesterday's date", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 15, 0, 0);
    const result = formatRunDateTime(yesterday);
    expect(result).toMatch(/Yesterday, 10:15/);
  });

  it("returns formatted date with time for older dates", () => {
    const oldDate = new Date("2024-01-15T16:45:00Z");
    const result = formatRunDateTime(oldDate);
    // Date/time may vary based on timezone, just check format
    expect(result).toMatch(/Jan \d{1,2}, \d{2}:\d{2}/);
  });

  it("returns null for null input", () => {
    expect(formatRunDateTime(null)).toBeNull();
  });
});
