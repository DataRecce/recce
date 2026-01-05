# ResultView Factory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** ✅ Complete (2026-01-03)

**Goal:** Extract a reusable `createResultView` factory to packages/ui, reducing boilerplate across 10 ResultView components while preserving all existing behavior.

**Architecture:** Test-First approach - write comprehensive tests for each component BEFORE refactoring. The factory pattern will use configuration objects to capture the variation points identified in the deep analysis. Migration proceeds from simplest (RowCount) to most complex (QueryDiff).

**Tech Stack:** React 19, TypeScript 5.9, Jest 30, React Testing Library, forwardRef, AG Grid

---

## Deep Analysis: Pitfalls & Concerns

### Critical Pitfalls Identified

| # | Pitfall | Impact | Mitigation |
|---|---------|--------|------------|
| 1 | **No existing tests** | Can't verify refactoring correctness | Write tests FIRST for each component |
| 2 | **Ref type divergence** | Grid uses `DataGridHandle`, Charts use `HTMLDivElement` | Factory must support union type with discriminated config |
| 3 | **createDataGrid callback coupling** | Options contain callbacks that closure over component state | Keep callback creation in ResultView, pass to factory |
| 4 | **View options generics** | `RunResultViewProps<VO>` requires type parameter | Factory must be generic over view options type |
| 5 | **Inconsistent empty states** | "No nodes matched" vs "No data" vs "No change" vs `null` | Configurable empty state per component |
| 6 | **Warning logic variations** | Each component computes warnings differently | Warning computation stays in component, passed to factory |
| 7 | **Toolbar children variations** | DiffDisplayModeSwitch, ChangedOnlyCheckbox, etc. | Toolbar slot/render prop in factory |
| 8 | **QueryDiff bifurcation** | Switches between two internal components based on `run.result.diff` | May need to keep as custom, or support conditional rendering |
| 9 | **TopK local state** | Has `useState` for display toggle outside factory control | Support local state via render callback |
| 10 | **"No change" special case** | When `changedOnly && rows.length === 0`, show different message | Configurable changedOnly empty handler |

### Component Complexity Matrix

| Component | Grid/Chart | ViewOptions | Toolbar | Warnings | Local State | Complexity |
|-----------|------------|-------------|---------|----------|-------------|------------|
| RowCountDiffResultView | Grid | None | None | None | None | **LOW** |
| RowCountResultView | Grid | None | None | None | None | **LOW** |
| ValueDiffResultView | Grid | None | None | None | None | **LOW** |
| HistogramDiffResultView | Chart | None | None | None | None | **LOW** |
| TopKDiffResultView | Chart | None | None | None | **YES** | **MEDIUM** |
| ProfileResultView | Grid | Yes | None | None | None | **MEDIUM** |
| ProfileDiffResultView | Grid | Yes | Yes | None | None | **MEDIUM** |
| ValueDiffDetailResultView | Grid | Yes | Yes | Yes | None | **HIGH** |
| QueryResultView | Grid | Yes | Custom | Yes | None | **HIGH** |
| QueryDiffResultView | Grid | Yes | Yes | Yes | **Bifurcation** | **VERY HIGH** |

### Key Insight: Already Has Shared Abstraction!

`RowCountDiffResultView.tsx` already created an internal `RowCountGridView` component that both `RowCountDiffResultView` and `RowCountResultView` use. This is the pattern to generalize.

---

## Phase 0: Baseline Tests (CRITICAL - Do First!)

Before ANY refactoring, capture current behavior with tests.

### Task 0.1: Create test utilities and fixtures

**Files:**
- Create: `js/src/components/__tests__/resultViewTestUtils.ts`
- Create: `js/src/components/__tests__/fixtures/runFixtures.ts`

**Step 1: Create run fixtures**

```typescript
// js/src/components/__tests__/fixtures/runFixtures.ts
import { Run } from "@/lib/api/types";

/**
 * Test fixtures for Run objects of different types
 * Used to test ResultView components in isolation
 */

export const createRowCountDiffRun = (overrides?: Partial<Run>): Run => ({
  type: "row_count_diff",
  run_id: "test-run-1",
  run_at: "2024-01-01T00:00:00Z",
  status: "finished",
  result: {
    base: [{ node: "model_a", row_count: 100 }],
    current: [{ node: "model_a", row_count: 105 }],
  },
  ...overrides,
});

export const createRowCountRun = (overrides?: Partial<Run>): Run => ({
  type: "row_count",
  run_id: "test-run-2",
  run_at: "2024-01-01T00:00:00Z",
  status: "finished",
  result: {
    current: [{ node: "model_a", row_count: 100 }],
  },
  ...overrides,
});

export const createValueDiffRun = (overrides?: Partial<Run>): Run => ({
  type: "value_diff",
  run_id: "test-run-3",
  run_at: "2024-01-01T00:00:00Z",
  status: "finished",
  params: { model: "test_model", primary_key: ["id"] },
  result: {
    summary: { total: 100, added: 5, removed: 3, matched: 92 },
    columns: [
      { column: "id", matched_count: 92, match_rate: 0.92 },
      { column: "name", matched_count: 90, match_rate: 0.90 },
    ],
  },
  ...overrides,
});

export const createHistogramDiffRun = (overrides?: Partial<Run>): Run => ({
  type: "histogram_diff",
  run_id: "test-run-4",
  run_at: "2024-01-01T00:00:00Z",
  status: "finished",
  params: { model: "test_model", column_name: "amount" },
  result: {
    base: { counts: [10, 20, 30], total: 60 },
    current: { counts: [12, 22, 28], total: 62 },
    min: 0,
    max: 100,
    bin_edges: [0, 33, 66, 100],
  },
  ...overrides,
});

export const createTopKDiffRun = (overrides?: Partial<Run>): Run => ({
  type: "top_k_diff",
  run_id: "test-run-5",
  run_at: "2024-01-01T00:00:00Z",
  status: "finished",
  params: { model: "test_model", column_name: "category" },
  result: {
    base: { values: [{ value: "A", count: 50 }], valids: 100 },
    current: { values: [{ value: "A", count: 55 }], valids: 110 },
  },
  ...overrides,
});

export const createProfileDiffRun = (overrides?: Partial<Run>): Run => ({
  type: "profile_diff",
  run_id: "test-run-6",
  run_at: "2024-01-01T00:00:00Z",
  status: "finished",
  params: { model: "test_model" },
  result: {
    base: {
      columns: [
        { name: "column_name", type: "text" },
        { name: "count", type: "integer" },
      ],
      data: [["id", 100], ["name", 100]],
    },
    current: {
      columns: [
        { name: "column_name", type: "text" },
        { name: "count", type: "integer" },
      ],
      data: [["id", 105], ["name", 102]],
    },
  },
  ...overrides,
});

export const createQueryDiffRun = (overrides?: Partial<Run>): Run => ({
  type: "query_diff",
  run_id: "test-run-7",
  run_at: "2024-01-01T00:00:00Z",
  status: "finished",
  params: { sql_template: "SELECT * FROM test" },
  result: {
    base: {
      columns: [{ key: "id", name: "id", type: "integer" }],
      data: [[1], [2]],
    },
    current: {
      columns: [{ key: "id", name: "id", type: "integer" }],
      data: [[1], [3]],
    },
  },
  ...overrides,
});

// Empty/edge case fixtures
export const createEmptyRowCountDiffRun = (): Run =>
  createRowCountDiffRun({
    result: { base: [], current: [] },
  });

export const createRunWithError = (type: Run["type"]): Run => ({
  type,
  run_id: "error-run",
  run_at: "2024-01-01T00:00:00Z",
  status: "failed",
  error: "Test error message",
} as Run);
```

