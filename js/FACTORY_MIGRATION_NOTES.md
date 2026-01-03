# ResultView Factory Migration Notes

## Migration Status Summary

| Component | Status | Reason |
|-----------|--------|--------|
| RowCountDiffResultView | COMPLETE | Simple grid |
| HistogramDiffResultView | COMPLETE | Simple chart |
| ValueDiffResultView | COMPLETE | Uses header support |
| ProfileResultView | COMPLETE | Simple grid with column render modes |
| ProfileDiffResultView | COMPLETE | Grid with toolbar header |
| TopKDiffResultView | KEEP MANUAL | Local state toggle |
| QueryResultView | KEEP MANUAL | Extra props (`onAddToChecklist`) |
| QueryDiffResultView | KEEP MANUAL | Extra props + complex branching logic |
| ValueDiffDetailResultView | KEEP MANUAL | Custom "No change" empty state with toolbar |

**Final Count: 5 migrated, 4 kept manual (9 total components)**

---

## Phase 2 - Component Migrations

### Task 2.1: RowCountDiffResultView - COMPLETE
- Migrated successfully using `screenshotWrapper: "grid"`
- Simple grid rendering with no additional UI
- All 13 tests passing

### Task 2.3: HistogramDiffResultView - COMPLETE
- Migrated successfully using `screenshotWrapper: "box"`
- Simple chart rendering with no additional UI outside ScreenshotBox
- Loading state handled via `conditionalEmptyState`
- All 21 tests passing

### Task 2.2: ValueDiffResultView - COMPLETE
- Migrated successfully after Phase 3 header/footer support was added
- Uses `header` field in `ResultViewData` for summary display
- Factory renders header above the grid automatically

---

## Phase 3 - Factory Enhancement: Header/Footer Support - COMPLETE

Header and footer support was added to the factory's `ResultViewData` interface:

```typescript
export interface ResultViewData {
  columns?: unknown[];
  rows?: unknown[];
  content?: ReactNode;
  isEmpty?: boolean;
  renderNull?: boolean;

  // Phase 3 additions
  header?: ReactNode;   // Rendered above grid/content
  footer?: ReactNode;   // Rendered below grid/content
}
```

The factory's grid wrapper now handles these fields automatically when `screenshotWrapper: "grid"` is used.

---

## Components Kept Manual

### Task 2.4: TopKDiffResultView - KEEP MANUAL

**Status:** Will not migrate - local state pattern incompatible with factory

**Reason:** Component uses `useState` for toggle, which is fundamentally different from the factory's stateless `transformData` pattern.

**Assessment (2026-01-03):**
- Footer support was added to the factory
- However, the `isDisplayTopTen` toggle requires local component state
- The factory's `transformData` is a pure function called on each render
- Adding state callbacks/render props would over-complicate the factory for one component

**Decision:** Keep TopKDiffResultView as manual implementation. The cost of adding local state support to the factory outweighs the benefit for a single component.

**Could migrate if:**
- Toggle was moved to `viewOptions` prop (externalized state)
- But this would require parent component changes

---

### Task 2.5: QueryResultView - KEEP MANUAL

**Status:** Will not migrate - extra props incompatible with factory pattern

**Assessment (2026-01-03):**

**Reason:** Component requires an `onAddToChecklist` callback prop that is not part of the standard `RunResultViewProps`. The factory's `transformData` function only receives the run object and cannot access additional component props.

**Current Implementation Details:**
- Type guard accepts BOTH `query` AND `query_base` run types
- Extra prop: `onAddToChecklist?: (run: Run) => void`
- Header bar with conditional warning (when `limit > 0 && dataframe?.more`)
- Header bar with "Add to Checklist" button (when `onAddToChecklist` provided)
- Uses `createDataGrid` for column/row generation
- ViewOptions: `pinned_columns`, `columnsRenderMode`

**Why Factory Cannot Support This:**
```tsx
// QueryResultView extends RunResultViewProps with extra prop
interface QueryResultViewProp extends RunResultViewProps<QueryViewOptions> {
  onAddToChecklist?: (run: Run) => void;  // <-- Not available in factory
}
```

The factory's `transformData` signature is:
```typescript
transformData(run: R, viewOptions?: V): ResultViewData | null
```

The `onAddToChecklist` callback cannot be passed through this interface because:
1. `transformData` is a pure data transformation function
2. Callbacks in headers need access to the full component props
3. The factory would need significant restructuring to support arbitrary extra props

**Decision:** Keep QueryResultView as manual implementation. The header requires the `onAddToChecklist` callback which isn't accessible from `transformData`.

---

### Task 2.6: QueryDiffResultView - KEEP MANUAL

**Status:** Will not migrate - extra props + complex branching logic

**Assessment (2026-01-03):**

**Reason:** Multiple factors make this component unsuitable for factory migration:

