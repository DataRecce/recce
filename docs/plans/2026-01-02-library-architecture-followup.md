# Library-First Architecture: Follow-Up Implementation Plan

**Date:** 2026-01-02
**Status:** ✅ Phase 2 Complete, Phase 3-4 Partially Complete
**Context:** This is a follow-up to `2026-01-02-library-first-component-architecture.md`

> **For Claude:** After context compaction, read this file to restore state.

---

## Implementation Progress

### ✅ COMPLETED (Sessions 1-5)

All 5 sessions have been completed and merged into `feature/datarecce-redesign`.

#### Session 1: Lineage + Check Primitives ✅
**Commit:** `89d9cb1d feat(ui): add lineage and check primitives`

| Component | File | Status |
|-----------|------|--------|
| LineageNode | `components/lineage/nodes/LineageNode.tsx` | ✅ |
| LineageEdge | `components/lineage/edges/LineageEdge.tsx` | ✅ |
| LineageColumnNode | `components/lineage/columns/LineageColumnNode.tsx` | ✅ |
| LineageControls | `components/lineage/controls/LineageControls.tsx` | ✅ |
| LineageLegend | `components/lineage/legend/LineageLegend.tsx` | ✅ |
| CheckCard | `components/check/CheckCard.tsx` | ✅ |
| CheckList | `components/check/CheckList.tsx` | ✅ |
| CheckDetail | `components/check/CheckDetail.tsx` | ✅ |
| CheckDescription | `components/check/CheckDescription.tsx` | ✅ |
| CheckActions | `components/check/CheckActions.tsx` | ✅ |
| CheckEmptyState | `components/check/CheckEmptyState.tsx` | ✅ |

#### Session 2: Query + Run Primitives ✅
**Commit:** `d852fa98 feat(ui): add query and run primitives`

| Component | File | Status |
|-----------|------|--------|
| QueryEditor | `components/query/QueryEditor.tsx` | ✅ |
| QueryResults | `components/query/QueryResults.tsx` | ✅ |
| QueryDiffView | `components/query/QueryDiffView.tsx` | ✅ |
| RunList | `components/run/RunList.tsx` | ✅ |
| RunProgress | `components/run/RunProgress.tsx` | ✅ |
| RunStatusBadge | `components/run/RunStatusBadge.tsx` | ✅ |

#### Session 3: Data + Schema Primitives ✅
**Commit:** `f281bc99 feat(ui): add data and schema primitives`

| Component | File | Status |
|-----------|------|--------|
| HistogramChart | `components/data/HistogramChart.tsx` | ✅ |
| ProfileTable | `components/data/ProfileTable.tsx` | ✅ |
| TopKBarChart | `components/data/TopKBarChart.tsx` | ✅ |
| SchemaDiff | `components/schema/SchemaDiff.tsx` | ✅ |
| SchemaTable | `components/schema/SchemaTable.tsx` | ✅ |

#### Session 4: Editor + UI Primitives ✅
**Commit:** `d73e05fe feat(ui): add editor and UI primitives`

| Component | File | Status |
|-----------|------|--------|
| DiffEditor | `components/editor/DiffEditor.tsx` | ✅ |
| EmptyState | `components/ui/EmptyState.tsx` | ✅ |
| SplitPane | `components/ui/SplitPane.tsx` | ✅ |
| StatusBadge | `components/ui/StatusBadge.tsx` | ✅ |

#### Session 5: Views + Cleanup ✅
**Commit:** `ff78402d feat(ui): add advanced.ts with lower-level exports`

| Item | Status | Notes |
|------|--------|-------|
| LineageView | ✅ | Already existed as high-level component |
| primitives.ts | ✅ | ~40 components exported |
| advanced.ts | ✅ | Utilities, context hooks, theme exports |

---

### 📋 REMAINING WORK

#### Phase 3: High-Level Views (Layer 3) - NOT STARTED

These are composite views that use context providers and compose primitives:

| View | Purpose | Priority |
|------|---------|----------|
| ChecksView | Composes CheckList + CheckDetail with CheckContext | Medium |
| QueryView | Composes QueryEditor + QueryResults with QueryContext | Medium |
| RunsView | Composes RunList + RunResultPane with context | Low |
| RecceLayout | Shell with NavBar + TopBar + content area | Low |

**Note:** LineageView already exists and is the primary high-level view.

#### Phase 4: Additional Cleanup - PARTIAL

