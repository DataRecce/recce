# Factory Toolbar Extension Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** ✅ Complete (2026-01-04)

**Goal:** Extend `createResultView` factory to support toolbar controls and warnings, then migrate `ValueDiffDetailResultView` and `QueryResultView` to use the factory.

**Architecture:** Add `toolbar`, `warnings`, and `onAddToChecklist` to factory types. Factory renders toolbar area with warnings (as alert chips) and controls. Consumers provide toolbar controls as ReactNode, factory handles consistent layout.

**Tech Stack:** React 19, TypeScript 5.9, Jest 30, React Testing Library, MUI

---

## Implementation Summary

All planned features were implemented and all components migrated:

### Factory Enhancements (packages/ui/src/components/result/)
- ✅ `toolbar?: ReactNode` - Toolbar controls slot
- ✅ `warnings?: string[]` - Warning messages array
- ✅ `warningStyle?: "alert" | "amber"` - Warning display styles
- ✅ `onAddToChecklist?: (run: unknown) => void` - Checklist callback
- ✅ `emptyMessage?: ReactNode` - Custom empty state with toolbar support
- ✅ `ToolbarArea` component with warnings left, controls right layout

### Component Migration Status

| Component | Status | Tests | Notes |
|-----------|--------|-------|-------|
| RowCountDiffResultView | ✅ Factory | ✅ | Simplest grid-based |
| RowCountResultView | ✅ Factory | ✅ | Shares with above |
| ValueDiffResultView | ✅ Factory | ✅ | Grid + header |
| HistogramDiffResultView | ✅ Factory | ✅ | Chart-based |
| ProfileDiffResultView | ✅ Factory | ✅ | Grid + toolbar via header |
| ProfileResultView | ✅ Factory | ✅ | Shares with above |
| TopKDiffResultView | ✅ Factory | ✅ | Migrated (was deferred) |
| ValueDiffDetailResultView | ✅ Factory | ✅ | Migrated with toolbar/warnings |
| QueryResultView | ✅ Factory | ✅ | Migrated with onAddToChecklist |
| QueryDiffResultView | ✅ Factory | ✅ | Migrated (was deferred) |

**All 10 ResultView components now use the factory pattern.**

---

## Type Changes

### ResultViewData (add toolbar + warnings)

```typescript
interface ResultViewData {
  // Existing
  columns?: unknown[];
  rows?: unknown[];
  content?: ReactNode;
  isEmpty?: boolean;
  renderNull?: boolean;
  header?: ReactNode;
  footer?: ReactNode;

  // NEW
  toolbar?: ReactNode;      // Controls (switches, checkboxes, buttons)
  warnings?: string[];      // Warning messages displayed as alerts
}
```

### CreatedResultViewProps (add onAddToChecklist)

```typescript
interface CreatedResultViewProps<TViewOptions = unknown> {
  // Existing
  run: unknown;
  viewOptions?: TViewOptions;
  onViewOptionsChanged?: (options: TViewOptions) => void;

  // NEW
  onAddToChecklist?: (run: unknown) => void;
}
```

### ResultViewTransformOptions (add onAddToChecklist)

```typescript
interface ResultViewTransformOptions<TViewOptions> {
  // Existing
  viewOptions?: TViewOptions;
  onViewOptionsChanged?: (options: TViewOptions) => void;

  // NEW
  onAddToChecklist?: (run: unknown) => void;
}
```

---

## Factory Rendering Logic

```tsx
// Toolbar area - renders if toolbar OR warnings exist
{(data.toolbar || data.warnings?.length) && (
  <Box sx={{
    display: "flex",
    alignItems: "center",
    gap: 1,
    px: 1,
    py: 0.5,
    borderBottom: 1,
    borderColor: "divider",
    bgcolor: isDark ? "grey.900" : "grey.50",
  }}>
    {/* Warnings on the left */}
    {data.warnings?.map((warning, i) => (
      <Alert
        key={i}
        severity="warning"
        sx={{ py: 0, flex: "0 1 auto" }}
      >
        {warning}
      </Alert>
    ))}

    {/* Spacer */}
    <Box sx={{ flex: 1 }} />

    {/* Toolbar controls on the right */}
    {data.toolbar}
  </Box>
)}
```

---

## Phase 1: Extend Factory

### Task 1.1: Update types

**Files:**
- Modify: `js/packages/ui/src/components/result/types.ts`

**Step 1: Add toolbar and warnings to ResultViewData**

Add after `footer?: ReactNode;`:

