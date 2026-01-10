# Lineage Component Migration Audit

> **Date:** 2026-01-10
> **Branch:** feature/datarecce-redesign
> **Goal:** Migrate `js/src/components/lineage` to `@datarecce/ui` for reusability

---

## Executive Summary

This audit analyzes the lineage visualization components in Recce OSS (`js/src/components/lineage`) for migration to the shared `@datarecce/ui` library. The goal is to enable recce-cloud-infra to consume a complete lineage visualization solution directly from `@datarecce/ui`, eliminating the need for the intermediate `recce-ui` package.

### Current State

| Location | Files | Purpose |
|----------|-------|---------|
| `js/src/components/lineage` | 25+ files | OSS-specific integration layer |
| `js/packages/ui/src/components/lineage` | 16 files | Reusable presentation components |

### Key Finding

**Pattern Identified:** OSS lineage components follow an "adapter" pattern - they wrap @datarecce/ui presentation components with OSS-specific context and state management via `LineageViewContext`.

---

## File-by-File Analysis

### Category 1: Already in @datarecce/ui (Presentation Layer)

These components already exist in `@datarecce/ui` as presentation-only components:

| @datarecce/ui Component | Description | Test Coverage |
|-------------------------|-------------|---------------|
| `LineageNode` | Model node rendering | ✅ LineageNode.test.tsx |
| `LineageColumnNode` | Column-level node | ✅ LineageColumnNode.test.tsx |
| `LineageEdge` | Edge connector | ✅ LineageEdge.test.tsx |
| `LineageCanvas` | React Flow wrapper | ✅ (via LineageNode tests) |
| `LineageView` | High-level composed view | ✅ |
| `LineageControls` | Zoom/navigation | ✅ |
| `LineageLegend` | Status/transformation legend | ✅ |
| `ActionTag` | Action status display | ✅ ActionTag.test.tsx |
| `NodeRunsAggregated` | Aggregated run results | ✅ NodeRunsAggregated.test.tsx |
| `styles.tsx` | Icons and color utilities | ✅ styles.test.ts |

### Category 2: OSS Adapters (Wrap @datarecce/ui Components)

These OSS files wrap @datarecce/ui components with context integration:

| OSS File | Wraps | Migration Action |
|----------|-------|------------------|
| `GraphNode.tsx` | `LineageNode` | **KEEP IN OSS** - Integrates `LineageViewContext` |
| `GraphColumnNode.tsx` | `LineageColumnNode` | **KEEP IN OSS** - Integrates `LineageViewContext` |
| `GraphEdge.tsx` | `LineageEdge` | **KEEP IN OSS** - Integrates `LineageViewContext` |

**Rationale:** These adapters are thin and correctly separate presentation (library) from integration (OSS).

### Category 3: Migration Candidates (Completed)

| OSS File | Lines | Action | Status |
|----------|-------|--------|--------|
| `lineage.ts` | 522→263 | **MIGRATED** - Re-exports from @datarecce/ui | ✅ DRC-2531 |
| `LineageViewContext.tsx` | 91→29 | **MIGRATED** - Types exported from @datarecce/ui | ✅ DRC-2532 |
| `ChangeStatusLegend.tsx` | 47 | **REMOVED** - Use `LineageLegend` | ✅ DRC-2533 |
| `ColumnLevelLineageLegend.tsx` | 58 | **REMOVED** - Use `LineageLegend` | ✅ DRC-2534 |
| `ActionControl.tsx` | 64 | **KEEP IN OSS** - Too small, OSS-coupled | ✅ DRC-2537 |
| `useMultiNodesAction.ts` | 362 | **KEEP IN OSS** - Heavy OSS dependencies | ✅ DRC-2535 |
| `useValueDiffAlertDialog.tsx` | 109 | **KEEP IN OSS** - MUI Dialog | N/A |

### Category 4: OSS-Specific (Keep in OSS)