| Task | Status | Notes |
|------|--------|-------|
| Audit primitives.ts | ✅ | All ~40 primitives exported |
| Populate advanced.ts | ✅ | Utilities and hooks exported |
| Verify main index.ts | ⚠️ | May need Layer 3 views added |
| Create types/index.ts | ❌ | Not created |
| Final verification | ⚠️ | Type check passes, build not tested |

---

## Current Export Structure

### `@datarecce/ui/primitives` (Layer 2)
```typescript
// Lineage
LineageNode, LineageEdge, LineageColumnNode, LineageControls, LineageLegend

// Check
CheckCard, CheckList, CheckDetail, CheckDescription, CheckActions, CheckEmptyState

// Query
QueryEditor, QueryResults, QueryDiffView

// Run
RunList, RunProgress, RunStatusBadge

// Data
HistogramChart, ProfileTable, TopKBarChart

// Schema
SchemaDiff, SchemaTable

// Editor
DiffEditor

// UI
EmptyState, SplitPane, StatusBadge
```

### `@datarecce/ui/advanced` (Internal Utilities)
```typescript
// Graph utilities
buildLineageGraph, layoutWithDagre, toReactFlowBasic, selectUpstream, selectDownstream

// Context hooks
useLineageGraphContext, useRecceActionContext, useRecceInstanceContext, useIdleTimeout

// Theme
useThemeColors, colors
```

### `@datarecce/ui` (Layer 1 + Layer 3)
```typescript
// Foundation
RecceProvider, ApiProvider, CheckProvider, QueryProvider, ThemeProvider

// High-level views
LineageView
```

---

## Decisions Made During Implementation

### Components NOT Extracted (by design)

| Original Plan | Decision | Reason |
|---------------|----------|--------|
| NodeSelector | Not needed | Selection handled by LineageView |
| DataGrid | ProfileTable | AG Grid wrapper in ProfileTable serves this purpose |
| DataGridDiff | QueryDiffView | Query diff handles data comparison |
| TopKTable | TopKBarChart | Bar chart visualization preferred over table |
| SchemaView | SchemaTable | Single component handles both use cases |
| ColumnList | SchemaTable | Column list integrated into schema table |
| SqlEditor | QueryEditor | Unified editor for SQL |
| YamlEditor | DiffEditor | YAML support via language prop |
| Icons | N/A | Using MUI icons directly |
| ErrorBoundary | N/A | Using Chakra's error handling |
| Toaster | N/A | Using Chakra toast |
| LoadingSpinner | N/A | Using Chakra spinner |

### Architecture Decisions

1. **Pure presentation pattern**: All primitives receive data via props, no internal fetching
2. **Callback-based actions**: All user actions trigger callbacks, no internal state mutations
3. **Theme prop support**: Components accept `theme: 'light' | 'dark'` for styling
4. **AG Grid for tables**: ProfileTable uses AG Grid for high-performance data display
5. **Chart.js for charts**: HistogramChart and TopKBarChart use Chart.js
6. **CodeMirror 6 for editors**: QueryEditor and DiffEditor use CodeMirror 6
7. **React Flow for lineage**: LineageCanvas wraps React Flow

---

## Next Steps (If Continuing)

### Option 1: Complete High-Level Views (Recommended for Full Library)

Create the remaining Layer 3 views that compose primitives with context:

```
Phase 3 Tasks:
1. Create ChecksView - Composes CheckList + CheckDetail with CheckContext
2. Create QueryView - Composes QueryEditor + QueryResults with QueryContext
3. Create RunsView - Composes RunList + RunProgress with context
4. Create RecceLayout - Shell component with navigation
```

### Option 2: Create types/index.ts

Barrel export for public TypeScript types:

```typescript
// types/index.ts
export type { CheckCardData, CheckRunStatus, CheckType } from '../components/check/CheckCard';
export type { LineageNodeData, NodeChangeStatus } from '../components/lineage/nodes';
// ... etc
```

### Option 3: Run Full Verification

