/**
 * @file DataFrameColumnGroupHeader.test.tsx
 * @description Tests for DataFrameColumnGroupHeader component
 *
 * Tests cover:
 * - Basic rendering
 * - Primary key indicator and toggle
 * - Pin/unpin functionality
 * - Precision menu for number columns
 * - Column status handling (added, removed)
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { DataFrameColumnGroupHeader } from "../DataFrameColumnGroupHeader";

// ============================================================================
// Basic Rendering Tests
// ============================================================================

describe("DataFrameColumnGroupHeader - Basic Rendering", () => {
  test("renders column name", () => {
    render(
      <DataFrameColumnGroupHeader
        name="price"
        columnStatus=""
        columnType="number"
      />,
    );

    expect(screen.getByText("price")).toBeInTheDocument();
  });

  test("renders with grid-header class", () => {
    const { container } = render(
      <DataFrameColumnGroupHeader
        name="price"
        columnStatus=""
        columnType="number"
      />,
    );

    expect(container.querySelector(".grid-header")).toBeInTheDocument();
  });

  test("renders empty fragment for index column", () => {
    const { container } = render(
      <DataFrameColumnGroupHeader
        name="index"
        columnStatus=""
        columnType="text"
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});

// ============================================================================
// Primary Key Tests
// ============================================================================

describe("DataFrameColumnGroupHeader - Primary Key", () => {
  test("shows key icon when column is a primary key", () => {
    render(
      <DataFrameColumnGroupHeader
        name="id"
        columnStatus=""
        columnType="integer"
        primaryKeys={["id"]}
      />,
    );

    // VscKey icon should be present
    const keyIcons = document.querySelectorAll("svg");
    expect(keyIcons.length).toBeGreaterThan(0);
  });

  test("shows close icon for PK column when onPrimaryKeyChange is provided", () => {
    render(
      <DataFrameColumnGroupHeader
        name="id"
        columnStatus=""
        columnType="integer"
        primaryKeys={["id"]}
        onPrimaryKeyChange={jest.fn()}
      />,
    );

    const closeIcon = document.querySelector(".close-icon");
    expect(closeIcon).toBeInTheDocument();
  });

  test("calls onPrimaryKeyChange when removing PK", () => {
    const onPrimaryKeyChange = jest.fn();
    render(
      <DataFrameColumnGroupHeader
        name="id"
        columnStatus=""
        columnType="integer"
        primaryKeys={["id", "region"]}
        onPrimaryKeyChange={onPrimaryKeyChange}
      />,
    );

    const closeIcon = document.querySelector(".close-icon");
    expect(closeIcon).not.toBeNull();
    fireEvent.click(closeIcon as Element);

    expect(onPrimaryKeyChange).toHaveBeenCalledWith(["region"]);
  });

  test("calls onPrimaryKeyChange when adding PK", () => {
    const onPrimaryKeyChange = jest.fn();
    render(
      <DataFrameColumnGroupHeader
        name="price"
        columnStatus=""
        columnType="number"
        primaryKeys={["id"]}
        onPrimaryKeyChange={onPrimaryKeyChange}
      />,
    );

    const keyIcon = document.querySelector(".key-icon");
    expect(keyIcon).not.toBeNull();
    fireEvent.click(keyIcon as Element);

    expect(onPrimaryKeyChange).toHaveBeenCalledWith(["id", "price"]);
  });

  test("removes index from PKs when adding new PK", () => {
    const onPrimaryKeyChange = jest.fn();
    render(
      <DataFrameColumnGroupHeader
        name="price"
        columnStatus=""
        columnType="number"
        primaryKeys={["index"]}
        onPrimaryKeyChange={onPrimaryKeyChange}
      />,
    );

    const keyIcon = document.querySelector(".key-icon");
    expect(keyIcon).not.toBeNull();
    fireEvent.click(keyIcon as Element);

    expect(onPrimaryKeyChange).toHaveBeenCalledWith(["price"]);
  });
});

// ============================================================================
// Pin/Unpin Functionality Tests
// ============================================================================

describe("DataFrameColumnGroupHeader - Pin/Unpin", () => {
  test("shows pin icon for non-PK columns when callback provided", () => {
    render(
      <DataFrameColumnGroupHeader
        name="price"
        columnStatus=""
        columnType="number"
        primaryKeys={["id"]}
        pinnedColumns={[]}
        onPinnedColumnsChange={jest.fn()}
      />,
    );

    const pinIcon = document.querySelector(".pin-icon");
    expect(pinIcon).toBeInTheDocument();
  });

  test("does not show pin icon for PK columns", () => {
    render(
      <DataFrameColumnGroupHeader
        name="id"
        columnStatus=""
        columnType="integer"
        primaryKeys={["id"]}
        pinnedColumns={[]}
        onPinnedColumnsChange={jest.fn()}
      />,
    );

    const pinIcon = document.querySelector(".pin-icon");
    expect(pinIcon).not.toBeInTheDocument();
  });

  test("calls onPinnedColumnsChange when pinning", () => {
    const onPinnedColumnsChange = jest.fn();
    render(
      <DataFrameColumnGroupHeader
        name="price"
        columnStatus=""
        columnType="number"
        primaryKeys={["id"]}
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
    const onPinnedColumnsChange = jest.fn();
    render(
      <DataFrameColumnGroupHeader
        name="price"
        columnStatus=""
        columnType="number"
        primaryKeys={["id"]}
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

describe("DataFrameColumnGroupHeader - Precision Menu", () => {
  test("shows menu button for non-PK number columns", () => {
    render(
      <DataFrameColumnGroupHeader
        name="price"
        columnStatus=""
        columnType="number"
        primaryKeys={["id"]}
        onColumnsRenderModeChanged={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Options")).toBeInTheDocument();
  });

  test("does not show menu button for PK columns", () => {
    render(
      <DataFrameColumnGroupHeader
        name="id"
        columnStatus=""
        columnType="number"
        primaryKeys={["id"]}
        onColumnsRenderModeChanged={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText("Options")).not.toBeInTheDocument();
  });

  test("does not show menu button for non-number columns", () => {
    render(
      <DataFrameColumnGroupHeader
        name="name"
        columnStatus=""
        columnType="text"
        primaryKeys={["id"]}
        onColumnsRenderModeChanged={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText("Options")).not.toBeInTheDocument();
  });

  test("opens menu on button click", () => {
    render(
      <DataFrameColumnGroupHeader
        name="price"
        columnStatus=""
        columnType="number"
        primaryKeys={["id"]}
        onColumnsRenderModeChanged={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Options"));

    expect(screen.getByText("Show raw value")).toBeInTheDocument();
    expect(screen.getByText("Show 2 decimal points")).toBeInTheDocument();
  });
});

// ============================================================================
// Column Status Tests
// ============================================================================

describe("DataFrameColumnGroupHeader - Column Status", () => {
  test("does not allow adding PK for added columns", () => {
    render(
      <DataFrameColumnGroupHeader
        name="new_col"
        columnStatus="added"
        columnType="text"
        primaryKeys={["id"]}
        onPrimaryKeyChange={jest.fn()}
      />,
    );

    // Key icon should not be shown for added columns
    const keyIcon = document.querySelector(".key-icon");
    expect(keyIcon).not.toBeInTheDocument();
  });

  test("does not allow adding PK for removed columns", () => {
    render(
      <DataFrameColumnGroupHeader
        name="old_col"
        columnStatus="removed"
        columnType="text"
        primaryKeys={["id"]}
        onPrimaryKeyChange={jest.fn()}
      />,
    );

    // Key icon should not be shown for removed columns
    const keyIcon = document.querySelector(".key-icon");
    expect(keyIcon).not.toBeInTheDocument();
  });

  test("allows adding PK for modified columns", () => {
    render(
      <DataFrameColumnGroupHeader
        name="price"
        columnStatus="modified"
        columnType="number"
        primaryKeys={["id"]}
        onPrimaryKeyChange={jest.fn()}
      />,
    );

    const keyIcon = document.querySelector(".key-icon");
    expect(keyIcon).toBeInTheDocument();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("DataFrameColumnGroupHeader - Edge Cases", () => {
  test("handles empty primaryKeys array", () => {
    render(
      <DataFrameColumnGroupHeader
        name="price"
        columnStatus=""
        columnType="number"
        primaryKeys={[]}
      />,
    );

    expect(screen.getByText("price")).toBeInTheDocument();
  });

  test("handles undefined callbacks gracefully", () => {
    render(
      <DataFrameColumnGroupHeader
        name="price"
        columnStatus=""
        columnType="number"
      />,
    );

    expect(screen.getByText("price")).toBeInTheDocument();
  });

  test("renders long column names", () => {
    render(
      <DataFrameColumnGroupHeader
        name="very_long_column_name_that_should_be_truncated"
        columnStatus=""
        columnType="text"
      />,
    );

    // Should render the full column name
    expect(
      screen.getByText("very_long_column_name_that_should_be_truncated"),
    ).toBeInTheDocument();
  });
});