```typescript
/**
 * Toolbar controls to render above the content.
 * Renders on the right side of the toolbar area.
 */
toolbar?: ReactNode;

/**
 * Warning messages to display in the toolbar area.
 * Renders as alert chips on the left side.
 */
warnings?: string[];
```

**Step 2: Add onAddToChecklist to CreatedResultViewProps**

Add after `onViewOptionsChanged?`:

```typescript
/**
 * Callback when user wants to add run to checklist.
 * Used by QueryResultView.
 */
onAddToChecklist?: (run: unknown) => void;
```

**Step 3: Add onAddToChecklist to ResultViewTransformOptions**

Add after `onViewOptionsChanged?`:

```typescript
/**
 * Callback when user wants to add run to checklist.
 * Passed through from component props.
 */
onAddToChecklist?: (run: unknown) => void;
```

**Step 4: Verify types**

Run: `pnpm -C js type:check`
Expected: PASS

**Step 5: Commit**

```bash
git add js/packages/ui/src/components/result/types.ts
git commit -s -m "feat(ui): add toolbar, warnings, onAddToChecklist to ResultView types"
```

---

### Task 1.2: Update factory implementation

**Files:**
- Modify: `js/packages/ui/src/components/result/createResultView.tsx`

**Step 1: Add Alert import**

```typescript
import Alert from "@mui/material/Alert";
```

**Step 2: Update ResultViewInner to accept onAddToChecklist**

Change the destructuring:

```typescript
function ResultViewInner(
  {
    run,
    viewOptions,
    onViewOptionsChanged,
    onAddToChecklist,  // NEW
  }: CreatedResultViewProps<TViewOptions>,
  ref: Ref<TRef>,
)
```

**Step 3: Pass onAddToChecklist to transformData**

Update the useMemo call:

```typescript
const data = useMemo(
  () => transformData(run, { viewOptions, onViewOptionsChanged, onAddToChecklist }),
  [run, viewOptions, onViewOptionsChanged, onAddToChecklist],
);
```

**Step 4: Add toolbar rendering for grid wrapper**

Replace the grid wrapper return with:

```typescript
if (screenshotWrapper === "grid") {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {data.header}
      {/* Toolbar area */}
      {(data.toolbar || (data.warnings && data.warnings.length > 0)) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1,
            py: 0.5,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: isDark ? "grey.900" : "grey.50",
          }}
        >
          {data.warnings?.map((warning, i) => (
            <Alert
              key={i}
              severity="warning"
              sx={{ py: 0, fontSize: "0.75rem" }}
            >
              {warning}
            </Alert>
          ))}
          <Box sx={{ flex: 1 }} />
          {data.toolbar}
        </Box>
      )}
      <ScreenshotDataGrid
        ref={ref as Ref<DataGridHandle>}
        style={{
          blockSize: "auto",
          maxHeight: "100%",
          overflow: "auto",
          fontSize: "0.875rem",
          borderWidth: 1,
        }}
        columns={(data.columns ?? []) as never}
        rows={(data.rows ?? []) as never}
        renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
      />
      {data.footer}
    </Box>
  );
}
```

**Step 5: Add toolbar rendering for box wrapper**

Replace the box wrapper return with:

```typescript
return (
  <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
    {data.header}
    {/* Toolbar area */}
    {(data.toolbar || (data.warnings && data.warnings.length > 0)) && (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          py: 0.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: isDark ? "grey.900" : "grey.50",
        }}
      >
        {data.warnings?.map((warning, i) => (
          <Alert
            key={i}
            severity="warning"
            sx={{ py: 0, fontSize: "0.75rem" }}
          >
            {warning}
          </Alert>
        ))}
        <Box sx={{ flex: 1 }} />
        {data.toolbar}
      </Box>
    )}
    <ScreenshotBox
      ref={ref as Ref<HTMLDivElement>}
      height="100%"
      backgroundColor={isDark ? "#1f2937" : "white"}
    >
      {data.content}
    </ScreenshotBox>
    {data.footer}
  </Box>
);
```

**Step 6: Verify implementation**

Run: `pnpm -C js type:check`
Expected: PASS

**Step 7: Commit**

```bash
git add js/packages/ui/src/components/result/createResultView.tsx
git commit -s -m "feat(ui): add toolbar and warnings rendering to createResultView"
```

---

### Task 1.3: Add factory tests

**Files:**
- Modify: `js/packages/ui/src/components/result/createResultView.test.tsx`

**Step 1: Add toolbar tests**

Add new describe block:

