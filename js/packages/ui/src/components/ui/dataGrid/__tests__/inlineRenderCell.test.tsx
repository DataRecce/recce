/**
 * @file inlineRenderCell.test.tsx
 * @description Tests for inline diff cell renderer
 *
 * Tests cover:
 * - Single value rendering when base equals current
 * - Diff rendering when values differ
 * - Delta mode for numeric columns
 * - Custom DiffText component injection
 * - asNumber utility function
 */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import React from "react";
import { vi } from "vitest";
import type { RowObjectType } from "../../../../api";
import {
  asNumber,
  createInlineRenderCell,
  inlineRenderCell,
  parseFiniteNumeric,
} from "../inlineRenderCell";

// ============================================================================
// Helper Functions
// ============================================================================

interface RecceColumnContext {
  columnType?: string;
  columnRenderMode?: string | number;
  profileDiffPercentMode?: "percent_delta" | "percent_change";
}

type ColDefWithMetadata = ColDef<RowObjectType> & {
  context?: RecceColumnContext;
};

function createParams(
  data: Partial<RowObjectType> | undefined,
  colDef: ColDefWithMetadata,
): ICellRendererParams<RowObjectType> {
  // Ensure __status is present as required by RowObjectType
  const fullData: RowObjectType | undefined = data
    ? { __status: undefined, ...data }
    : undefined;

  return {
    data: fullData,
    colDef,
    value: undefined,
    node: undefined,
    api: undefined,
    rowIndex: 0,
    column: undefined,
    eGridCell: document.createElement("div"),
    getValue: vi.fn(),
    setValue: vi.fn(),
    formatValue: vi.fn(),
    refreshCell: vi.fn(),
    registerRowDragger: vi.fn(),
    setTooltip: vi.fn(),
  } as unknown as ICellRendererParams<RowObjectType>;
}

// ============================================================================
// asNumber Tests
// ============================================================================

describe("asNumber", () => {
  test("returns number as-is", () => {
    expect(asNumber(42)).toBe(42);
    expect(asNumber(3.14)).toBe(3.14);
    expect(asNumber(-10)).toBe(-10);
  });

  test("parses string to number", () => {
    expect(asNumber("42")).toBe(42);
    expect(asNumber("3.14")).toBe(3.14);
    expect(asNumber("-10")).toBe(-10);
  });

  test("returns 0 for non-numeric strings", () => {
    expect(asNumber("hello")).toBe(0);
    expect(asNumber("")).toBe(0);
  });

  test("returns 0 for non-numeric types", () => {
    expect(asNumber(null as unknown as string)).toBe(0);
    expect(asNumber(undefined as unknown as string)).toBe(0);
    expect(asNumber(true as unknown as number)).toBe(0);
  });

  test("handles NaN input", () => {
    expect(asNumber(NaN)).toBe(NaN);
    expect(Number.isNaN(asNumber(NaN))).toBe(true);
  });
});

// ============================================================================
// DRC-2866: strict numeric parsing for explicit percentage modes
// ============================================================================

describe("parseFiniteNumeric", () => {
  test.each([
    [12.5, 12.5],
    ["12.5", 12.5],
    [" 12.5 ", 12.5],
    ["12px", undefined],
    ["", undefined],
    ["   ", undefined],
    [true, undefined],
    [null, undefined],
    [undefined, undefined],
    [Number.NaN, undefined],
    [Number.POSITIVE_INFINITY, undefined],
    ["Infinity", undefined],
  ])("parses %p as %p without partial coercion", (value, expected) => {
    expect(parseFiniteNumeric(value)).toBe(expected);
  });
});

// ============================================================================
// Basic Rendering Tests
// ============================================================================

describe("inlineRenderCell - Basic Rendering", () => {
  test("renders null when data is undefined", () => {
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams(undefined, colDef);

    const result = inlineRenderCell(params);

    expect(result).toBeNull();
  });

  test("renders dash when neither base nor current exists", () => {
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams({}, colDef);

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("-")).toBeInTheDocument();
  });

  test("renders single value when base equals current", () => {
    const colDef: ColDefWithMetadata = { field: "price" };
    const params = createParams(
      { base__price: 100, current__price: 100 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("100")).toBeInTheDocument();
  });
});