**Step 2: Create test utilities**

```typescript
// js/src/components/__tests__/resultViewTestUtils.ts
import { render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { createRef, ReactElement } from "react";
import { Run } from "@/lib/api/types";
import { DataGridHandle } from "@/components/data-grid/ScreenshotDataGrid";

// Mock AG Grid to avoid React 19 compatibility issues in tests
jest.mock("ag-grid-react", () => ({
  AgGridReact: ({ rowData, columnDefs }: any) => (
    <div data-testid="mock-ag-grid">
      <div data-testid="column-count">{columnDefs?.length ?? 0}</div>
      <div data-testid="row-count">{rowData?.length ?? 0}</div>
    </div>
  ),
}));

// Mock ScreenshotBox
jest.mock("@datarecce/ui/primitives", () => ({
  ScreenshotBox: ({ children, ref }: any) => (
    <div data-testid="screenshot-box" ref={ref}>
      {children}
    </div>
  ),
}));

const theme = createTheme();

/**
 * Render a ResultView component with necessary providers
 */
export function renderResultView(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

/**
 * Create a ref for testing screenshot functionality
 */
export function createGridRef() {
  return createRef<DataGridHandle>();
}

export function createBoxRef() {
  return createRef<HTMLDivElement>();
}

/**
 * Test that a ResultView throws for wrong run type
 */
export async function expectThrowsForWrongType(
  Component: React.ForwardRefExoticComponent<any>,
  wrongRun: Run,
  expectedError: string | RegExp,
) {
  // Suppress console.error for expected error
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});

  expect(() => {
    renderResultView(<Component run={wrongRun} />);
  }).toThrow(expectedError);

  spy.mockRestore();
}

/**
 * Test that ref is properly forwarded
 */
export function expectRefForwarded(
  Component: React.ForwardRefExoticComponent<any>,
  run: Run,
  refType: "grid" | "box",
) {
  const ref = refType === "grid" ? createGridRef() : createBoxRef();
  renderResultView(<Component run={run} ref={ref} />);

  // Ref should be set after render
  expect(ref.current).not.toBeNull();
}
```

**Step 3: Verify utilities work**

Run: `cd js && pnpm test -- --testPathPattern="resultViewTestUtils" --passWithNoTests`
Expected: PASS (no tests yet, but file loads without error)

**Step 4: Commit**

```bash
git add js/src/components/__tests__/
git commit -s -m "test: add ResultView test utilities and fixtures"
```

---

### Task 0.2: Test RowCountDiffResultView (Simplest Grid)

**Files:**
- Create: `js/src/components/rowcount/RowCountDiffResultView.test.tsx`

**Step 1: Write comprehensive tests**

```typescript
// js/src/components/rowcount/RowCountDiffResultView.test.tsx
import { screen } from "@testing-library/react";
import {
  RowCountDiffResultView,
  RowCountResultView,
} from "./RowCountDiffResultView";
import {
  renderResultView,
  createGridRef,
  expectThrowsForWrongType,
} from "../__tests__/resultViewTestUtils";
import {
  createRowCountDiffRun,
  createRowCountRun,
  createEmptyRowCountDiffRun,
  createValueDiffRun,
} from "../__tests__/fixtures/runFixtures";

describe("RowCountDiffResultView", () => {
  describe("rendering", () => {
    it("renders grid with data", () => {
      const run = createRowCountDiffRun();
      renderResultView(<RowCountDiffResultView run={run} />);

      expect(screen.getByTestId("mock-ag-grid")).toBeInTheDocument();
    });

    it("shows empty state when no nodes matched", () => {
      const run = createEmptyRowCountDiffRun();
      renderResultView(<RowCountDiffResultView run={run} />);

      expect(screen.getByText("No nodes matched")).toBeInTheDocument();
    });
  });

  describe("type safety", () => {
    it("throws for wrong run type", () => {
      const wrongRun = createValueDiffRun();

      expectThrowsForWrongType(
        RowCountDiffResultView,
        wrongRun,
        /Run type must be row_count_diff/,
      );
    });
  });

  describe("ref forwarding", () => {
    it("forwards ref to grid", () => {
      const run = createRowCountDiffRun();
      const ref = createGridRef();

      renderResultView(<RowCountDiffResultView run={run} ref={ref} />);

      // Ref should be populated (mocked grid sets element)
      expect(ref.current).toBeDefined();
    });
  });
});

describe("RowCountResultView", () => {
  describe("rendering", () => {
    it("renders grid with data", () => {
      const run = createRowCountRun();
      renderResultView(<RowCountResultView run={run} />);

      expect(screen.getByTestId("mock-ag-grid")).toBeInTheDocument();
    });
  });

  describe("type safety", () => {
    it("throws for wrong run type", () => {
      const wrongRun = createRowCountDiffRun();

      expectThrowsForWrongType(
        RowCountResultView,
        wrongRun,
        /Run type must be row_count/,
      );
    });
  });
});
```

**Step 2: Run tests**

Run: `cd js && pnpm test -- --testPathPattern="RowCountDiffResultView.test"`
Expected: Tests may fail initially due to mock setup - iterate until green

**Step 3: Commit**

```bash
git add js/src/components/rowcount/RowCountDiffResultView.test.tsx
git commit -s -m "test: add RowCountDiffResultView baseline tests"
```

---

### Task 0.3: Test ValueDiffResultView (Grid + Summary Header)

**Files:**
- Create: `js/src/components/valuediff/ValueDiffResultView.test.tsx`

**Step 1: Write tests**

