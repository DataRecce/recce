# DataGrid Migration Audit Report

**Date:** 2026-01-09
**Project:** @datarecce/ui Component Library
**Scope:** `js/src/lib/dataGrid` and `js/src/components/ui/dataGrid`

---

## Executive Summary

This audit evaluates the dataGrid directories for migration to @datarecce/ui. The analysis reveals that **most code is pure presentation/utility logic** suitable for migration, with one notable exception containing application-specific context dependencies.

**Key Finding:** recce-cloud-infra does NOT currently use @datarecce/ui for data grids—they have their own react-data-grid implementation. This migration is primarily about consolidating the Recce OSS codebase and preparing for future consumers.

---

## Current State

### What's Already in @datarecce/ui

| Export | Location | Purpose |
|--------|----------|---------|
| `ScreenshotDataGrid` | `primitives` | AG Grid wrapper with screenshot support |
| `dataGridThemeDark/Light` | `primitives` | AG Grid themes |
| `ProfileTable` | `primitives` | AG Grid based column statistics |
| `DataGridHandle`, `DataGridRow`, etc. | `primitives` | Type definitions |

### What recce-cloud-infra Uses

**None from @datarecce/ui for data grids.** They use `react-data-grid` (v7.0.0-beta.59) directly in 5 ResultView files:
- `QueryResultView.tsx`
- `QueryDiffResultView.tsx`
- `ValueDiffResultView.tsx`
- `RowCountDiffResultView.tsx`
- `ProfileDiffResultView.tsx`

---

## Directory Analysis

### 1. `js/src/lib/dataGrid` (18 files)

**Structure:**
```
src/lib/dataGrid/
├── index.ts                    # Public API barrel export
├── dataGridFactory.ts          # Run-based factory routing
├── generators/                 # Grid data generators (8 files)
│   ├── toDataGrid.ts           # Single DataFrame
│   ├── toDataDiffGrid.ts       # Dual DataFrame diff
│   ├── toValueDiffGrid.ts      # Joined DataFrame (in_a/in_b)
│   ├── toValueDataGrid.ts      # Value diff summary
│   ├── toSchemaDataGrid.ts     # Schema diff
│   ├── toRowCountDataGrid.ts   # Row count single
│   ├── toRowCountDiffDataGrid.ts # Row count diff
│   └── rowCountUtils.ts        # Row count utilities
└── shared/                     # Shared utilities (8 files)
    ├── index.ts                # Barrel export
    ├── columnBuilders.ts       # Column config (pure TS)
    ├── rowBuilders.ts          # Row building (pure TS)
    ├── gridUtils.ts            # Utilities (pure TS)
    ├── validation.ts           # Validation (pure TS)
    ├── diffColumnBuilder.tsx   # Diff columns (React)
    ├── simpleColumnBuilder.tsx # Simple columns (React)
    └── toDiffColumn.tsx        # Diff column factory (React)
```

**Dependencies:**
- External: `@datarecce/ui/api` (types), `@datarecce/ui/utils` (utilities), `ag-grid-community`, `lodash`
- Internal: `components/ui/dataGrid` (cell renderers)

**Classification:**

| Category | Files | Migration Status |
|----------|-------|------------------|
| Pure TS utilities | 5 | **Migrate** - No React, no context |
| React column builders | 3 | **Migrate** - Pure presentation |
| Generators | 8 | **Migrate** - Stateless functions |
| Factory | 2 | **Keep in OSS** - App-specific Run type routing |

### 2. `js/src/components/ui/dataGrid` (7 files)

**Structure:**
```
src/components/ui/dataGrid/
├── index.ts                        # Barrel export
├── DataFrameColumnHeader.tsx       # Simple header
├── DataFrameColumnGroupHeader.tsx  # Advanced header with PK
├── defaultRenderCell.tsx           # Standard cell renderer
├── inlineRenderCell.tsx            # Inline diff renderer
├── valueDiffCells.tsx              # Value diff cells (MIXED)
└── schemaCells.tsx                 # Schema diff cells
```

**Classification:**

| Component | Type | Migration Status |
|-----------|------|------------------|
| `DataFrameColumnHeader` | Pure presentation | **Migrate** |
| `DataFrameColumnGroupHeader` | Pure presentation | **Migrate** |
| `defaultRenderCell` | Pure utility | **Migrate** |
| `inlineRenderCell` | Pure utility | **Migrate** |
| `PrimaryKeyIndicatorCell` | Pure presentation | **Migrate** |
| `MatchedPercentCell` | Pure presentation | **Migrate** |
| `ValueDiffColumnNameCell` | **App-specific** | **Keep in OSS** |
| `schemaCells.tsx` renderers | Pure utilities | **Migrate** |

**Note:** `ValueDiffColumnNameCell` uses `useRecceActionContext` and `useRecceInstanceContext` for drill-down functionality—this is application-specific behavior.

---

## Recommended Migration Plan

### Phase 1: Migrate Shared Utilities (Pure TS)

Move to `@datarecce/ui/utils/dataGrid/`:

1. `validation.ts` - Input validation with custom errors
2. `gridUtils.ts` - Column mapping, PK handling, cell classes
3. `columnBuilders.ts` - Column configuration logic
4. `rowBuilders.ts` - Diff row building logic
5. `rowCountUtils.ts` - Row count conversions

**Effort:** Low (~2 hours)

### Phase 2: Migrate Column Builders (React)

Move to `@datarecce/ui/components/data/`:

1. `diffColumnBuilder.tsx` - Diff column definitions
2. `simpleColumnBuilder.tsx` - Simple column definitions
3. `toDiffColumn.tsx` - Diff column factory