| OSS File | Lines | Reason |
|----------|-------|--------|
| `LineageView.tsx` | 1385 | Master orchestrator with OSS-specific integrations |
| `LineageViewTopBar.tsx` | 602 | Heavy OSS dependencies (`findByRunType`, registry) |
| `LineageViewContextMenu.tsx` | 640 | Heavy OSS dependencies (run actions, registry) |
| `NodeView.tsx` | 645 | Uses `SchemaView`, `SandboxView`, external components |
| `NodeSqlView.tsx` | 136 | Uses `CodeEditor`, `DiffEditor` from OSS |
| `SandboxView.tsx` | 442 | Uses `QueryForm`, `RunResultPane`, OSS-specific |
| `ColumnLevelLineageControl.tsx` | 328 | OSS-specific mutation handling |
| `NodeTag.tsx` | 285 | Uses `findByRunType`, OSS registry |
| `LineageViewNotification.tsx` | 65 | OSS session storage keys |
| `ServerDisconnectedModalContent.tsx` | 106 | OSS-specific modal |
| `SetupConnectionBanner.tsx` | 55 | OSS-specific settings |
| `SingleEnvironmentQueryView.tsx` | 153 | OSS-specific guides |

---

## Migration Plan

### Phase 1: Core Utilities Migration (P0)

**Goal:** Move core graph building and context types to @datarecce/ui

#### 1.1 Migrate `lineage.ts` to @datarecce/ui

**Current exports:**
- Types: `LineageGraphNode`, `LineageGraphColumnNode`, `LineageGraphEdge`, `LineageGraph`, `NodeColumnSetMap`, `LineageGraphNodes`
- Type Guards: `isLineageGraphNode()`, `isLineageGraphColumnNode()`
- Functions: `buildLineageGraph()`, `selectUpstream()`, `selectDownstream()`, `toReactFlow()`, `layout()`
- Constants: `COLUMN_HEIGHT`

**Dependencies to handle:**
- `@datarecce/ui/api` - Already in library ✅
- `@datarecce/ui` - `getNeighborSet()` already in library ✅
- `@dagrejs/dagre` - Add as peer dependency
- `@xyflow/react` - Already a peer dependency ✅

**Target location:** `packages/ui/src/utils/lineage/`

#### 1.2 Migrate `LineageViewContext.tsx` Types

**Export context types only (not the React context):**
- `LineageViewContextType`
- `ActionState`
- `NodeAction`

**Rationale:** Context implementation stays in OSS, but types should be shared.

**Target location:** `packages/ui/src/contexts/lineage/types.ts`

### Phase 2: Legend Consolidation (P1)

**Goal:** Remove duplicate legend components, use @datarecce/ui `LineageLegend`

#### 2.1 Remove `ChangeStatusLegend.tsx`

**Current behavior:**
- Shows Added/Removed/Modified with icons
- Uses `getIconForChangeStatus` from @datarecce/ui

**@datarecce/ui replacement:** `LineageLegend variant="changeStatus"`

**Migration steps:**
1. Update `LineageView.tsx` to use `LineageLegend` from @datarecce/ui
2. Remove `ChangeStatusLegend.tsx`

#### 2.2 Remove `ColumnLevelLineageLegend.tsx`

**Current behavior:**
- Shows transformation types (Passthrough/Renamed/Derived/Source/Unknown)
- Uses deprecated `TransformationType` from `GraphColumnNode`

**@datarecce/ui replacement:** `LineageLegend variant="transformation"`

**Migration steps:**
1. Update `LineageView.tsx` to use `LineageLegend` from @datarecce/ui
2. Remove `ColumnLevelLineageLegend.tsx`
3. Remove deprecated exports from `GraphColumnNode.tsx`

### Phase 3: Action State Migration (P1)

**Goal:** Migrate multi-node action state management to @datarecce/ui

#### 3.1 Migrate `useMultiNodesAction.ts`