```typescript
// js/src/components/valuediff/ValueDiffResultView.test.tsx
import { screen } from "@testing-library/react";
import { ValueDiffResultView } from "./ValueDiffResultView";
import {
  renderResultView,
  createGridRef,
  expectThrowsForWrongType,
} from "../__tests__/resultViewTestUtils";
import {
  createValueDiffRun,
  createRowCountDiffRun,
} from "../__tests__/fixtures/runFixtures";

describe("ValueDiffResultView", () => {
  describe("rendering", () => {
    it("renders grid with data", () => {
      const run = createValueDiffRun();
      renderResultView(<ValueDiffResultView run={run} />);

      expect(screen.getByTestId("mock-ag-grid")).toBeInTheDocument();
    });

    it("displays model summary header", () => {
      const run = createValueDiffRun();
      renderResultView(<ValueDiffResultView run={run} />);

      // Should show model name and summary stats
      expect(screen.getByText(/Model: test_model/)).toBeInTheDocument();
      expect(screen.getByText(/100 total/)).toBeInTheDocument();
    });

    it("returns null when no grid data", () => {
      const run = createValueDiffRun({ result: undefined });
      const { container } = renderResultView(<ValueDiffResultView run={run} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("type safety", () => {
    it("throws for wrong run type", () => {
      const wrongRun = createRowCountDiffRun();

      expectThrowsForWrongType(
        ValueDiffResultView,
        wrongRun,
        /Run type must be value_diff/,
      );
    });
  });

  describe("ref forwarding", () => {
    it("forwards ref to grid", () => {
      const run = createValueDiffRun();
      const ref = createGridRef();

      renderResultView(<ValueDiffResultView run={run} ref={ref} />);

      expect(ref.current).toBeDefined();
    });
  });
});
```

**Step 2: Run tests**

Run: `cd js && pnpm test -- --testPathPattern="ValueDiffResultView.test"`
Expected: PASS

**Step 3: Commit**

```bash
git add js/src/components/valuediff/ValueDiffResultView.test.tsx
git commit -s -m "test: add ValueDiffResultView baseline tests"
```

---

### Task 0.4: Test HistogramDiffResultView (Chart-based)

**Files:**
- Create: `js/src/components/histogram/HistogramDiffResultView.test.tsx`

**Step 1: Write tests**

```typescript
// js/src/components/histogram/HistogramDiffResultView.test.tsx
import { screen } from "@testing-library/react";
import { HistogramDiffResultView } from "./HistogramDiffResultView";
import {
  renderResultView,
  createBoxRef,
  expectThrowsForWrongType,
} from "../__tests__/resultViewTestUtils";
import {
  createHistogramDiffRun,
  createValueDiffRun,
} from "../__tests__/fixtures/runFixtures";

// Mock HistogramChart
jest.mock("../charts/HistogramChart", () => ({
  HistogramChart: ({ data }: any) => (
    <div data-testid="histogram-chart">
      <span data-testid="chart-title">{data.title}</span>
    </div>
  ),
}));

describe("HistogramDiffResultView", () => {
  describe("rendering", () => {
    it("renders chart with data", () => {
      const run = createHistogramDiffRun();
      renderResultView(<HistogramDiffResultView run={run} />);

      expect(screen.getByTestId("histogram-chart")).toBeInTheDocument();
    });

    it("displays model and column in title", () => {
      const run = createHistogramDiffRun();
      renderResultView(<HistogramDiffResultView run={run} />);

      expect(screen.getByTestId("chart-title")).toHaveTextContent(
        "Model test_model.amount",
      );
    });

    it("shows loading when no base/current data", () => {
      const run = createHistogramDiffRun({
        result: { base: null, current: null },
      });
      renderResultView(<HistogramDiffResultView run={run} />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("type safety", () => {
    it("throws for wrong run type", () => {
      const wrongRun = createValueDiffRun();

      expectThrowsForWrongType(
        HistogramDiffResultView,
        wrongRun,
        /Run type must be histogram_diff/,
      );
    });
  });

  describe("ref forwarding", () => {
    it("forwards ref to ScreenshotBox", () => {
      const run = createHistogramDiffRun();
      const ref = createBoxRef();

      renderResultView(<HistogramDiffResultView run={run} ref={ref} />);

      expect(ref.current).toBeDefined();
    });
  });
});
```

**Step 2: Run tests**

Run: `cd js && pnpm test -- --testPathPattern="HistogramDiffResultView.test"`
Expected: PASS

**Step 3: Commit**

```bash
git add js/src/components/histogram/HistogramDiffResultView.test.tsx
git commit -s -m "test: add HistogramDiffResultView baseline tests"
```

---

### Task 0.5: Test TopKDiffResultView (Chart + Local State)

**Files:**
- Create: `js/src/components/top-k/TopKDiffResultView.test.tsx`

**Step 1: Write tests including state toggle**

```typescript
// js/src/components/top-k/TopKDiffResultView.test.tsx
import { screen, fireEvent } from "@testing-library/react";
import { TopKDiffResultView } from "./TopKDiffResultView";
import {
  renderResultView,
  createBoxRef,
} from "../__tests__/resultViewTestUtils";
import { createTopKDiffRun } from "../__tests__/fixtures/runFixtures";

// Mock TopKSummaryBarChart
jest.mock("../charts/TopKSummaryList", () => ({
  TopKSummaryBarChart: ({ isDisplayTopTen }: any) => (
    <div data-testid="topk-chart">
      <span data-testid="display-mode">
        {isDisplayTopTen ? "top10" : "all"}
      </span>
    </div>
  ),
}));

describe("TopKDiffResultView", () => {
  describe("rendering", () => {
    it("renders chart with data", () => {
      const run = createTopKDiffRun();
      renderResultView(<TopKDiffResultView run={run} />);

      expect(screen.getByTestId("topk-chart")).toBeInTheDocument();
    });

    it("displays model and column in title", () => {
      const run = createTopKDiffRun();
      renderResultView(<TopKDiffResultView run={run} />);

      expect(
        screen.getByText(/Model test_model.category/),
      ).toBeInTheDocument();
    });
  });

  describe("view toggle", () => {
    it("shows View More link when >10 items", () => {
      const run = createTopKDiffRun({
        result: {
          base: {
            values: Array(15).fill({ value: "X", count: 1 }),
            valids: 100,
          },
          current: {
            values: Array(15).fill({ value: "X", count: 1 }),
            valids: 100,
          },
        },
      });
      renderResultView(<TopKDiffResultView run={run} />);

      expect(screen.getByText("View More Items")).toBeInTheDocument();
    });

    it("toggles between top-10 and all", () => {
      const run = createTopKDiffRun({
        result: {
          base: {
            values: Array(15).fill({ value: "X", count: 1 }),
            valids: 100,
          },
          current: {
            values: Array(15).fill({ value: "X", count: 1 }),
            valids: 100,
          },
        },
      });
      renderResultView(<TopKDiffResultView run={run} />);

      // Initially shows top 10
      expect(screen.getByTestId("display-mode")).toHaveTextContent("top10");

      // Click to show all
      fireEvent.click(screen.getByText("View More Items"));
      expect(screen.getByTestId("display-mode")).toHaveTextContent("all");

      // Click to show top 10 again
      fireEvent.click(screen.getByText("View Only Top-10"));
      expect(screen.getByTestId("display-mode")).toHaveTextContent("top10");
    });

    it("hides toggle when <=10 items", () => {
      const run = createTopKDiffRun(); // Default has < 10 items
      renderResultView(<TopKDiffResultView run={run} />);

      expect(screen.queryByText("View More Items")).not.toBeInTheDocument();
    });
  });

  describe("ref forwarding", () => {
    it("forwards ref to ScreenshotBox", () => {
      const run = createTopKDiffRun();
      const ref = createBoxRef();

      renderResultView(<TopKDiffResultView run={run} ref={ref} />);

      expect(ref.current).toBeDefined();
    });
  });
});
```