```typescript
describe("toolbar support", () => {
  const TestToolbarView = createResultView<TestRun>({
    displayName: "TestToolbarView",
    typeGuard: isTestRun,
    expectedRunType: "test",
    screenshotWrapper: "grid",
    transformData: (run) => ({
      columns: [{ field: "value" }],
      rows: run.data.map((v) => ({ value: v })),
      toolbar: <button data-testid="toolbar-button">Click me</button>,
    }),
  });

  it("renders toolbar when provided", () => {
    const run: TestRun = { type: "test", data: [1] };
    render(<TestToolbarView run={run} />, { wrapper });

    expect(screen.getByTestId("toolbar-button")).toBeInTheDocument();
  });

  it("does not render toolbar area when no toolbar or warnings", () => {
    const TestNoToolbarView = createResultView<TestRun>({
      displayName: "TestNoToolbarView",
      typeGuard: isTestRun,
      expectedRunType: "test",
      screenshotWrapper: "grid",
      transformData: (run) => ({
        columns: [{ field: "value" }],
        rows: run.data.map((v) => ({ value: v })),
      }),
    });

    const run: TestRun = { type: "test", data: [1] };
    render(<TestNoToolbarView run={run} />, { wrapper });

    // Should not have the toolbar container
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
```

**Step 2: Add warnings tests**

Add new describe block:

```typescript
describe("warnings support", () => {
  const TestWarningsView = createResultView<TestRun>({
    displayName: "TestWarningsView",
    typeGuard: isTestRun,
    expectedRunType: "test",
    screenshotWrapper: "grid",
    transformData: (run) => ({
      columns: [{ field: "value" }],
      rows: run.data.map((v) => ({ value: v })),
      warnings: ["Warning 1", "Warning 2"],
    }),
  });

  it("renders warnings as alerts", () => {
    const run: TestRun = { type: "test", data: [1] };
    render(<TestWarningsView run={run} />, { wrapper });

    expect(screen.getByText("Warning 1")).toBeInTheDocument();
    expect(screen.getByText("Warning 2")).toBeInTheDocument();
  });

  it("renders toolbar and warnings together", () => {
    const TestBothView = createResultView<TestRun>({
      displayName: "TestBothView",
      typeGuard: isTestRun,
      expectedRunType: "test",
      screenshotWrapper: "grid",
      transformData: (run) => ({
        columns: [{ field: "value" }],
        rows: run.data.map((v) => ({ value: v })),
        warnings: ["Test warning"],
        toolbar: <button data-testid="toolbar-btn">Action</button>,
      }),
    });

    const run: TestRun = { type: "test", data: [1] };
    render(<TestBothView run={run} />, { wrapper });

    expect(screen.getByText("Test warning")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-btn")).toBeInTheDocument();
  });

  it("does not render warnings area when warnings array is empty", () => {
    const TestEmptyWarningsView = createResultView<TestRun>({
      displayName: "TestEmptyWarningsView",
      typeGuard: isTestRun,
      expectedRunType: "test",
      screenshotWrapper: "grid",
      transformData: (run) => ({
        columns: [{ field: "value" }],
        rows: run.data.map((v) => ({ value: v })),
        warnings: [],
      }),
    });

    const run: TestRun = { type: "test", data: [1] };
    render(<TestEmptyWarningsView run={run} />, { wrapper });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
```

**Step 3: Add onAddToChecklist test**

Add new describe block:

```typescript
describe("onAddToChecklist support", () => {
  it("passes onAddToChecklist to transformData", () => {
    const mockOnAddToChecklist = jest.fn();
    let receivedCallback: ((run: unknown) => void) | undefined;

    const TestChecklistView = createResultView<TestRun>({
      displayName: "TestChecklistView",
      typeGuard: isTestRun,
      expectedRunType: "test",
      screenshotWrapper: "grid",
      transformData: (run, { onAddToChecklist }) => {
        receivedCallback = onAddToChecklist;
        return {
          columns: [{ field: "value" }],
          rows: run.data.map((v) => ({ value: v })),
          toolbar: onAddToChecklist ? (
            <button
              data-testid="add-btn"
              onClick={() => onAddToChecklist(run)}
            >
              Add
            </button>
          ) : null,
        };
      },
    });

    const run: TestRun = { type: "test", data: [1] };
    render(
      <TestChecklistView run={run} onAddToChecklist={mockOnAddToChecklist} />,
      { wrapper },
    );

    expect(receivedCallback).toBe(mockOnAddToChecklist);

    // Click the button to verify callback works
    fireEvent.click(screen.getByTestId("add-btn"));
    expect(mockOnAddToChecklist).toHaveBeenCalledWith(run);
  });
});
```