**Effort:** Medium (~3 hours) - Need to resolve circular deps

### Phase 3: Migrate Cell Renderers

Move to `@datarecce/ui/components/data/`:

1. `DataFrameColumnHeader.tsx`
2. `DataFrameColumnGroupHeader.tsx`
3. `defaultRenderCell.tsx`
4. `inlineRenderCell.tsx`
5. `schemaCells.tsx` (pure renderers only)
6. Pure components from `valueDiffCells.tsx`:
   - `PrimaryKeyIndicatorCell`
   - `MatchedPercentCell`
   - `createPrimaryKeyIndicatorRenderer`
   - `renderMatchedPercentCell`

**Effort:** Medium (~3 hours)

### Phase 4: Migrate Generators (Partial)

Move to `@datarecce/ui/utils/dataGrid/generators/`:

Only migrate generators that don't depend on Run type:
1. `toDataGrid.ts`
2. `toDataDiffGrid.ts`
3. `toValueDiffGrid.ts`
4. `toSchemaDataGrid.ts`
5. `toRowCountDataGrid.ts`
6. `toRowCountDiffDataGrid.ts`
7. `toValueDataGrid.ts` (needs refactoring - uses valueDiffCells)

**Keep in OSS:**
- `dataGridFactory.ts` - Routes by Run type (app-specific)
- `index.ts` - Re-exports from @datarecce/ui + app-specific

**Effort:** High (~4 hours)

### What Stays in OSS

| Item | Reason |
|------|--------|
| `dataGridFactory.ts` | Routes by Run type, app-specific |
| `ValueDiffColumnNameCell` | Uses action context for drill-down |
| `ColumnNameCell` (schema) | References app-specific components |
| Main `index.ts` | App-specific exports and Run type |

---

## Dependency Resolution

### Current Issue: Circular Dependencies

```
lib/dataGrid/generators → components/ui/dataGrid (cell renderers)
components/ui/dataGrid → lib/dataGrid/shared (utilities)
```

**Solution:** After migration, both will be in @datarecce/ui:
- Utilities in `@datarecce/ui/utils/dataGrid`
- Cell renderers in `@datarecce/ui/components/data`
- Import paths become internal to the package

### External Dependencies to Add to @datarecce/ui

None new - already uses `ag-grid-community` and `lodash`.

---

## Estimated Total Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Shared utilities | ~2 hours |
| Phase 2: Column builders | ~3 hours |
| Phase 3: Cell renderers | ~3 hours |
| Phase 4: Generators | ~4 hours |
| Testing & cleanup | ~2 hours |
| **Total** | **~14 hours** |

---

## Risks

1. **Breaking changes in imports** - Consumers importing from `lib/dataGrid` need updates
2. **Test migration** - 15+ test files need to move with the code
3. **Type exports** - Many types are exported; ensure all are re-exported
4. **Bundle size** - Adding more to @datarecce/ui; monitor tree-shaking

---

## Recommendation

**Proceed with migration in phases.** The dataGrid code is well-structured with clear separation between pure utilities and application-specific logic. Migration will:

1. Consolidate code in @datarecce/ui for future consumers
2. Improve testability with isolated pure functions
3. Enable recce-cloud-infra to eventually adopt standard components
4. Reduce duplication if cloud chooses to migrate from react-data-grid

---

## Linear Issues

1. **DRC-2520:** Migrate dataGrid shared utilities to @datarecce/ui (Phase 1)
2. **DRC-2521:** Migrate dataGrid column builders to @datarecce/ui (Phase 2)
3. **DRC-2522:** Migrate dataGrid cell renderers to @datarecce/ui (Phase 3)
4. **DRC-2523:** Migrate dataGrid generators to @datarecce/ui (Phase 4)
5. **DRC-2524:** Update OSS to import dataGrid from @datarecce/ui (Phase 5)

---

## Files Summary

### To Migrate (27 files)

**Utilities (5):**
- `shared/validation.ts`
- `shared/gridUtils.ts`
- `shared/columnBuilders.ts`
- `shared/rowBuilders.ts`
- `generators/rowCountUtils.ts`

**Column Builders (3):**
- `shared/diffColumnBuilder.tsx`
- `shared/simpleColumnBuilder.tsx`
- `shared/toDiffColumn.tsx`

**Cell Renderers (6):**
- `components/ui/dataGrid/DataFrameColumnHeader.tsx`
- `components/ui/dataGrid/DataFrameColumnGroupHeader.tsx`
- `components/ui/dataGrid/defaultRenderCell.tsx`
- `components/ui/dataGrid/inlineRenderCell.tsx`
- `components/ui/dataGrid/schemaCells.tsx`
- `components/ui/dataGrid/valueDiffCells.tsx` (partial - pure components only)

**Generators (7):**
- `generators/toDataGrid.ts`
- `generators/toDataDiffGrid.ts`
- `generators/toValueDiffGrid.ts`
- `generators/toValueDataGrid.ts`
- `generators/toSchemaDataGrid.ts`
- `generators/toRowCountDataGrid.ts`
- `generators/toRowCountDiffDataGrid.ts`

**Tests (15+):** All associated test files

### To Keep in OSS (4 files)

- `dataGridFactory.ts` - Run type routing
- `index.ts` - App-specific barrel export
- `ValueDiffColumnNameCell` component - Context-dependent
- `ColumnNameCell` reference - App-specific

---

## Changelog

### 2026-01-09
- Initial audit completed
- Analyzed 25+ source files in lib/dataGrid and components/ui/dataGrid
- Verified recce-cloud-infra does not use @datarecce/ui for data grids
- Identified 27 files suitable for migration, 4 to keep in OSS
- Created phased migration plan with ~14 hour estimate