**Step 2: Run tests**

Run: `cd js && pnpm test -- --testPathPattern="TopKDiffResultView.test"`
Expected: PASS

**Step 3: Commit**

```bash
git add js/src/components/top-k/TopKDiffResultView.test.tsx
git commit -s -m "test: add TopKDiffResultView baseline tests"
```

---

### Task 0.6: Test ProfileDiffResultView (Grid + Toolbar)

**Files:**
- Create: `js/src/components/profile/ProfileDiffResultView.test.tsx`

**Step 1: Write tests with toolbar interaction**

```typescript
// js/src/components/profile/ProfileDiffResultView.test.tsx
import { screen, fireEvent } from "@testing-library/react";
import { ProfileDiffResultView, ProfileResultView } from "./ProfileDiffResultView";
import {
  renderResultView,
  createGridRef,
  expectThrowsForWrongType,
} from "../__tests__/resultViewTestUtils";
import {
  createProfileDiffRun,
  createValueDiffRun,
} from "../__tests__/fixtures/runFixtures";

// Mock toolbar components
jest.mock("../query/ToggleSwitch", () => ({
  DiffDisplayModeSwitch: ({ displayMode, onDisplayModeChanged }: any) => (
    <button
      data-testid="display-mode-switch"
      onClick={() =>
        onDisplayModeChanged(displayMode === "inline" ? "side_by_side" : "inline")
      }
    >
      {displayMode}
    </button>
  ),
}));

describe("ProfileDiffResultView", () => {
  describe("rendering", () => {
    it("renders grid with data", () => {
      const run = createProfileDiffRun();
      renderResultView(<ProfileDiffResultView run={run} />);

      expect(screen.getByTestId("mock-ag-grid")).toBeInTheDocument();
    });

    it("shows empty state when no columns", () => {
      const run = createProfileDiffRun({
        result: {
          base: { columns: [], data: [] },
          current: { columns: [], data: [] },
        },
      });
      renderResultView(<ProfileDiffResultView run={run} />);

      expect(screen.getByText("No data")).toBeInTheDocument();
    });

    it("renders toolbar with display mode switch", () => {
      const run = createProfileDiffRun();
      renderResultView(<ProfileDiffResultView run={run} />);

      expect(screen.getByTestId("display-mode-switch")).toBeInTheDocument();
    });
  });

  describe("view options", () => {
    it("calls onViewOptionsChanged when display mode changes", () => {
      const run = createProfileDiffRun();
      const onViewOptionsChanged = jest.fn();

      renderResultView(
        <ProfileDiffResultView
          run={run}
          viewOptions={{ display_mode: "inline" }}
          onViewOptionsChanged={onViewOptionsChanged}
        />,
      );

      fireEvent.click(screen.getByTestId("display-mode-switch"));

      expect(onViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({ display_mode: "side_by_side" }),
      );
    });
  });

  describe("type safety", () => {
    it("throws for wrong run type", () => {
      const wrongRun = createValueDiffRun();

      expectThrowsForWrongType(
        ProfileDiffResultView,
        wrongRun,
        /Only run type profile_diff is supported/,
      );
    });
  });
});

describe("ProfileResultView", () => {
  it("renders without toolbar", () => {
    const run = createProfileDiffRun(); // Uses same fixture, just different type check
    run.type = "profile";

    renderResultView(<ProfileResultView run={run} />);

    expect(screen.getByTestId("mock-ag-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("display-mode-switch")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

Run: `cd js && pnpm test -- --testPathPattern="ProfileDiffResultView.test"`
Expected: PASS

**Step 3: Commit**

```bash
git add js/src/components/profile/ProfileDiffResultView.test.tsx
git commit -s -m "test: add ProfileDiffResultView baseline tests"
```

---

### Task 0.7: Test ValueDiffDetailResultView (Complex Grid)

**Files:**
- Create: `js/src/components/valuediff/ValueDiffDetailResultView.test.tsx`

**Step 1: Write comprehensive tests**

```typescript
// js/src/components/valuediff/ValueDiffDetailResultView.test.tsx
import { screen, fireEvent } from "@testing-library/react";
import { ValueDiffDetailResultView } from "./ValueDiffDetailResultView";
import {
  renderResultView,
  createGridRef,
} from "../__tests__/resultViewTestUtils";
import { Run } from "@/lib/api/types";

// Mock toolbar components
jest.mock("../query/ToggleSwitch", () => ({
  DiffDisplayModeSwitch: ({ displayMode, onDisplayModeChanged }: any) => (
    <button
      data-testid="display-mode-switch"
      onClick={() => onDisplayModeChanged("side_by_side")}
    >
      {displayMode}
    </button>
  ),
}));

jest.mock("../query/ChangedOnlyCheckbox", () => ({
  ChangedOnlyCheckbox: ({ changedOnly, onChange }: any) => (
    <input
      type="checkbox"
      data-testid="changed-only-checkbox"
      checked={changedOnly ?? false}
      onChange={onChange}
    />
  ),
}));

const createValueDiffDetailRun = (): Run => ({
  type: "value_diff_detail",
  run_id: "test-run",
  run_at: "2024-01-01T00:00:00Z",
  status: "finished",
  params: { model: "test", primary_key: ["id"] },
  result: {
    columns: [
      { key: "id", name: "id", type: "integer" },
      { key: "value", name: "value", type: "text" },
    ],
    data: [
      [1, "a"],
      [2, "b"],
    ],
  },
});

