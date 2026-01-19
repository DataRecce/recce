/**
 * @file DataFrameColumnHeader.test.tsx
 * @description Tests for DataFrameColumnHeader component
 *
 * Tests cover:
 * - Basic rendering
 * - Pin/unpin functionality
 * - Precision menu for number columns
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import { DataFrameColumnHeader } from "../DataFrameColumnHeader";

// ============================================================================
// Basic Rendering Tests
// ============================================================================

describe("DataFrameColumnHeader - Basic Rendering", () => {
  test("renders column name", () => {
    render(<DataFrameColumnHeader name="price" columnType="number" />);

    expect(screen.getByText("price")).toBeInTheDocument();
  });

  test("renders with grid-header class", () => {
    const { container } = render(
      <DataFrameColumnHeader name="price" columnType="number" />,
    );

    expect(container.querySelector(".grid-header")).toBeInTheDocument();
  });
});

// ============================================================================
// Pin/Unpin Functionality Tests
// ============================================================================

describe("DataFrameColumnHeader - Pin/Unpin", () => {
  test("shows pin icon when not pinned", () => {
    render(
      <DataFrameColumnHeader
        name="price"
        columnType="number"
        pinnedColumns={[]}
        onPinnedColumnsChange={vi.fn()}
      />,
    );

    // Pin icon should exist but be hidden by default (display: none)
    const pinIcon = document.querySelector(".pin-icon");
    expect(pinIcon).toBeInTheDocument();
  });

  test("shows unpin icon when pinned", () => {
    render(
      <DataFrameColumnHeader
        name="price"
        columnType="number"
        pinnedColumns={["price"]}
        onPinnedColumnsChange={vi.fn()}
      />,
    );

    const unpinIcon = document.querySelector(".unpin-icon");
    expect(unpinIcon).toBeInTheDocument();
  });

  test("calls onPinnedColumnsChange when pinning", () => {
    const onPinnedColumnsChange = vi.fn();
    render(
      <DataFrameColumnHeader
        name="price"
        columnType="number"
        pinnedColumns={[]}
        onPinnedColumnsChange={onPinnedColumnsChange}
      />,
    );

    const pinIcon = document.querySelector(".pin-icon");
    expect(pinIcon).not.toBeNull();
    fireEvent.click(pinIcon as Element);

    expect(onPinnedColumnsChange).toHaveBeenCalledWith(["price"]);
  });

  test("calls onPinnedColumnsChange when unpinning", () => {
    const onPinnedColumnsChange = vi.fn();
    render(
      <DataFrameColumnHeader
        name="price"
        columnType="number"
        pinnedColumns={["price", "amount"]}
        onPinnedColumnsChange={onPinnedColumnsChange}
      />,
    );

    const unpinIcon = document.querySelector(".unpin-icon");
    expect(unpinIcon).not.toBeNull();
    fireEvent.click(unpinIcon as Element);

    expect(onPinnedColumnsChange).toHaveBeenCalledWith(["amount"]);
  });
});

// ============================================================================
// Precision Menu Tests
// ============================================================================

describe("DataFrameColumnHeader - Precision Menu", () => {
  test("shows menu button for number columns", () => {
    render(
      <DataFrameColumnHeader
        name="price"
        columnType="number"
        onColumnsRenderModeChanged={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Options")).toBeInTheDocument();
  });

  test("does not show menu button for non-number columns", () => {
    render(
      <DataFrameColumnHeader
        name="name"
        columnType="text"
        onColumnsRenderModeChanged={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Options")).not.toBeInTheDocument();
  });

  test("opens menu on button click", () => {
    render(
      <DataFrameColumnHeader
        name="price"
        columnType="number"
        onColumnsRenderModeChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Options"));

    expect(screen.getByText("Show raw value")).toBeInTheDocument();
    expect(screen.getByText("Show 2 decimal points")).toBeInTheDocument();
    expect(screen.getByText("Show as percentage")).toBeInTheDocument();
    expect(screen.getByText("Show with net change")).toBeInTheDocument();
  });

  test("calls onColumnsRenderModeChanged when option is selected", () => {
    const onColumnsRenderModeChanged = vi.fn();
    render(
      <DataFrameColumnHeader
        name="price"
        columnType="number"
        onColumnsRenderModeChanged={onColumnsRenderModeChanged}
      />,
    );

    fireEvent.click(screen.getByLabelText("Options"));
    fireEvent.click(screen.getByText("Show raw value"));

    expect(onColumnsRenderModeChanged).toHaveBeenCalledWith({ price: "raw" });
  });

  test("shows menu button but with no options when onColumnsRenderModeChanged is not provided", () => {
    render(<DataFrameColumnHeader name="price" columnType="number" />);

    // Menu button still appears for number columns
    expect(screen.getByLabelText("Options")).toBeInTheDocument();

    // But clicking it shows empty menu since no options were generated
    fireEvent.click(screen.getByLabelText("Options"));
    // Menu should not have precision options
    expect(screen.queryByText("Show raw value")).not.toBeInTheDocument();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("DataFrameColumnHeader - Edge Cases", () => {
  test("handles empty pinnedColumns array", () => {
    render(
      <DataFrameColumnHeader
        name="price"
        columnType="number"
        pinnedColumns={[]}
      />,
    );

    expect(screen.getByText("price")).toBeInTheDocument();
  });

  test("handles undefined callbacks gracefully", () => {
    render(<DataFrameColumnHeader name="price" columnType="number" />);

    // Should render without errors
    expect(screen.getByText("price")).toBeInTheDocument();
  });
});
