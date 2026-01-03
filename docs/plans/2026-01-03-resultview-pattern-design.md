# ResultView Pattern Abstraction - Design Document

**Date:** 2026-01-03
**Status:** Planning (Follow-up Project)
**Prerequisite:** Complete Phase A & B migrations first
**Goal:** Extract a reusable ResultView abstraction to packages/ui

---

## Problem Statement

Eight ResultView components in `js/src/components/` follow an identical structural pattern:

| Component | Category | Screenshot Wrapper |
|-----------|----------|-------------------|
| `RowCountDiffResultView` | Grid-based | `ScreenshotDataGrid` |
| `ValueDiffResultView` | Grid-based | `ScreenshotDataGrid` |
| `ProfileDiffResultView` | Grid-based + toolbar | `ScreenshotDataGrid` |
| `QueryDiffResultView` | Grid-based | `ScreenshotDataGrid` |
| `QueryResultView` | Grid-based | `ScreenshotDataGrid` |
| `HistogramDiffResultView` | Chart-based | `ScreenshotBox` |
| `TopKDiffResultView` | Chart-based | `ScreenshotBox` |
| `ValueDiffDetailResultView` | Grid-based + toolbar | `ScreenshotDataGrid` |

### Current Pattern (Duplicated)

```typescript
// 1. Type alias for props
type XyzResultViewProp = RunResultViewProps;

// 2. Internal function with forwardRef signature
function _XyzResultView(
  { run }: XyzResultViewProp,
  ref: Ref<DataGridHandle | HTMLDivElement>,
) {
  const isDark = useIsDark();

  // 3. Type guard check
  if (!isXyzRun(run)) {
    throw new Error("Run type must be xyz");
  }

  // 4. Extract params/result
  const params = run.params as XyzParams;
  const result = run.result as XyzResult;

  // 5. Transform data (varies by component)
  const gridData = createDataGrid(run);

  // 6. Render with screenshot wrapper
  return (
    <Box sx={{ height: "100%" }}>
      <ScreenshotDataGrid ref={ref} ... />
      {/* OR */}
      <ScreenshotBox ref={ref} ... />
    </Box>
  );
}

// 7. Export with forwardRef
export const XyzResultView = forwardRef(_XyzResultView);
```

### Problems

1. **Boilerplate duplication** - Same pattern in 8 files
2. **Inconsistent error handling** - Each throws slightly different errors
3. **No shared loading/empty states** - Each handles differently
4. **Type safety gaps** - Manual type assertions on params/result
5. **Testing burden** - Each component needs similar test coverage

---

## Proposed Solution

### Option A: Generic Factory Function (Recommended)

Create a factory that generates type-safe ResultView components:

```typescript
// packages/ui/src/components/result/createResultView.tsx

interface ResultViewConfig<TRun extends Run, TResult, TParams> {
  // Type safety
  typeGuard: (run: Run) => run is TRun;
  runType: string;

  // Data transformation
  transformData: (run: TRun) => TransformedData;

  // Rendering
  renderContent: (props: RenderContentProps<TResult, TParams>) => ReactNode;

  // Screenshot wrapper type
  screenshotWrapper: 'grid' | 'box';

  // Optional customizations
  emptyState?: ReactNode;
  loadingState?: ReactNode;
  toolbar?: (props: ToolbarProps<TParams>) => ReactNode;
}

export function createResultView<TRun, TResult, TParams>(
  config: ResultViewConfig<TRun, TResult, TParams>
) {
  return forwardRef(function ResultView(
    { run, viewOptions, onViewOptionsChanged }: RunResultViewProps,
    ref: Ref<DataGridHandle | HTMLDivElement>
  ) {
    const isDark = useIsDark();

    // Centralized type guard with consistent error
    if (!config.typeGuard(run)) {
      throw new Error(`Expected run type "${config.runType}", got "${run.type}"`);
    }

    const data = config.transformData(run);

    // Handle empty state
    if (data.isEmpty) {
      return config.emptyState ?? <DefaultEmptyState />;
    }

    // Render with appropriate wrapper
    const Wrapper = config.screenshotWrapper === 'grid'
      ? ScreenshotDataGrid
      : ScreenshotBox;

    return (
      <Box sx={{ height: "100%" }}>
        {config.toolbar?.({ params: run.params, viewOptions, onViewOptionsChanged })}
        <Wrapper ref={ref}>
          {config.renderContent({
            result: run.result,
            params: run.params,
            isDark
          })}
        </Wrapper>
      </Box>
    );
  });
}
```

**Usage in Recce OSS:**