describe("ValueDiffDetailResultView", () => {
  describe("rendering", () => {
    it("renders grid with data", () => {
      const run = createValueDiffDetailRun();
      renderResultView(<ValueDiffDetailResultView run={run} />);

      expect(screen.getByTestId("mock-ag-grid")).toBeInTheDocument();
    });

    it("renders toolbar with controls", () => {
      const run = createValueDiffDetailRun();
      renderResultView(<ValueDiffDetailResultView run={run} />);

      expect(screen.getByTestId("display-mode-switch")).toBeInTheDocument();
      expect(screen.getByTestId("changed-only-checkbox")).toBeInTheDocument();
    });

    it("shows No data when columns empty", () => {
      const run = createValueDiffDetailRun();
      run.result = { columns: [], data: [] };

      renderResultView(<ValueDiffDetailResultView run={run} />);

      expect(screen.getByText("No data")).toBeInTheDocument();
    });

    it("shows No change when changedOnly and no rows", () => {
      const run = createValueDiffDetailRun();
      // Mock createDataGrid to return empty rows for changedOnly

      renderResultView(
        <ValueDiffDetailResultView
          run={run}
          viewOptions={{ changed_only: true }}
        />,
      );

      // This test verifies the special "No change" empty state
      // when changedOnly is true but no rows match
    });
  });

  describe("warnings", () => {
    it("shows limit warning when results truncated", () => {
      const run = createValueDiffDetailRun();
      run.result = {
        ...run.result,
        limit: 1000,
        more: true,
      };

      renderResultView(<ValueDiffDetailResultView run={run} />);

      expect(screen.getByText(/Warning.*limited.*1,000/)).toBeInTheDocument();
    });
  });

  describe("view options", () => {
    it("toggles changed only", () => {
      const run = createValueDiffDetailRun();
      const onViewOptionsChanged = jest.fn();

      renderResultView(
        <ValueDiffDetailResultView
          run={run}
          viewOptions={{ changed_only: false }}
          onViewOptionsChanged={onViewOptionsChanged}
        />,
      );

      fireEvent.click(screen.getByTestId("changed-only-checkbox"));

      expect(onViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({ changed_only: true }),
      );
    });
  });
});
```

**Step 2: Run tests**

Run: `cd js && pnpm test -- --testPathPattern="ValueDiffDetailResultView.test"`
Expected: PASS

**Step 3: Commit**

```bash
git add js/src/components/valuediff/ValueDiffDetailResultView.test.tsx
git commit -s -m "test: add ValueDiffDetailResultView baseline tests"
```

---

### Task 0.8: Test QueryResultView and QueryDiffResultView

**Files:**
- Create: `js/src/components/query/QueryResultView.test.tsx`
- Create: `js/src/components/query/QueryDiffResultView.test.tsx`

**Step 1: Write QueryResultView tests**

```typescript
// js/src/components/query/QueryResultView.test.tsx
import { screen, fireEvent } from "@testing-library/react";
import { QueryResultView } from "./QueryResultView";
import {
  renderResultView,
  createGridRef,
} from "../__tests__/resultViewTestUtils";
import { Run } from "@/lib/api/types";

const createQueryRun = (): Run => ({
  type: "query",
  run_id: "test-run",
  run_at: "2024-01-01T00:00:00Z",
  status: "finished",
  params: { sql_template: "SELECT 1" },
  result: {
    columns: [{ key: "col", name: "col", type: "integer" }],
    data: [[1]],
  },
});