1. **Extra Props:** Same issue as QueryResultView
   ```tsx
   export interface QueryDiffResultViewProps extends RunResultViewProps<QueryDiffViewOptions> {
     onAddToChecklist?: (run: Run) => void;  // Extra callback
     baseTitle?: string;                      // Extra display prop
     currentTitle?: string;                   // Extra display prop
   }
   ```

2. **Complex Branching:** Component renders different sub-views based on result structure
   - `QueryDiffResultViewWithRef` - for base/current comparison
   - `QueryDiffJoinResultViewWithRef` - for joined diff results
   - Branch decision: `"diff" in props.run.result && props.run.result.diff != null`

3. **Dynamic Title Logic:** Titles are computed based on run params
   ```tsx
   if (props.run.params?.current_model) {
     baseTitle = "Original";
     currentTitle = "Editor";
   }
   ```

4. **Complex Toolbar:** Uses `RunToolbar` with:
   - `DiffDisplayModeSwitch` component
   - `ChangedOnlyCheckbox` component
   - Dynamic warning messages (primary key validity, limit warnings)

**Decision:** Keep QueryDiffResultView as manual implementation. The complexity of branching logic and extra props would require extensive factory modifications.

---

### Task 2.7: ProfileResultView - COMPLETE

**Status:** Migrated successfully

**Assessment (2026-01-03):**

ProfileResultView is a simple grid component that uses `createResultView` with:
- `screenshotWrapper: "grid"`
- Column render mode support for proportion columns
- No header (just the grid)
- No complex state or extra props

**Implementation:** Uses factory's standard grid wrapper pattern.

---

### Task 2.8: ProfileDiffResultView - COMPLETE

**Status:** Migrated successfully

**Assessment (2026-01-03):**

ProfileDiffResultView uses `createResultView` with:
- `screenshotWrapper: "grid"`
- Header with `RunToolbar` containing `DiffDisplayModeSwitch`
- Column render mode support for proportion columns
- View options for display mode and pinned columns

**Implementation:** Uses factory's header support to render the toolbar above the grid.

---

### Task 2.9: ValueDiffDetailResultView - KEEP MANUAL

**Status:** Will not migrate - custom conditional empty state + extra props

**Assessment (2026-01-03):**

**Reasons for keeping manual:**

1. **Extra Props:** Same issue as QueryResultView
   ```tsx
   export interface ValueDiffDetailResultViewProps
     extends RunResultViewProps<ValueDiffDetailViewOptions> {
     onAddToChecklist?: (run: Run) => void;  // Extra callback
   }
   ```

2. **Custom "No change" Empty State:** When `changedOnly` is true and there are no rows, the component renders a special empty state that PRESERVES the toolbar (lines 127-155):
   ```tsx
   if (changedOnly && gridData.rows.length === 0) {
     return (
       <Box sx={{ display: "flex", flexDirection: "column", ... }}>
         <RunToolbar run={run} viewOptions={viewOptions} ... />
         <Box sx={{ ... }}>
           No change
         </Box>
       </Box>
     );
   }
   ```

   The factory's `isEmpty` handling would hide the entire component including the header. This component requires the toolbar to remain visible so users can toggle off "Changed Only" to see all rows.

3. **Complex Toolbar:** Uses `RunToolbar` with:
   - `DiffDisplayModeSwitch` component
   - `ChangedOnlyCheckbox` component
   - Dynamic warning messages (limit warnings)

**Decision:** Keep ValueDiffDetailResultView as manual implementation. The conditional empty state that preserves the toolbar cannot be expressed through the factory's `isEmpty` pattern.

---

## Testing Requirements

When migrating components to the factory:
1. Verify type guard correctly identifies run type
2. Verify header renders above grid (if applicable)
3. Verify footer renders below grid (if applicable)
4. Verify grid sizing with fixed headers (flex: 1, minHeight: 0)
5. Verify screenshot capture includes header+grid
6. Verify empty state behavior
7. Verify ref forwarding still works with grid
8. Test with various content types

---

## Related Files

**Factory:**
- `/js/packages/ui/src/components/result/createResultView.tsx`
- `/js/packages/ui/src/components/result/types.ts`

**Migrated Components (5):**
- `/js/src/components/rowcount/RowCountDiffResultView.tsx`
- `/js/src/components/histogram/HistogramDiffResultView.tsx`
- `/js/src/components/valuediff/ValueDiffResultView.tsx`
- `/js/src/components/profile/ProfileDiffResultView.tsx` (contains both ProfileResultView and ProfileDiffResultView)

**Manual Components (4):**
- `/js/src/components/topkdiff/TopKDiffResultView.tsx`
- `/js/src/components/query/QueryResultView.tsx`
- `/js/src/components/query/QueryDiffResultView.tsx`
- `/js/src/components/valuediff/ValueDiffDetailResultView.tsx`