**Step 4: Add fireEvent import if not present**

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
```

**Step 5: Run tests**

Run: `pnpm -C js/packages/ui test -- --testPathPattern="createResultView.test"`
Expected: All tests PASS

**Step 6: Run full verification**

Run: `pnpm -C js lint && pnpm -C js type:check && pnpm -C js test`
Expected: All PASS

**Step 7: Commit**

```bash
git add js/packages/ui/src/components/result/createResultView.test.tsx
git commit -s -m "test(ui): add toolbar, warnings, onAddToChecklist tests for factory"
```

---

## Phase 2: Migrate ValueDiffDetailResultView

### Task 2.1: Verify baseline tests pass

**Step 1: Run existing tests**

Run: `pnpm -C js test -- --testPathPattern="ValueDiffDetailResultView.test"`
Expected: All tests PASS

Record number of passing tests: ___

---

### Task 2.2: Refactor to use factory

**Files:**
- Modify: `js/src/components/valuediff/ValueDiffDetailResultView.tsx`

**Step 1: Add factory import**

```typescript
import { createResultView } from "@datarecce/ui/primitives";
```

**Step 2: Extract warning computation helper**

Add before the component:

```typescript
function computeValueDiffDetailWarnings(run: Run): string[] {
  if (!isValueDiffDetailRun(run)) return [];

  const limit = run.result?.limit ?? 0;
  if (limit > 0 && run.result?.more) {
    return [
      `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`,
    ];
  }
  return [];
}
```

**Step 3: Replace component with factory**

Replace the entire component with:

```typescript
export const ValueDiffDetailResultView = createResultView<
  Run,
  ValueDiffDetailViewOptions,
  DataGridHandle