**Current exports:**
- Hook: `useMultiNodesAction()`
- Internal types for action state machine

**Dependencies to handle:**
- `@datarecce/ui/api` - Run submission functions ✅
- Local context types - Migrate with Phase 1 ✅
- `useApiConfig` - Needs abstraction

**Target location:** `packages/ui/src/hooks/useMultiNodesAction.ts`

**Abstraction needed:**
- Create `ApiClientProvider` in @datarecce/ui that OSS can configure

### Phase 4: Test Migration (All Phases)

**Current test files:**
- `lineage.test.ts` - Tests for `lineage.ts`
- `graph.test.ts` - Tests for neighbor set utilities
- `__tests__/LineageView.test.tsx`
- `__tests__/GraphNode.test.tsx`
- `__tests__/GraphColumnNode.test.tsx`
- `__tests__/GraphEdge.test.tsx`

**Migration rule:** Tests move with their source files.

---

## Detailed File Decisions

### Files to MIGRATE to @datarecce/ui

| File | Target Location | Reason |
|------|-----------------|--------|
| `lineage.ts` | `packages/ui/src/utils/lineage/graph.ts` | Pure utility functions, no OSS deps |
| `lineage.test.ts` | `packages/ui/src/utils/lineage/__tests__/` | Tests for above |
| `graph.test.ts` | Already in @datarecce/ui | Merge with existing |

### Files to REMOVE (use @datarecce/ui)

| File | @datarecce/ui Replacement |
|------|---------------------------|
| `ChangeStatusLegend.tsx` | `LineageLegend variant="changeStatus"` |
| `ColumnLevelLineageLegend.tsx` | `LineageLegend variant="transformation"` |

### Files to KEEP in OSS

| File | Reason |
|------|--------|
| `GraphNode.tsx` | Thin adapter integrating LineageViewContext |
| `GraphColumnNode.tsx` | Thin adapter integrating LineageViewContext |
| `GraphEdge.tsx` | Thin adapter integrating LineageViewContext |
| `LineageView.tsx` | Master orchestrator with heavy OSS deps |
| `LineageViewContext.tsx` | React context implementation (types migrate) |
| `LineageViewTopBar.tsx` | Uses `findByRunType`, registry |
| `LineageViewContextMenu.tsx` | Uses `findByRunType`, registry |
| `NodeView.tsx` | Uses SchemaView, SandboxView |
| `NodeSqlView.tsx` | Uses CodeEditor, DiffEditor |
| `NodeTag.tsx` | Uses `findByRunType`, registry |
| `SandboxView.tsx` | Uses QueryForm, RunResultPane |
| `ColumnLevelLineageControl.tsx` | OSS-specific mutation handling |
| `ActionControl.tsx` | OSS-specific progress UI |
| `useMultiNodesAction.ts` | Complex with OSS API deps (evaluate later) |
| `useValueDiffAlertDialog.tsx` | MUI Dialog, OSS-specific |
| `LineageViewNotification.tsx` | OSS session storage |
| `ServerDisconnectedModalContent.tsx` | OSS-specific modals |
| `SetupConnectionBanner.tsx` | OSS-specific settings |
| `SingleEnvironmentQueryView.tsx` | OSS-specific guides |

---

## recce-cloud-infra Usage Analysis

### Currently Used from @datarecce/ui

| Component | Usage Location |
|-----------|----------------|
| `LineageView` | `clientPage.tsx` - Interactive lineage |
| `QueryPage` | `clientPage.tsx` |
| `RunResultPane` | `clientPage.tsx` |
| `CheckList` | `ChecklistPageOSS.tsx` |
| `CheckDetail` | `ChecklistPageOSS.tsx` |
| `HSplit` | Multiple files |
| `useRecceActionContext` | `clientPage.tsx`, `RunHistory.tsx` |
| `useRecceCheckContext` | `ChecklistPageOSS.tsx` |
| `RouteConfigProvider` | `layout.tsx` |

