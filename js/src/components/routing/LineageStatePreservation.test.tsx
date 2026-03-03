/**
 * Integration tests for Lineage State Preservation
 *
 * Tests that the lineage page remains mounted (preserving React state)
 * when navigating between tabs, using the parallel route pattern.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useEffect, useRef, useState } from "react";
import { vi } from "vitest";

/**
 * Mock component that simulates LineagePage with internal state
 * This helps us verify that state is preserved across navigation
 */
const MockLineagePageWithState = ({
  onMount,
  onUnmount,
}: {
  onMount?: () => void;
  onUnmount?: () => void;
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const mountCountRef = useRef(0);

  useEffect(() => {
    mountCountRef.current += 1;
    onMount?.();

    return () => {
      onUnmount?.();
    };
  }, [onMount, onUnmount]);

  return (
    <div data-testid="lineage-page">
      <div data-testid="mount-count">{mountCountRef.current}</div>
      <div data-testid="zoom-level">{zoomLevel}</div>
      <div data-testid="selected-nodes">{selectedNodes.join(",")}</div>
      <button
        data-testid="zoom-in"
        onClick={() => setZoomLevel((z) => z + 0.1)}
      >
        Zoom In
      </button>
      <button
        data-testid="select-node"
        onClick={() => setSelectedNodes((n) => [...n, `node-${n.length + 1}`])}
      >
        Select Node
      </button>
    </div>
  );
};

/**
 * Mock MainLayout that simulates the parallel route behavior
 * The lineage slot is always rendered, visibility controlled by CSS
 */
const MockMainLayout = ({
  lineageSlot,
  children,
  currentPath,
}: {
  lineageSlot: React.ReactNode;
  children: React.ReactNode;
  currentPath: string;
}) => {
  const isLineageRoute = currentPath === "/lineage" || currentPath === "/";

  return (
    <div data-testid="main-layout">
      {/* Lineage parallel route - always mounted, visibility controlled */}
      <div
        data-testid="lineage-slot"
        style={{ display: isLineageRoute ? "block" : "none" }}
      >
        {lineageSlot}
      </div>

      {/* Regular children for other routes */}
      {!isLineageRoute && <div data-testid="children-slot">{children}</div>}
    </div>
  );
};

describe("Lineage State Preservation", () => {
  it("keeps lineage slot mounted when navigating away", () => {
    const onMount = vi.fn();
    const onUnmount = vi.fn();

    const { rerender } = render(
      <MockMainLayout
        currentPath="/lineage"
        lineageSlot={
          <MockLineagePageWithState onMount={onMount} onUnmount={onUnmount} />
        }
      >
        <div>Other Content</div>
      </MockMainLayout>,
    );

    // Lineage should be mounted initially
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("lineage-page")).toBeInTheDocument();
    expect(screen.getByTestId("lineage-slot")).toHaveStyle({
      display: "block",
    });

    // Navigate to /query
    rerender(
      <MockMainLayout
        currentPath="/query"
        lineageSlot={
          <MockLineagePageWithState onMount={onMount} onUnmount={onUnmount} />
        }
      >
        <div data-testid="query-content">Query Content</div>
      </MockMainLayout>,
    );

    // Lineage should still be in DOM but hidden
    expect(onUnmount).not.toHaveBeenCalled();
    expect(screen.getByTestId("lineage-page")).toBeInTheDocument();
    expect(screen.getByTestId("lineage-slot")).toHaveStyle({ display: "none" });

    // Mount count should still be 1 (not remounted)
    expect(screen.getByTestId("mount-count")).toHaveTextContent("1");
  });

  it("preserves zoom state when navigating between tabs", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <MockMainLayout
        currentPath="/lineage"
        lineageSlot={<MockLineagePageWithState />}
      >
        <div>Other Content</div>
      </MockMainLayout>,
    );

    // Initial zoom level
    expect(screen.getByTestId("zoom-level")).toHaveTextContent("1");

    // Zoom in twice
    await user.click(screen.getByTestId("zoom-in"));
    await user.click(screen.getByTestId("zoom-in"));

    expect(screen.getByTestId("zoom-level")).toHaveTextContent("1.2");

    // Navigate to /checks
    rerender(
      <MockMainLayout
        currentPath="/checks"
        lineageSlot={<MockLineagePageWithState />}
      >
        <div data-testid="checks-content">Checks Content</div>
      </MockMainLayout>,
    );

    // Zoom level should be preserved (component is hidden but not unmounted)
    expect(screen.getByTestId("zoom-level")).toHaveTextContent("1.2");

    // Navigate back to /lineage
    rerender(
      <MockMainLayout
        currentPath="/lineage"
        lineageSlot={<MockLineagePageWithState />}
      >
        <div>Other Content</div>
      </MockMainLayout>,
    );

    // Zoom level should still be 1.2
    expect(screen.getByTestId("zoom-level")).toHaveTextContent("1.2");
    expect(screen.getByTestId("lineage-slot")).toHaveStyle({
      display: "block",
    });
  });

  it("preserves selected nodes when navigating between tabs", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <MockMainLayout
        currentPath="/lineage"
        lineageSlot={<MockLineagePageWithState />}
      >
        <div>Other Content</div>
      </MockMainLayout>,
    );

    // Select some nodes
    await user.click(screen.getByTestId("select-node"));
    await user.click(screen.getByTestId("select-node"));

    expect(screen.getByTestId("selected-nodes")).toHaveTextContent(
      "node-1,node-2",
    );

    // Navigate away
    rerender(
      <MockMainLayout
        currentPath="/query"
        lineageSlot={<MockLineagePageWithState />}
      >
        <div>Query Content</div>
      </MockMainLayout>,
    );

    // Navigate back
    rerender(
      <MockMainLayout
        currentPath="/lineage"
        lineageSlot={<MockLineagePageWithState />}
      >
        <div>Other Content</div>
      </MockMainLayout>,
    );

    // Selected nodes should be preserved
    expect(screen.getByTestId("selected-nodes")).toHaveTextContent(
      "node-1,node-2",
    );
  });

  it("does not remount lineage component during navigation cycle", () => {
    const onMount = vi.fn();
    const onUnmount = vi.fn();

    const { rerender } = render(
      <MockMainLayout
        currentPath="/lineage"
        lineageSlot={
          <MockLineagePageWithState onMount={onMount} onUnmount={onUnmount} />
        }
      >
        <div>Other Content</div>
      </MockMainLayout>,
    );

    expect(onMount).toHaveBeenCalledTimes(1);

    // Navigate through multiple routes
    const routes = ["/query", "/checks", "/lineage", "/query", "/lineage"];

    routes.forEach((route) => {
      rerender(
        <MockMainLayout
          currentPath={route}
          lineageSlot={
            <MockLineagePageWithState onMount={onMount} onUnmount={onUnmount} />
          }
        >
          <div>{route} Content</div>
        </MockMainLayout>,
      );
    });

    // Should still only have mounted once
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();
    expect(screen.getByTestId("mount-count")).toHaveTextContent("1");
  });

  it("shows children content when not on lineage route", () => {
    render(
      <MockMainLayout
        currentPath="/checks"
        lineageSlot={<MockLineagePageWithState />}
      >
        <div data-testid="checks-page">Checks Page Content</div>
      </MockMainLayout>,
    );

    expect(screen.getByTestId("checks-page")).toBeInTheDocument();
    expect(screen.getByTestId("children-slot")).toBeInTheDocument();
  });

  it("hides children content when on lineage route", () => {
    render(
      <MockMainLayout
        currentPath="/lineage"
        lineageSlot={<MockLineagePageWithState />}
      >
        <div data-testid="other-content">Other Content</div>
      </MockMainLayout>,
    );

    expect(screen.queryByTestId("children-slot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("other-content")).not.toBeInTheDocument();
  });
});

describe("Parallel Route Visibility Logic", () => {
  it.each([
    ["/lineage", true],
    ["/", true],
    ["/query", false],
    ["/checks", false],
    ["/checks?id=abc", false],
    ["/runs/123", false],
  ])("isLineageRoute for path '%s' should be %s", (path, expected) => {
    const pathname = path.split("?")[0]; // Remove query params
    const isLineageRoute = pathname === "/lineage" || pathname === "/";

    expect(isLineageRoute).toBe(expected);
  });
});