// ============================================================================
// Diff Rendering Tests
// ============================================================================

describe("inlineRenderCell - Diff Rendering", () => {
  test("renders both values when they differ", () => {
    const colDef: ColDefWithMetadata = { field: "price" };
    const params = createParams(
      { base__price: "before", current__price: "after" },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    expect(
      screen.getByText("before").closest("[data-comparison-role]"),
    ).toHaveAttribute("data-comparison-role", "base");
    expect(
      screen.getByText("after").closest("[data-comparison-role]"),
    ).toHaveAttribute("data-comparison-role", "current");
  });

  test("renders only current when base is missing", () => {
    const colDef: ColDefWithMetadata = { field: "price" };
    const params = createParams({ current__price: 150 }, colDef);

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("150")).toBeInTheDocument();
  });

  test("renders only base when current is missing", () => {
    const colDef: ColDefWithMetadata = { field: "price" };
    const params = createParams({ base__price: 100 }, colDef);

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("100")).toBeInTheDocument();
  });
});

// ============================================================================
// Delta Mode Tests
// ============================================================================

describe("inlineRenderCell - Delta Mode", () => {
  test("shows delta for numeric columns in delta mode", () => {
    const colDef: ColDefWithMetadata = {
      field: "price",
      context: { columnType: "number", columnRenderMode: "delta" },
    };
    const params = createParams(
      { base__price: 100, current__price: 105 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    // Current value should be shown
    expect(screen.getByText("105")).toBeInTheDocument();
    expect(screen.getByText("(+5)")).toHaveAttribute(
      "data-direction",
      "increase",
    );
    expect(screen.getByText("↑", { exact: false })).toBeInTheDocument();
  });

  test("shows negative delta correctly", () => {
    const colDef: ColDefWithMetadata = {
      field: "price",
      context: { columnType: "number", columnRenderMode: "delta" },
    };
    const params = createParams(
      { base__price: 150, current__price: 100 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("(-50)")).toBeInTheDocument();
  });

  test("handles zero base value in delta mode", () => {
    const colDef: ColDefWithMetadata = {
      field: "price",
      context: { columnType: "number", columnRenderMode: "delta" },
    };
    const params = createParams(
      { base__price: 0, current__price: 100 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("(+100)")).toBeInTheDocument();
  });
});

// ============================================================================
// DRC-2866: explicit percentage-point and relative-percent modes
// ============================================================================

describe("inlineRenderCell - DRC-2866 explicit percentage modes", () => {
  function renderExplicitMode(
    mode: "percent_delta" | "percent_change",
    data: Partial<RowObjectType>,
    field = mode === "percent_delta" ? "proportion" : "row_count",
    columnType = mode === "percent_delta" ? "float" : "integer",
  ) {
    const colDef: ColDefWithMetadata = {
      field,
      context: {
        columnType,
        columnRenderMode: mode,
        profileDiffPercentMode: mode,
      },
    };

    render(<>{inlineRenderCell(createParams(data, colDef))}</>);
  }

  test("renders a percentage-point decrease with unrounded tooltip values", async () => {
    renderExplicitMode("percent_delta", {
      base__proportion: 0.98,
      current__proportion: 0.94,
    });

    expect(screen.getByText("94%")).toBeInTheDocument();
    expect(screen.getByText("(-4pp)")).toHaveAttribute(
      "data-direction",
      "decrease",
    );

    fireEvent.mouseOver(screen.getByText("94%"));
    expect(await screen.findByText(/Base: 0\.98/)).toBeInTheDocument();
    expect(screen.getByText(/Current: 0\.94/)).toBeInTheDocument();
    expect(screen.getByText(/Change: -4pp/)).toBeInTheDocument();
  });

  test.each([
    [0.5, 0.6, "0.6", "(+20%)", "increase"],
    [0.5, 0.4, "0.4", "(-20%)", "decrease"],
  ] as const)(
    "renders a %s to %s relative change as %s %s",
    (base, current, currentText, changeText, direction) => {
      renderExplicitMode("percent_change", {
        base__row_count: base,
        current__row_count: current,
      });

      expect(screen.getByText(currentText)).toBeInTheDocument();
      expect(screen.getByText(changeText)).toHaveAttribute(
        "data-direction",
        direction,
      );
    },
  );

  test("renders an unchanged zero relative value as an explicit percentage with a tooltip", async () => {
    renderExplicitMode("percent_change", {
      base__row_count: 0,
      current__row_count: 0,
    });

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.queryByText("N/A")).not.toBeInTheDocument();

    fireEvent.mouseOver(screen.getByText("0%"));
    expect(await screen.findByText(/Base: 0/)).toBeInTheDocument();
    expect(screen.getByText(/Current: 0/)).toBeInTheDocument();
    expect(screen.getByText(/Change: 0/)).toBeInTheDocument();
  });

  test.each([
    ["raw", "0.98", "0.94"],
    ["percent", "98%", "94%"],
    [2, "0.98", "0.94"],
  ] as const)(
    "keeps the legacy %p mode rendering unchanged",
    (mode, baseText, currentText) => {
      const colDef: ColDefWithMetadata = {
        field: "proportion",
        context: { columnType: "float", columnRenderMode: mode },
      };
      render(
        <>
          {inlineRenderCell(
            createParams(
              { base__proportion: 0.98, current__proportion: 0.94 },
              colDef,
            ),
          )}
        </>,
      );

      expect(screen.getByText(baseText)).toBeInTheDocument();
      expect(screen.getByText(currentText)).toBeInTheDocument();
    },
  );

  test.each([
    [0, 0.2],
    [-0.1, 0.2],
    [-0.1, -0.1],
  ])("renders %s to %s relative change as N/A", (base, current) => {
    renderExplicitMode("percent_change", {
      base__row_count: base,
      current__row_count: current,
    });

    expect(screen.getByText("N/A")).toHaveAttribute("data-direction", "equal");
  });

  test.each([
    [null, 0.94],
    [true, 0.94],
    ["", 0.94],
    ["12px", 0.94],
    [Number.NaN, 0.94],
    [Number.POSITIVE_INFINITY, 0.94],
  ])(
    "keeps invalid %p to %p values in the existing inline presentation",
    (base, current) => {
      renderExplicitMode("percent_change", {
        base__row_count: base,
        current__row_count: current,
      });

      expect(screen.queryByText("N/A")).not.toBeInTheDocument();
      expect(document.querySelector("[data-comparison-role]")).not.toBeNull();
    },
  );

  test.each(["added", "removed"] as const)(
    "keeps %s rows in the existing inline structural presentation",
    (status) => {
      renderExplicitMode("percent_change", {
        __status: status,
        base__row_count: 0,
        current__row_count: 0.94,
      });

      expect(screen.queryByText("N/A")).not.toBeInTheDocument();
      expect(document.querySelector("[data-comparison-role]")).not.toBeNull();
    },
  );

  test("keeps the full computed percentage-point change in the tooltip", async () => {
    renderExplicitMode("percent_delta", {
      base__proportion: 0.9,
      current__proportion: 0.941234,
    });

    expect(screen.getByText("(+4.12pp)")).toBeInTheDocument();
    fireEvent.mouseOver(screen.getByText("94.12%"));
    expect(
      await screen.findByText(/Change: \+4\.123400000000004pp/),
    ).toBeInTheDocument();
  });

  test.each([
    ["percent_delta", "proportion", "float"],
    ["percent_change", "row_count", "integer"],
  ] as const)(
    "falls back when %s arithmetic overflows",
    (mode, field, columnType) => {
      renderExplicitMode(
        mode,
        {
          [`base__${field}`]: Number.MIN_VALUE,
          [`current__${field}`]: Number.MAX_VALUE,
        },
        field,
        columnType,
      );

      expect(document.querySelectorAll("[data-comparison-role]")).toHaveLength(
        2,
      );
    },
  );
});

// ============================================================================
// createInlineRenderCell Tests
// ============================================================================

describe("createInlineRenderCell", () => {
  test("creates renderer with default DiffText", () => {
    const renderer = createInlineRenderCell();
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams({ base__value: 1, current__value: 2 }, colDef);

    render(<>{renderer(params)}</>);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  test("accepts custom DiffText component", () => {
    const CustomDiffText = ({ value }: { value: string }) => (
      <span data-testid="custom-diff">[{value}]</span>
    );

    const renderer = createInlineRenderCell({
      DiffTextComponent: CustomDiffText,
    });
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams({ base__value: 1, current__value: 2 }, colDef);

    render(<>{renderer(params)}</>);

    const customElements = screen.getAllByTestId("custom-diff");
    expect(customElements).toHaveLength(2);
    expect(screen.getByText("[1]")).toBeInTheDocument();
    expect(screen.getByText("[2]")).toBeInTheDocument();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("inlineRenderCell - Edge Cases", () => {
  test("handles case-insensitive field matching", () => {
    const colDef: ColDefWithMetadata = { field: "Price" };
    const params = createParams(
      { base__price: 100, current__price: 150 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    // Should find values with lowercase keys
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  test("handles null values in diff", () => {
    const colDef: ColDefWithMetadata = { field: "value" };
    const params = createParams(
      { base__value: null, current__value: 42 },
      colDef,
    );

    render(<>{inlineRenderCell(params)}</>);

    // null is rendered as "-" in DiffText when grayOut is true
    // The current value should be present
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  test("handles missing colDef field gracefully", () => {
    const colDef: ColDefWithMetadata = {};
    const params = createParams({ base__: 1, current__: 2 }, colDef);

    // Should not throw
    expect(() => inlineRenderCell(params)).not.toThrow();
  });
});

// ============================================================================
// DRC-3025: the unchanged/changed decision is type-dispatched
//
// Inline is the DEFAULT display mode for the profile, value-diff-detail and
// query-diff views, so this renderer — not just the side-by-side cell class — is
// what decides whether float noise reads as a change on screen. "raw" render
// mode is used throughout so the two values stay textually distinguishable
// instead of both rounding to 2 decimals.
// ============================================================================

describe("inlineRenderCell - DRC-3025 type-dispatched change detection", () => {
  const floatCol: ColDefWithMetadata = {
    field: "avg",
    context: { columnType: "float", columnRenderMode: "raw" },
  };
  const decimalCol: ColDefWithMetadata = {
    field: "price",
    context: { columnType: "number", columnRenderMode: "raw" },
  };

  test("FLOAT column: a noise-only difference renders one value, not a diff", () => {
    const params = createParams(
      { base__avg: "0.3", current__avg: "0.30000000000000004" },
      floatCol,
    );

    render(<>{inlineRenderCell(params)}</>);

    // Unchanged renders the current value alone; the base value appearing at all
    // means a DiffText was rendered and the phantom change is back on screen.
    expect(screen.getByText("0.30000000000000004")).toBeInTheDocument();
    expect(screen.queryByText("0.3")).not.toBeInTheDocument();
  });

  test("FLOAT column: a genuine change still renders both values", () => {
    const params = createParams(
      { base__avg: "0.3", current__avg: "0.9" },
      floatCol,
    );

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("0.3")).toBeInTheDocument();
    expect(screen.getByText("0.9")).toBeInTheDocument();
  });

  test("NUMBER column: a 1-cent decimal change renders both values", () => {
    const params = createParams(
      { base__price: "19.99", current__price: "19.98" },
      decimalCol,
    );

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("19.99")).toBeInTheDocument();
    expect(screen.getByText("19.98")).toBeInTheDocument();
  });

  test("NUMBER column: sub-epsilon differences are NOT smoothed", () => {
    // The cycle-4 guard: only "float" opts into the epsilon. A DECIMAL column
    // must keep reporting a difference this small.
    const params = createParams(
      { base__price: "0.3", current__price: "0.30000000000000004" },
      decimalCol,
    );

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("0.3")).toBeInTheDocument();
    expect(screen.getByText("0.30000000000000004")).toBeInTheDocument();
  });

  test("untyped column: differences stay exact", () => {
    const params = createParams(
      { base__value: "0.3", current__value: "0.30000000000000004" },
      { field: "value", context: { columnRenderMode: "raw" } },
    );

    render(<>{inlineRenderCell(params)}</>);

    expect(screen.getByText("0.3")).toBeInTheDocument();
    expect(screen.getByText("0.30000000000000004")).toBeInTheDocument();
  });
});