### Gaps Identified

1. **Session-aware artifact access** - Cloud needs session context for artifact fetching
2. **Instance lifecycle management** - Not in @datarecce/ui scope
3. **Cloud-specific routing** - Handled via `RouteConfigProvider` ✅

### Post-Migration Benefits for Cloud

After migration, recce-cloud-infra will get:
- `buildLineageGraph()` - Graph construction utilities
- `selectUpstream()`/`selectDownstream()` - Selection helpers
- `toReactFlow()` - React Flow conversion
- `layout()` - Dagre layout integration
- Shared context types for type safety

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking OSS during migration | Medium | High | Comprehensive tests before/after |
| Type mismatches after migration | Low | Medium | TypeScript strict mode |
| recce-cloud-infra regression | Low | High | Test cloud integration post-migration |
| Circular dependencies | Medium | Medium | Careful import organization |

---

## Success Criteria

1. ✅ All migrated code has tests in @datarecce/ui
2. ✅ OSS lineage functionality unchanged
3. ✅ `pnpm type:check` passes
4. ✅ `pnpm test` passes (2489+ tests)
5. ✅ recce-cloud-infra builds successfully
6. ✅ No duplicate functionality between OSS and @datarecce/ui

---

## Linear Issues to Create

### Epic: Lineage Component Migration

1. **[P0] Migrate lineage.ts graph utilities to @datarecce/ui**
   - Move types, functions, constants
   - Add dagre as peer dependency
   - Migrate tests

2. **[P0] Export LineageViewContext types from @datarecce/ui**
   - Create types file
   - Export from contexts barrel

3. **[P1] Replace ChangeStatusLegend with LineageLegend**
   - Update LineageView.tsx
   - Remove ChangeStatusLegend.tsx
   - Update tests

4. **[P1] Replace ColumnLevelLineageLegend with LineageLegend**
   - Update LineageView.tsx
   - Remove ColumnLevelLineageLegend.tsx
   - Remove deprecated exports from GraphColumnNode.tsx
   - Update tests

5. **[P2] Evaluate ActionControl migration** ✅ EVALUATED
   - **Decision: KEEP IN OSS**
   - Rationale: Too small (64 lines), tightly coupled to OSS `LineageViewContext`

6. **[P2] Evaluate useMultiNodesAction migration** ✅ EVALUATED
   - **Decision: KEEP IN OSS**
   - Rationale: Heavy OSS dependencies (tracking, API config, context adapters)

7. **[P1] Documentation: Update adapter-patterns.md**
   - Document lineage adapter pattern
   - Add migration guidance

---

## Appendix: Component Dependency Graph

```
OSS LineageView.tsx (1385 lines)
├── @datarecce/ui
│   ├── LineageCanvas (React Flow wrapper)
│   ├── LineageLegend (change status, transformation)
│   └── Styling utilities
├── OSS Adapters
│   ├── GraphNode.tsx → @datarecce/ui/LineageNode
│   ├── GraphColumnNode.tsx → @datarecce/ui/LineageColumnNode
│   └── GraphEdge.tsx → @datarecce/ui/LineageEdge
├── OSS Context
│   └── LineageViewContext.tsx (state management)
├── OSS Controls
│   ├── LineageViewTopBar.tsx
│   ├── LineageViewContextMenu.tsx
│   └── ColumnLevelLineageControl.tsx
├── OSS Detail Views
│   ├── NodeView.tsx → SchemaView, SandboxView
│   └── NodeSqlView.tsx → CodeEditor, DiffEditor
├── OSS Utilities
│   ├── lineage.ts (migrate to @datarecce/ui)
│   └── useMultiNodesAction.ts
└── OSS Notifications
    ├── LineageViewNotification.tsx
    ├── SetupConnectionBanner.tsx
    └── SingleEnvironmentQueryView.tsx
```

---

## Evaluation Decisions