>({
  displayName: "ValueDiffDetailResultView",
  typeGuard: isValueDiffDetailRun,
  expectedRunType: "value_diff_detail",
  screenshotWrapper: "grid",
  conditionalEmptyState: (run, viewOptions) => {
    if (!isValueDiffDetailRun(run)) return null;

    const changedOnly = viewOptions?.changed_only ?? false;
    if (!changedOnly) return null;

    // Check if grid would have 0 rows when changedOnly is true
    const gridData = createDataGrid(run, { changedOnly }) ?? { rows: [] };
    if (gridData.rows.length === 0) {
      return "No change";
    }
    return null;
  },
  transformData: (run, { viewOptions, onViewOptionsChanged }) => {
    if (!isValueDiffDetailRun(run)) {
      return { isEmpty: true };
    }

    const changedOnly = viewOptions?.changed_only ?? false;
    const pinnedColumns = viewOptions?.pinned_columns ?? [];
    const displayMode = viewOptions?.display_mode ?? "inline";
    const columnsRenderMode = viewOptions?.columnsRenderMode ?? {};

    const onColumnsRenderModeChanged = (
      cols: Record<string, ColumnRenderMode>,
    ) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          columnsRenderMode: {
            ...(viewOptions?.columnsRenderMode ?? {}),
            ...cols,
          },
        });
      }
    };

    const handlePinnedColumnsChanged = (newPinnedColumns: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          pinned_columns: newPinnedColumns,
        });
      }
    };

    const gridData = createDataGrid(run, {
      changedOnly,
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      columnsRenderMode,
      onColumnsRenderModeChanged,
      displayMode,
    }) ?? { columns: [], rows: [] };

    if (gridData.columns.length === 0) {
      return { isEmpty: true };
    }

    const warnings = computeValueDiffDetailWarnings(run);

    return {
      columns: gridData.columns,
      rows: gridData.rows,
      warnings,
      toolbar: (
        <>
          <DiffDisplayModeSwitch
            displayMode={displayMode}
            onDisplayModeChanged={(newDisplayMode) => {
              if (onViewOptionsChanged) {
                onViewOptionsChanged({
                  ...viewOptions,
                  display_mode: newDisplayMode,
                });
              }
            }}
          />
          <ChangedOnlyCheckbox
            changedOnly={viewOptions?.changed_only}
            onChange={() => {
              if (onViewOptionsChanged) {
                onViewOptionsChanged({
                  ...viewOptions,
                  changed_only: !viewOptions?.changed_only,
                });
              }
            }}
          />
        </>
      ),
    };
  },
});
```

**Step 4: Clean up unused imports**

Remove imports that are no longer needed after refactoring.

**Step 5: Run verification**

Run: `pnpm -C js lint:fix && pnpm -C js type:check && pnpm -C js test -- --testPathPattern="ValueDiffDetailResultView.test"`
Expected: All tests PASS (same count as baseline)

**Step 6: Commit**

```bash
git add js/src/components/valuediff/ValueDiffDetailResultView.tsx
git commit -s -m "refactor(valuediff): migrate ValueDiffDetailResultView to factory"
```

---

## Phase 3: Migrate QueryResultView

### Task 3.1: Verify baseline tests pass

**Step 1: Run existing tests**

Run: `pnpm -C js test -- --testPathPattern="QueryResultView.test"`
Expected: All tests PASS

Record number of passing tests: ___

---

### Task 3.2: Refactor to use factory

**Files:**
- Modify: `js/src/components/query/QueryResultView.tsx`

**Step 1: Add factory import**

```typescript
import { createResultView } from "@datarecce/ui/primitives";
```

**Step 2: Extract warning computation helper**

```typescript
function computeQueryWarnings(run: Run): string[] {
  if (run.type !== "query") return [];

  const limit = run.result?.limit ?? 0;
  if (limit > 0 && run.result?.more) {
    return [
      `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`,
    ];
  }
  return [];
}
```

**Step 3: Replace component with factory**

```typescript
export const QueryResultView = createResultView<Run, unknown, DataGridHandle>({
  displayName: "QueryResultView",
  typeGuard: isQueryRun,
  expectedRunType: "query",
  screenshotWrapper: "grid",
  transformData: (run, { onAddToChecklist }) => {
    if (!isQueryRun(run)) {
      return { isEmpty: true };
    }

    const gridData = createDataGrid(run) ?? { columns: [], rows: [] };

    if (gridData.columns.length === 0) {
      return { isEmpty: true };
    }

    const warnings = computeQueryWarnings(run);

    return {
      columns: gridData.columns,
      rows: gridData.rows,
      warnings,
      toolbar: onAddToChecklist ? (
        <Button
          size="small"
          variant="outlined"
          onClick={() => onAddToChecklist(run)}
        >
          Add to Checklist
        </Button>
      ) : null,
    };
  },
});
```

**Step 4: Clean up unused imports**

**Step 5: Run verification**

Run: `pnpm -C js lint:fix && pnpm -C js type:check && pnpm -C js test -- --testPathPattern="QueryResultView.test"`
Expected: All tests PASS (same count as baseline)

**Step 6: Commit**

```bash
git add js/src/components/query/QueryResultView.tsx
git commit -s -m "refactor(query): migrate QueryResultView to factory"
```

---

## Phase 4: Final Verification & Documentation

### Task 4.1: Run full test suite

**Step 1: Run all checks**

Run: `pnpm -C js lint && pnpm -C js type:check && pnpm -C js test`
Expected: All PASS

**Step 2: Build packages**

Run: `pnpm -C js/packages/ui build`
Expected: Build succeeds

---

### Task 4.2: Update audit document

**Files:**
- Modify: `docs/plans/2026-01-03-component-library-audit.md`

Update the ResultView status table to reflect completed migrations.

**Step 1: Commit documentation updates**

```bash
git add docs/plans/
git commit -s -m "docs: update component audit with factory toolbar extension"
```

---

## Success Criteria

1. ✅ All existing tests pass (no regressions)
2. ✅ 6 new factory tests pass (toolbar, warnings, onAddToChecklist)
3. ✅ `ValueDiffDetailResultView` uses factory
4. ✅ `QueryResultView` uses factory
5. ✅ `pnpm lint` passes
6. ✅ `pnpm type:check` passes
7. ✅ `pnpm test` passes
8. ✅ `pnpm build` succeeds

---

## Previously Deferred Items (Now Complete)

| Component | Original Concern | Resolution |
|-----------|------------------|------------|
| QueryDiffResultView | Bifurcation logic | ✅ Successfully migrated to factory |
| TopKDiffResultView | Local `useState` | ✅ Successfully migrated using viewOptions pattern |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-03 | Add `toolbar` as ReactNode slot | Maximum flexibility, factory doesn't need to know about RunToolbar |
| 2026-01-03 | Add `warnings` as string array | Factory renders consistently, consumer just provides messages |
| 2026-01-03 | Pass `onAddToChecklist` through transformData | Keeps factory generic, consumer decides how to use it |
| 2026-01-03 | Defer QueryDiffResultView | Bifurcation too complex for current factory |
| 2026-01-03 | Defer TopKDiffResultView | Needs useState support in factory |