```typescript
// js/src/components/rowcount/RowCountDiffResultView.tsx
import { createResultView } from '@datarecce/ui';
import { isRowCountDiffRun } from '@/lib/api/types';
import { createDataGrid } from '@/lib/dataGrid';

export const RowCountDiffResultView = createResultView({
  typeGuard: isRowCountDiffRun,
  runType: 'row_count_diff',
  screenshotWrapper: 'grid',
  transformData: (run) => createDataGrid(run),
  renderContent: ({ data }) => (
    <DataGrid columns={data.columns} rows={data.rows} />
  ),
});
```

### Option B: Higher-Order Component (HOC)

```typescript
// Wrap existing components with shared behavior
export function withResultView<P extends RunResultViewProps>(
  Component: React.ComponentType<P>,
  config: { typeGuard: Function; runType: string }
) {
  return forwardRef((props: P, ref) => {
    if (!config.typeGuard(props.run)) {
      throw new Error(`Expected ${config.runType}`);
    }
    return <Component {...props} ref={ref} />;
  });
}
```

### Option C: Render Props Pattern

```typescript
// Composable building blocks
export function ResultViewContainer({
  run,
  typeGuard,
  children
}: ResultViewContainerProps) {
  if (!typeGuard(run)) return <ErrorState />;
  return <Box sx={{ height: "100%" }}>{children(run)}</Box>;
}
```

---

## Recommendation

**Option A (Factory)** is recommended because:

1. **Most type-safe** - Generic constraints ensure params/result types
2. **Least boilerplate** - Config object captures all variation points
3. **Consistent behavior** - Error handling, empty states centralized
4. **Easy testing** - Test the factory once, components become simple configs
5. **Extensible** - Add new config options without breaking existing usage

---

## Migration Strategy

### Phase 1: Foundation (in packages/ui)

1. Create `createResultView` factory
2. Create shared types (`ResultViewConfig`, `RenderContentProps`)
3. Create `DefaultEmptyState`, `DefaultLoadingState` components
4. Add comprehensive tests for factory

### Phase 2: Migrate Simple Components

1. `RowCountDiffResultView` / `RowCountResultView` - simplest, grid-only
2. `ValueDiffResultView` - grid-only, no toolbar
3. `QueryResultView` - grid-only, no toolbar

### Phase 3: Migrate Complex Components

1. `ProfileDiffResultView` - grid + precision toolbar
2. `ValueDiffDetailResultView` - grid + precision toolbar
3. `TopKDiffResultView` - chart-based
4. `HistogramDiffResultView` - chart-based

### Phase 4: Migrate Query Components

1. `QueryDiffResultView` - grid with special diff coloring

---

## Dependencies

This design depends on these Phase A/B items being completed first:

- [ ] `ScreenshotDataGrid` migrated to packages/ui
- [ ] `ScreenshotBox` migrated to packages/ui
- [ ] `createDataGrid` factory available (or abstracted)
- [ ] Theme system (`useIsDark`) working in packages/ui

---

## Open Questions

1. **Where do type guards live?**
   - Option: Keep in Recce OSS (`@/lib/api/types`)
   - Option: Move generic type guards to packages/ui

2. **Where does `createDataGrid` live?**
   - Option: Keep in Recce OSS (Recce-specific transformation)
   - Option: Create abstract interface, implementations in OSS

3. **How to handle view options?**
   - Some components have precision selectors, others don't
   - Should toolbar be part of abstraction or separate?

4. **Screenshot ref types?**
   - Grid components use `DataGridHandle`
   - Chart components use `HTMLDivElement`
   - Factory needs to handle both

---

## Success Criteria

1. Each ResultView component is < 30 lines of config
2. Shared error handling, empty states, loading states
3. Type-safe params/result extraction
4. All existing tests pass
5. Screenshot functionality preserved

---

## Files to Create/Modify

### New in packages/ui
```
packages/ui/src/components/result/
├── createResultView.tsx       # Factory function
├── ResultViewContainer.tsx    # Shared container
├── DefaultEmptyState.tsx      # Shared empty state
├── DefaultLoadingState.tsx    # Shared loading state
├── types.ts                   # Shared types
└── index.ts                   # Barrel export
```

### Refactored in Recce OSS
```
js/src/components/
├── rowcount/RowCountDiffResultView.tsx  # Config-based
├── valuediff/ValueDiffResultView.tsx    # Config-based
├── histogram/HistogramDiffResultView.tsx # Config-based
├── profile/ProfileDiffResultView.tsx    # Config-based
├── top-k/TopKDiffResultView.tsx         # Config-based
└── query/QueryDiffResultView.tsx        # Config-based
```

---

## Estimated Effort

| Phase | Effort | Risk |
|-------|--------|------|
| Foundation | 2-3 days | Low |
| Simple migrations | 2-3 days | Low |
| Complex migrations | 3-4 days | Medium |
| Query migrations | 1-2 days | Low |
| **Total** | **8-12 days** | **Medium** |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-03 | Document as follow-up project | Depends on Phase A/B completion |
| 2026-01-03 | Recommend factory pattern | Best type safety and extensibility |