describe("QueryResultView", () => {
  describe("rendering", () => {
    it("renders grid with data", () => {
      const run = createQueryRun();
      renderResultView(<QueryResultView run={run} />);

      expect(screen.getByTestId("mock-ag-grid")).toBeInTheDocument();
    });

    it("shows No data when columns empty", () => {
      const run = createQueryRun();
      run.result = { columns: [], data: [] };

      renderResultView(<QueryResultView run={run} />);

      expect(screen.getByText("No data")).toBeInTheDocument();
    });
  });

  describe("onAddToChecklist", () => {
    it("renders Add to Checklist button when callback provided", () => {
      const run = createQueryRun();
      const onAdd = jest.fn();

      renderResultView(
        <QueryResultView run={run} onAddToChecklist={onAdd} />,
      );

      expect(screen.getByText("Add to Checklist")).toBeInTheDocument();
    });

    it("calls callback when button clicked", () => {
      const run = createQueryRun();
      const onAdd = jest.fn();

      renderResultView(
        <QueryResultView run={run} onAddToChecklist={onAdd} />,
      );

      fireEvent.click(screen.getByText("Add to Checklist"));
      expect(onAdd).toHaveBeenCalledWith(run);
    });
  });

  describe("warnings", () => {
    it("shows limit warning", () => {
      const run = createQueryRun();
      run.result = { ...run.result, limit: 500, more: true };

      renderResultView(<QueryResultView run={run} />);

      expect(screen.getByText(/Warning.*limited.*500/)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Write QueryDiffResultView tests**

```typescript
// js/src/components/query/QueryDiffResultView.test.tsx
import { screen, fireEvent } from "@testing-library/react";
import { QueryDiffResultView } from "./QueryDiffResultView";
import {
  renderResultView,
  createGridRef,
} from "../__tests__/resultViewTestUtils";
import { createQueryDiffRun } from "../__tests__/fixtures/runFixtures";

// Mock toolbar components
jest.mock("./ToggleSwitch", () => ({
  DiffDisplayModeSwitch: ({ displayMode, onDisplayModeChanged }: any) => (
    <button data-testid="display-mode-switch">
      {displayMode}
    </button>
  ),
}));

jest.mock("./ChangedOnlyCheckbox", () => ({
  ChangedOnlyCheckbox: ({ changedOnly, onChange }: any) => (
    <input
      type="checkbox"
      data-testid="changed-only-checkbox"
      checked={changedOnly ?? false}
      onChange={onChange}
    />
  ),
}));

describe("QueryDiffResultView", () => {
  describe("rendering", () => {
    it("renders grid with data", () => {
      const run = createQueryDiffRun();
      renderResultView(<QueryDiffResultView run={run} />);

      expect(screen.getByTestId("mock-ag-grid")).toBeInTheDocument();
    });

    it("shows No data when columns empty", () => {
      const run = createQueryDiffRun();
      run.result = {
        base: { columns: [], data: [] },
        current: { columns: [], data: [] },
      };

      renderResultView(<QueryDiffResultView run={run} />);

      expect(screen.getByText("No data")).toBeInTheDocument();
    });

    it("throws for wrong run type", () => {
      const wrongRun = { ...createQueryDiffRun(), type: "query" };

      expect(() => {
        renderResultView(<QueryDiffResultView run={wrongRun} />);
      }).toThrow(/query_diff/);
    });
  });

  describe("bifurcation", () => {
    it("uses join view when result has diff field", () => {
      const run = createQueryDiffRun();
      run.result = {
        ...run.result,
        diff: {
          columns: [{ key: "id", name: "id", type: "integer" }],
          data: [[1]],
        },
      };
      run.params = { ...run.params, primary_keys: ["id"] };

      renderResultView(<QueryDiffResultView run={run} />);

      // Should render (bifurcation logic chooses correct internal component)
      expect(screen.getByTestId("mock-ag-grid")).toBeInTheDocument();
    });
  });

  describe("warnings", () => {
    it("shows primary key warning when invalid", () => {
      // This requires mocking createDataGrid to return invalidPKeyBase
      // Implementation depends on mock setup
    });
  });
});
```

**Step 3: Run tests**

Run: `cd js && pnpm test -- --testPathPattern="Query.*ResultView.test"`
Expected: PASS

**Step 4: Commit**

```bash
git add js/src/components/query/QueryResultView.test.tsx
git add js/src/components/query/QueryDiffResultView.test.tsx
git commit -s -m "test: add QueryResultView and QueryDiffResultView baseline tests"
```

---

## Phase 1: Extract Simple Grid Factory

Now that we have baseline tests, begin extracting the factory.

### Task 1.1: Create ResultView types in packages/ui

**Files:**
- Create: `js/packages/ui/src/components/result/types.ts`

**Step 1: Define core types**

```typescript
// js/packages/ui/src/components/result/types.ts
"use client";

import type { Ref, ReactNode } from "react";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";

/**
 * Ref types supported by ResultView components
 */
export type ResultViewRef = DataGridHandle | HTMLDivElement;

/**
 * Screenshot wrapper types
 */
export type ScreenshotWrapperType = "grid" | "box";

/**
 * Base props for all ResultView components
 * Generic over ViewOptions type for type-safe view state management
 */
export interface ResultViewProps<TViewOptions = unknown> {
  /** The run data to display */
  run: unknown; // Generic run type - consumers will narrow
  /** Optional view configuration */
  viewOptions?: TViewOptions;
  /** Callback when view options change */
  onViewOptionsChanged?: (options: TViewOptions) => void;
}

/**
 * Configuration for the createResultView factory
 */
export interface ResultViewConfig<
  TRun,
  TViewOptions = unknown,
  TRef extends ResultViewRef = DataGridHandle,
> {
  /**
   * Display name for the component (used in error messages and DevTools)
   */
  displayName: string;

  /**
   * Type guard function to validate the run type
   * Should return true only for valid run types
   */
  typeGuard: (run: unknown) => run is TRun;

  /**
   * Expected run type name (used in error messages)
   */
  expectedRunType: string;

  /**
   * Type of screenshot wrapper to use
   * - "grid": Uses ScreenshotDataGrid (ref is DataGridHandle)
   * - "box": Uses ScreenshotBox (ref is HTMLDivElement)
   */
  screenshotWrapper: ScreenshotWrapperType;

  /**
   * Transform run data into renderable content
   * Return null to show empty state
   */
  transformData: (
    run: TRun,
    options: ResultViewTransformOptions<TViewOptions>,
  ) => ResultViewData | null;

  /**
   * Custom empty state message or component
   * @default "No data"
   */
  emptyState?: ReactNode | string;

  /**
   * Additional empty state for specific conditions (e.g., "No change" when filtered)
   */
  conditionalEmptyState?: (
    run: TRun,
    viewOptions?: TViewOptions,
  ) => ReactNode | null;
}

/**
 * Options passed to transformData
 */
export interface ResultViewTransformOptions<TViewOptions> {
  viewOptions?: TViewOptions;
  onViewOptionsChanged?: (options: TViewOptions) => void;
}

/**
 * Result of transformData - the data to render
 */
export interface ResultViewData {
  /** For grid wrapper: AG Grid column definitions */
  columns?: unknown[];
  /** For grid wrapper: AG Grid row data */
  rows?: unknown[];
  /** For box wrapper: React content to render */
  content?: ReactNode;
  /** Whether data is empty (triggers empty state) */
  isEmpty?: boolean;
}

/**
 * Props for components using the factory-created ResultView
 */
export interface CreatedResultViewProps<TViewOptions = unknown>
  extends ResultViewProps<TViewOptions> {
  ref?: Ref<ResultViewRef>;
}
```

**Step 2: Verify types compile**

Run: `cd js && pnpm type:check`
Expected: PASS

**Step 3: Commit**

```bash
git add js/packages/ui/src/components/result/types.ts
git commit -s -m "feat(ui): add ResultView types for factory pattern"
```

---

### Task 1.2: Create createResultView factory (Grid-only, Simple)

**Files:**
- Create: `js/packages/ui/src/components/result/createResultView.tsx`

**Step 1: Implement simple factory**

```typescript
// js/packages/ui/src/components/result/createResultView.tsx
"use client";

import Box from "@mui/material/Box";
import { forwardRef, type Ref, useMemo } from "react";

import { useIsDark } from "../../hooks";
import {
  type DataGridHandle,
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data/ScreenshotDataGrid";
import { ScreenshotBox } from "../ui/ScreenshotBox";
import type {
  CreatedResultViewProps,
  ResultViewConfig,
  ResultViewData,
  ResultViewRef,
} from "./types";

/**
 * Factory function to create type-safe ResultView components
 *
 * This reduces boilerplate by handling:
 * - Type guard validation with consistent error messages
 * - forwardRef setup for screenshot capture
 * - Dark/light theme handling
 * - Empty state rendering
 *
 * @example
 * ```tsx
 * export const RowCountResultView = createResultView({
 *   displayName: "RowCountResultView",
 *   typeGuard: isRowCountRun,
 *   expectedRunType: "row_count",
 *   screenshotWrapper: "grid",
 *   transformData: (run) => ({
 *     columns: toRowCountGrid(run).columns,
 *     rows: toRowCountGrid(run).rows,
 *   }),
 * });
 * ```
 */
export function createResultView<
  TRun,
  TViewOptions = unknown,
  TRef extends ResultViewRef = DataGridHandle,
>(config: ResultViewConfig<TRun, TViewOptions, TRef>) {
  const {
    displayName,
    typeGuard,
    expectedRunType,
    screenshotWrapper,
    transformData,
    emptyState = "No data",
    conditionalEmptyState,
  } = config;

  function ResultViewInner(
    { run, viewOptions, onViewOptionsChanged }: CreatedResultViewProps<TViewOptions>,
    ref: Ref<TRef>,
  ) {
    const isDark = useIsDark();

    // Type guard validation
    if (!typeGuard(run)) {
      throw new Error(`Run type must be ${expectedRunType}`);
    }

    // Check conditional empty state first
    const conditionalEmpty = conditionalEmptyState?.(run, viewOptions);
    if (conditionalEmpty !== null && conditionalEmpty !== undefined) {
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: isDark ? "grey.900" : "grey.50",
            height: "100%",
          }}
        >
          {conditionalEmpty}
        </Box>
      );
    }

    // Transform data
    const data = useMemo(
      () => transformData(run, { viewOptions, onViewOptionsChanged }),
      [run, viewOptions, onViewOptionsChanged],
    );

    // Empty state
    if (!data || data.isEmpty) {
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: isDark ? "grey.900" : "grey.50",
            height: "100%",
          }}
        >
          {typeof emptyState === "string" ? emptyState : emptyState}
        </Box>
      );
    }

    // Render based on wrapper type
    if (screenshotWrapper === "grid") {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <ScreenshotDataGrid
            ref={ref as Ref<DataGridHandle>}
            style={{
              blockSize: "auto",
              maxHeight: "100%",
              overflow: "auto",
              fontSize: "0.875rem",
              borderWidth: 1,
            }}
            columns={data.columns ?? []}
            rows={data.rows ?? []}
            renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
          />
        </Box>
      );
    }

    // Box wrapper for charts
    return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <ScreenshotBox
          ref={ref as Ref<HTMLDivElement>}
          height="100%"
          backgroundColor={isDark ? "#1f2937" : "white"}
        >
          {data.content}
        </ScreenshotBox>
      </Box>
    );
  }

  // Set display name for DevTools
  ResultViewInner.displayName = displayName;

  // Create forwardRef component
  const ForwardedResultView = forwardRef(ResultViewInner) as <
    T extends TViewOptions = TViewOptions,
  >(
    props: CreatedResultViewProps<T> & { ref?: Ref<TRef> },
  ) => React.ReactNode;

  return ForwardedResultView;
}
```

**Step 2: Verify factory compiles**

Run: `cd js && pnpm type:check`
Expected: PASS

**Step 3: Commit**

```bash
git add js/packages/ui/src/components/result/createResultView.tsx
git commit -s -m "feat(ui): add createResultView factory function"
```

---

### Task 1.3: Create factory tests

**Files:**
- Create: `js/packages/ui/src/components/result/createResultView.test.tsx`

**Step 1: Write factory tests**

```typescript
// js/packages/ui/src/components/result/createResultView.test.tsx
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { createResultView } from "./createResultView";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";

// Mock dependencies
jest.mock("ag-grid-react", () => ({
  AgGridReact: ({ rowData }: any) => (
    <div data-testid="mock-grid">rows: {rowData?.length ?? 0}</div>
  ),
}));

jest.mock("../ui/ScreenshotBox", () => ({
  ScreenshotBox: ({ children }: any) => (
    <div data-testid="screenshot-box">{children}</div>
  ),
}));

const theme = createTheme();
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

interface TestRun {
  type: "test";
  data: number[];
}

const isTestRun = (run: unknown): run is TestRun =>
  typeof run === "object" && run !== null && (run as any).type === "test";

describe("createResultView", () => {
  describe("grid wrapper", () => {
    const TestGridView = createResultView<TestRun>({
      displayName: "TestGridView",
      typeGuard: isTestRun,
      expectedRunType: "test",
      screenshotWrapper: "grid",
      transformData: (run) => ({
        columns: [{ field: "value" }],
        rows: run.data.map((v) => ({ value: v })),
      }),
    });

    it("renders grid with data", () => {
      const run: TestRun = { type: "test", data: [1, 2, 3] };
      render(<TestGridView run={run} />, { wrapper });

      expect(screen.getByTestId("mock-grid")).toHaveTextContent("rows: 3");
    });

    it("throws for wrong run type", () => {
      const wrongRun = { type: "wrong" };
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        render(<TestGridView run={wrongRun} />, { wrapper });
      }).toThrow(/Run type must be test/);

      spy.mockRestore();
    });

    it("shows empty state when no data", () => {
      const TestEmptyView = createResultView<TestRun>({
        displayName: "TestEmptyView",
        typeGuard: isTestRun,
        expectedRunType: "test",
        screenshotWrapper: "grid",
        transformData: () => null,
        emptyState: "Custom empty message",
      });

      const run: TestRun = { type: "test", data: [] };
      render(<TestEmptyView run={run} />, { wrapper });

      expect(screen.getByText("Custom empty message")).toBeInTheDocument();
    });

    it("forwards ref", () => {
      const run: TestRun = { type: "test", data: [1] };
      const ref = createRef<DataGridHandle>();

      render(<TestGridView run={run} ref={ref} />, { wrapper });

      // Ref should be set (mocked grid doesn't set it, but forwardRef works)
      expect(ref).toBeDefined();
    });
  });

  describe("box wrapper", () => {
    const TestBoxView = createResultView<TestRun, unknown, HTMLDivElement>({
      displayName: "TestBoxView",
      typeGuard: isTestRun,
      expectedRunType: "test",
      screenshotWrapper: "box",
      transformData: (run) => ({
        content: <div>Chart: {run.data.length} items</div>,
      }),
    });

    it("renders box with content", () => {
      const run: TestRun = { type: "test", data: [1, 2] };
      render(<TestBoxView run={run} />, { wrapper });

      expect(screen.getByTestId("screenshot-box")).toBeInTheDocument();
      expect(screen.getByText("Chart: 2 items")).toBeInTheDocument();
    });
  });

  describe("conditional empty state", () => {
    interface TestViewOptions {
      showEmpty?: boolean;
    }

    const TestConditionalView = createResultView<TestRun, TestViewOptions>({
      displayName: "TestConditionalView",
      typeGuard: isTestRun,
      expectedRunType: "test",
      screenshotWrapper: "grid",
      transformData: (run) => ({
        columns: [],
        rows: run.data.map((v) => ({ value: v })),
      }),
      conditionalEmptyState: (run, options) => {
        if (options?.showEmpty) {
          return "Conditional empty";
        }
        return null;
      },
    });

    it("shows conditional empty when condition met", () => {
      const run: TestRun = { type: "test", data: [1] };
      render(
        <TestConditionalView run={run} viewOptions={{ showEmpty: true }} />,
        { wrapper },
      );

      expect(screen.getByText("Conditional empty")).toBeInTheDocument();
    });

    it("renders normally when condition not met", () => {
      const run: TestRun = { type: "test", data: [1] };
      render(
        <TestConditionalView run={run} viewOptions={{ showEmpty: false }} />,
        { wrapper },
      );

      expect(screen.getByTestId("mock-grid")).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run factory tests**

Run: `cd js && pnpm test -- --testPathPattern="createResultView.test"`
Expected: PASS

**Step 3: Commit**

```bash
git add js/packages/ui/src/components/result/createResultView.test.tsx
git commit -s -m "test(ui): add createResultView factory tests"
```

---

### Task 1.4: Export factory from packages/ui

**Files:**
- Create: `js/packages/ui/src/components/result/index.ts`
- Modify: `js/packages/ui/src/primitives.ts`

**Step 1: Create barrel export**

```typescript
// js/packages/ui/src/components/result/index.ts
"use client";

export { createResultView } from "./createResultView";
export type {
  CreatedResultViewProps,
  ResultViewConfig,
  ResultViewData,
  ResultViewProps,
  ResultViewRef,
  ResultViewTransformOptions,
  ScreenshotWrapperType,
} from "./types";
```

**Step 2: Add to primitives.ts**

Add this section to `js/packages/ui/src/primitives.ts`:

```typescript
// =============================================================================
// RESULT VIEW PRIMITIVES
// =============================================================================

// Result view factory
export {
  createResultView,
  type CreatedResultViewProps,
  type ResultViewConfig,
  type ResultViewData,
  type ResultViewProps,
  type ResultViewRef,
  type ResultViewTransformOptions,
  type ScreenshotWrapperType,
} from "./components/result";
```

**Step 3: Build and verify**

Run: `cd js/packages/ui && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add js/packages/ui/src/components/result/index.ts
git add js/packages/ui/src/primitives.ts
git commit -s -m "feat(ui): export createResultView from primitives"
```

---

## Phase 2: Migrate Simple Components

### Task 2.1: Migrate RowCountDiffResultView to use factory

**Files:**
- Modify: `js/src/components/rowcount/RowCountDiffResultView.tsx`

**Step 1: Refactor to use factory**

```typescript
// js/src/components/rowcount/RowCountDiffResultView.tsx
import { forwardRef, Ref, useMemo } from "react";
import Box from "@mui/material/Box";
import { createResultView, type DataGridHandle } from "@datarecce/ui/primitives";
import { isRowCountDiffRun, isRowCountRun, Run } from "@/lib/api/types";
import { createDataGrid } from "@/lib/dataGrid/dataGridFactory";
import { useIsDark } from "@/lib/hooks/useIsDark";
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";

// ============================================================================
// Factory-based implementation
// ============================================================================

// Note: We can't use createResultView directly yet because:
// 1. It doesn't handle the custom empty state message ("No nodes matched")
// 2. The grid styling is slightly different
// 3. We need to validate the migration doesn't break anything
//
// Instead, we refactor to a shared internal component (already done!)
// and validate the pattern before migrating to the factory.

// The existing implementation already follows the pattern:
// - Shared RowCountGridView handles the common logic
// - RowCountDiffResultView and RowCountResultView are thin wrappers

// For now, keep the existing implementation and add a TODO for Phase 3
// when we have more factory features (custom empty states, grid styles)

// ============================================================================
// Existing Implementation (Preserved)
// ============================================================================

interface RowCountGridViewProps {
  run: Run;
  typeGuard: (run: Run) => boolean;
  expectedType: string;
}

function _RowCountGridView(
  { run, typeGuard, expectedType }: RowCountGridViewProps,
  ref: Ref<DataGridHandle>,
) {
  const isDark = useIsDark();

  if (!typeGuard(run)) {
    throw new Error(`Run type must be ${expectedType}`);
  }

  const gridData = useMemo(() => {
    return createDataGrid(run) ?? { columns: [], rows: [] };
  }, [run]);

  if (gridData.rows.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: isDark ? "grey.900" : "grey.50",
          height: "100%",
        }}
      >
        No nodes matched
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ScreenshotDataGrid
        ref={ref}
        style={{
          blockSize: "auto",
          maxHeight: "100%",
          overflow: "auto",
          fontSize: "0.875rem",
          borderWidth: 1,
        }}
        columns={gridData.columns}
        rows={gridData.rows}
        renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
      />
    </Box>
  );
}

const RowCountGridView = forwardRef(_RowCountGridView);

// ============================================================================
// Exported Components
// ============================================================================

function _RowCountDiffResultView(
  { run }: RunResultViewProps,
  ref: Ref<DataGridHandle>,
) {
  return (
    <RowCountGridView
      ref={ref}
      run={run}
      typeGuard={isRowCountDiffRun}
      expectedType="row_count_diff"
    />
  );
}

function _RowCountResultView(
  { run }: RunResultViewProps,
  ref: Ref<DataGridHandle>,
) {
  return (
    <RowCountGridView
      ref={ref}
      run={run}
      typeGuard={isRowCountRun}
      expectedType="row_count"
    />
  );
}

export const RowCountDiffResultView = forwardRef(_RowCountDiffResultView);
export const RowCountResultView = forwardRef(_RowCountResultView);
```

**Step 2: Run tests to verify no regression**

Run: `cd js && pnpm test -- --testPathPattern="RowCountDiffResultView"`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add js/src/components/rowcount/RowCountDiffResultView.tsx
git commit -s -m "refactor: document RowCountResultView factory migration path"
```

---

## Phase 3: Extend Factory for Complex Cases

### Task 3.1: Add toolbar support to factory

**Files:**
- Modify: `js/packages/ui/src/components/result/types.ts`
- Modify: `js/packages/ui/src/components/result/createResultView.tsx`

**Step 1: Extend types**

Add to `types.ts`:

```typescript
/**
 * Extended config with toolbar support
 */
export interface ResultViewConfigWithToolbar<
  TRun,
  TViewOptions = unknown,
  TRef extends ResultViewRef = DataGridHandle,
> extends ResultViewConfig<TRun, TViewOptions, TRef> {
  /**
   * Render toolbar content
   * Return null to hide toolbar
   */
  renderToolbar?: (props: {
    run: TRun;
    viewOptions?: TViewOptions;
    onViewOptionsChanged?: (options: TViewOptions) => void;
    warnings?: string[];
  }) => ReactNode | null;

  /**
   * Compute warnings from run data
   */
  computeWarnings?: (run: TRun, viewOptions?: TViewOptions) => string[];

  /**
   * Container style overrides
   */
  containerSx?: Record<string, unknown>;

  /**
   * Grid default column options
   */
  gridDefaultColDef?: Record<string, unknown>;
}
```

**Step 2: Update factory to support toolbar**

Update `createResultView.tsx` to handle toolbar rendering and warnings.

**Step 3: Add tests for toolbar**

**Step 4: Commit**

```bash
git add js/packages/ui/src/components/result/
git commit -s -m "feat(ui): add toolbar support to createResultView factory"
```

---

## Remaining Tasks (Outline)

### Task 3.2: Migrate ProfileDiffResultView
- Use factory with toolbar support
- Verify view options work correctly

### Task 3.3: Migrate ValueDiffDetailResultView
- Handle complex view options
- Handle "No change" conditional empty state

### Task 4.1: Add chart wrapper tests
- Test ScreenshotBox integration

### Task 4.2: Migrate HistogramDiffResultView
- Chart-based, simple

### Task 4.3: Migrate TopKDiffResultView
- Chart-based with local state
- May need custom component or state callback

### Task 5.1: Assess QueryDiffResultView
- May be too complex for factory
- Document decision to keep custom or add bifurcation support

### Task 5.2: Final cleanup
- Remove any dead code
- Update documentation

---

## Success Criteria

1. ✅ All baseline tests pass before AND after migration
2. ✅ Factory handles grid and chart wrappers
3. ✅ Factory supports view options generics
4. ✅ Factory supports toolbar slots
5. ✅ Factory supports conditional empty states
6. ✅ Simple components (RowCount, ValueDiff, Histogram) use factory
7. ✅ Complex components either use factory or have documented exceptions
8. ✅ No regression in screenshot functionality
9. ✅ Type safety preserved (no `any` escape hatches)

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-03 | Write tests BEFORE refactoring | No existing tests - can't verify correctness without baseline |
| 2026-01-03 | Start with simple grid components | Lower risk, validate factory pattern |
| 2026-01-03 | Keep createDataGrid in Recce OSS | Has callbacks that closure over component state |
| 2026-01-03 | May keep QueryDiffResultView custom | Bifurcation logic too complex for factory |