```bash
cd js
pnpm install
pnpm type:check:ui    # Type check the ui package
pnpm build            # Full build
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `js/packages/ui/src/primitives.ts` | Layer 2 exports (~40 components) |
| `js/packages/ui/src/advanced.ts` | Internal utilities and hooks |
| `js/packages/ui/src/index.ts` | Layer 1 + Layer 3 exports |
| `docs/plans/2026-01-02-library-first-component-architecture.md` | Original architecture plan |

---

## Summary

**Phase 2 (Primitives): ✅ COMPLETE**
- 30+ pure presentation components created
- All exported via `@datarecce/ui/primitives`

**Phase 3 (Views): ⚠️ PARTIAL**
- LineageView exists
- ChecksView, QueryView, RunsView, RecceLayout not created

**Phase 4 (Cleanup): ⚠️ PARTIAL**
- primitives.ts and advanced.ts complete
- types/index.ts not created
- Full build verification not run

---

## Comprehensive Audit (2026-01-02)

### Verification Results

| Check | Result | Details |
|-------|--------|---------|
| All 26 component files exist | ✅ PASS | All files present in expected locations |
| All 8 barrel index files exist | ✅ PASS | lineage, check, query, run, data, schema, editor, ui |
| Type check (`pnpm type:check`) | ✅ PASS | No TypeScript errors |
| Lint check (`biome check packages/ui/src`) | ✅ PASS | 82 files checked, no errors |
| Pure presentation pattern | ✅ PASS | Verified: CheckCard, QueryEditor, ProfileTable, LineageNode |

### Actual Export Counts (More Than Documented)

The documentation understates what's exported. Actual counts:

| Entry Point | Documented | Actual | Breakdown |
|-------------|------------|--------|-----------|
| `primitives.ts` | ~40 | ~75 | 26 components + 49 types/functions/constants |
| `advanced.ts` | ~15 | ~30 | utilities, hooks, types, constants |
| `index.ts` | ~10 | ~100+ | comprehensive foundation layer |

### Additional Components Exported (Undocumented)

**From `primitives.ts`:**
- Sub-components: `ControlButton`, `QueryEditorToolbar`, `QueryEditorWithToolbar`, `RunListItem`, `RunProgressOverlay`, `RunStatusWithDate`, `SingleBarChart`, `TopKSummaryList`
- Helper functions: `getChartBarColors`, `getChartThemeColors`, `formatRunDate`, `formatRunDateTime`, `mergeSchemaColumns`
- Constants: `COLUMN_NODE_HEIGHT`, `COLUMN_NODE_WIDTH`, `PRIMITIVES_API_VERSION`

**From `advanced.ts`:**
- Type guards: `isLineageGraphColumnNode`, `isLineageGraphNode`
- Set utilities: `getNeighborSet`, `intersect`, `union`
- Constants: `COLUMN_HEIGHT`, `ADVANCED_API_VERSION`

### Issues Found

| Issue | Severity | Status | Recommendation |
|-------|----------|--------|----------------|
| Missing `.gitignore` in `packages/ui/` | Medium | ✅ Fixed | Added `.gitignore` with `dist/` entry |
| `dist/` folder in repo causes lint noise | Low | ✅ Fixed | Now ignored via `.gitignore` |
| Documentation understates exports | Low | ⚠️ Noted | Update Current Export Structure section |

### Component Quality Audit

**Sampled Components (All ✅ PASS):**

| Component | Lines | Pure Presentation | Props-Driven | Callback-Based | JSDoc | Memoized |
|-----------|-------|-------------------|--------------|----------------|-------|----------|
| CheckCard | 304 | ✅ | ✅ | ✅ | ✅ | ✅ |
| QueryEditor | 359 | ✅ | ✅ | ✅ | ✅ | ✅ |
| ProfileTable | 380 | ✅ | ✅ | ✅ | ✅ | ✅ (forwardRef) |
| LineageNode | 156 | ✅ | ✅ | ✅ | ✅ | ✅ |

**Pattern Compliance:**
- ✅ All components receive data via props (no internal fetching)
- ✅ All user actions trigger callbacks (no internal state mutations)
- ✅ Theme prop support (`theme: 'light' | 'dark'`)
- ✅ Well-documented with JSDoc and usage examples
- ✅ Performance optimized with `memo()` or `forwardRef()`

### Recommendations

**High Priority:**
1. ~~Add `.gitignore` to `packages/ui/` with `dist/` entry~~ ✅ Done
2. Run full build verification (`pnpm build` in ui package)

**Medium Priority:**
3. Update "Current Export Structure" section with actual exports
4. Consider creating `types/index.ts` for type-only imports

**Low Priority:**
5. Add component tests for critical primitives
6. Create Storybook stories for visual documentation