### DRC-2535: useMultiNodesAction.ts - KEEP IN OSS

**Analysis Date:** 2026-01-10

**OSS-Specific Dependencies:**
- `useApiConfig` - OSS API configuration pattern
- `useRecceActionContext` - OSS action context adapter (for `showRunId`)
- `trackExploreAction` - OSS tracking/analytics
- `Run` type from OSS (for discriminated union support)

**What it does:**
- Orchestrates multi-node actions (row count, row count diff, value diff)
- Manages action state machine (pending → running → completed/canceled)
- Creates lineage diff and schema diff checks
- Handles cancellation logic

**Decision: KEEP IN OSS**

**Rationale:**
1. **Heavy OSS Dependencies** - Uses `useApiConfig`, `useRecceActionContext`, and OSS tracking
2. **Business Logic** - Implements OSS-specific workflows (which run types, how to create checks)
3. **State Machine is Simple** - The polling/state logic is straightforward, not worth extracting
4. **Cloud Has Different Patterns** - Cloud orchestration differs from OSS (session-aware, different auth)

**Alternative Considered:** Extract core state machine to @datarecce/ui
- Rejected because: The state machine is tightly coupled to the specific actions and would require significant abstraction for minimal benefit

---

### DRC-2537: ActionControl.tsx - KEEP IN OSS

**Analysis Date:** 2026-01-10

**OSS-Specific Dependencies:**
- `useLineageViewContextSafe` - OSS context for action state

**What it does:**
- Displays progress (per-node count or percentage)
- Shows cancel/close buttons based on action status
- Simple MUI-based UI (Box, Button, Divider, Stack)

**Decision: KEEP IN OSS**

**Rationale:**
1. **Too Small** - Only 64 lines, migration overhead exceeds benefit
2. **OSS Context Coupling** - Uses `useLineageViewContextSafe` for state
3. **Lineage-Specific** - Only used in lineage view, not a generic component
4. **Low Cloud Value** - Cloud would need different progress UI patterns anyway

**Alternative Considered:** Make it generic by accepting `actionState` as props
- Rejected because: Component is too small and specialized for the effort

---

## Migration Summary

### Completed Tasks

| Issue | Description | Status |
|-------|-------------|--------|
| DRC-2531 | Migrate lineage.ts graph utilities | ✅ Done |
| DRC-2532 | Export LineageViewContext types | ✅ Done |
| DRC-2533 | Replace ChangeStatusLegend with LineageLegend | ✅ Done |
| DRC-2534 | Replace ColumnLevelLineageLegend with LineageLegend | ✅ Done |
| DRC-2535 | Evaluate useMultiNodesAction migration | ✅ Done (Keep in OSS) |
| DRC-2536 | Document lineage adapter pattern | ✅ Done |
| DRC-2537 | Evaluate ActionControl migration | ✅ Done (Keep in OSS) |

### Impact Summary

**Files Removed:** 2
- `ChangeStatusLegend.tsx` (47 lines)
- `ColumnLevelLineageLegend.tsx` (58 lines)

**Files Simplified:** 2
- `lineage.ts` (522 → 263 lines, -259 lines)
- `LineageViewContext.tsx` (91 → 29 lines, -62 lines)

**Total Lines Removed/Reduced:** 426 lines

**New @datarecce/ui Exports:**
- Types: `LineageViewContextType`, `ActionState`, `NodeAction`, `ActionMode`, `SelectMode`
- Functions: `buildLineageGraph`, `selectUpstream`, `selectDownstream`, `isLineageGraphNode`, `isLineageGraphColumnNode`
- Constants: `COLUMN_HEIGHT`

---

## Next Steps

1. ~~Create Linear issues for tracking~~ ✅
2. ~~Execute Phase 1: Core utilities migration~~ ✅
3. ~~Execute Phase 2: Legend consolidation~~ ✅
4. ~~Update documentation~~ ✅
5. Verify cloud integration (manual testing)
