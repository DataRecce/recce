# Lineage Migration Audit Report

## Executive Summary

This document provides a comprehensive audit of the migration effort to move React components from `js/src/components/lineage/` (OSS) to the `@datarecce/ui` package (`js/packages/ui/`). The migration follows an **adapter pattern** where OSS components become thin wrappers that inject OSS-specific context and callbacks into framework-agnostic UI components.

### Current Status

| Category | Count | Status |
|----------|-------|--------|
| Fully Migrated (pure wrappers) | 9 | Complete |
| Partially Migrated | 3 | In Progress |
| Pending Migration | 8 | Not Started |
| Stay in OSS (page-level) | 4 | N/A |

### Key Findings

1. **9 files are now pure wrappers** - They delegate all rendering to `@datarecce/ui` and only provide context integration
2. **Primary blockers** are OSS-specific adapters (`useRecceActionContext`, `useRecceQueryContext`) and tracking functions
3. **Run Registry dependency** (`findByRunType`) provides icons/titles and must be abstracted
4. **Estimated remaining effort**: 5 phases, approximately 3-4 sprints of focused work

---

## Current State Analysis

### Files Inventory

#### Fully Migrated (9 files - Pure Wrappers)

These files are now thin wrappers that delegate rendering to `@datarecce/ui`:

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `LineageViewContext.tsx` | 21 | **Complete** | Creates React context using `LineageViewContextType` from @datarecce/ui |
| `ActionControl.tsx` | 53 | **Complete** | Wraps `@datarecce/ui/components/lineage/ActionControl` |
| `GraphNode.tsx` | 445 | **Complete** | Wraps `LineageNode` with OSS context integration; contains helper components (`RowCountDiffTag`, `ActionTagDisplay`) |
| `GraphEdge.tsx` | 60 | **Complete** | Uses context for highlighting, wraps `BaseEdge` |
| `GraphColumnNode.tsx` | 98 | **Complete** | Wraps `LineageColumnNode` with context integration |
| `NodeSqlView.tsx` | 40 | **Complete** | Wraps @datarecce/ui with editor dependency injection |
| `LineageViewNotification.tsx` | 3 | **Complete** | Pure re-export from @datarecce/ui |
| `useValueDiffAlertDialog.tsx` | 37 | **Complete** | Thin wrapper that adds tracking callbacks |
| `lineage.test.ts` | 170 | **Complete** | Tests `buildLineageGraph` from @datarecce/ui |

#### Partially Migrated (3 files)

These files use @datarecce/ui types and some utilities but still contain significant OSS-specific logic:

| File | Lines | Status | Blocking Dependencies |
|------|-------|--------|----------------------|
| `lineage.ts` | 240 | **Partial** | Uses @datarecce/ui types; contains `toReactFlow()` and `layout()` functions |
| `NodeTag.tsx` | 285 | **Partial** | Uses @datarecce/ui contexts; still has `findByRunType` dependency |
| `NodeView.tsx` | 645 | **Partial** | Uses @datarecce/ui contexts; heavy OSS adapter dependencies |

#### Pending Migration (8 files)

These files need migration but have significant OSS dependencies:

| File | Lines | Primary Blockers |
|------|-------|------------------|
| `useMultiNodesAction.ts` | 360 | `useApiConfig`, `useRecceActionContext`, tracking functions |
| `LineageViewContextMenu.tsx` | 639 | `useRecceActionContext`, `useRecceQueryContext`, `useAppLocation`, `findByRunType`, `SetupConnectionPopover` |
| `ColumnLevelLineageControl.tsx` | 328 | `useLineageViewContextSafe`, mutation handling |
| `SandboxView.tsx` | 442 | `useApiConfig`, `useRecceQueryContext`, `useRecceActionContext`, tracking, toasts, `QueryForm`, `RunResultPane` |
| `LineageViewTopBar.tsx` | 602 | `useLineageViewContextSafe`, `findByRunType`, `SetupConnectionPopover`, `HistoryToggle` |
| `LineageView.tsx` | 1385 | Main orchestrator - depends on nearly all other files |
| `graph.test.ts` | ~50 | Test file for graph utilities |
| `styles.css` | ~100 | CSS file (low complexity) |

#### Stay in OSS (4 files - Page-Level)

These files are OSS-specific page/application components and should not be migrated:

| File | Lines | Reason |
|------|-------|--------|
| `LineagePage.tsx` | 11 | Page wrapper with `ReactFlowProvider` |
| `SetupConnectionBanner.tsx` | ~50 | OSS-specific onboarding UI |
| `ServerDisconnectedModalContent.tsx` | ~30 | OSS-specific error handling |
| `SingleEnvironmentQueryView.tsx` | ~100 | OSS-specific single-env mode |

---

## Dependency Analysis

### OSS Context Adapters

The following OSS-specific context adapters block migration:

```typescript
// From @/lib/hooks/RecceActionAdapter
useRecceActionContext()
  - runAction(type, params, options)
  - showRunId(runId)
  - clearRunResult()
  - closeRunResult()
  - isRunResultOpen

// From @/lib/hooks/QueryContextAdapter
useRecceQueryContext()
  - setSqlQuery(query)
  - setPrimaryKeys(keys)
  - primaryKeys

// From @/lib/hooks/ApiConfigContext
useApiConfig()
  - apiClient: AxiosInstance

// From @/lib/hooks/useAppRouter
useAppLocation()
  - setLocation(path)
```

### Tracking Functions (OSS-Specific)

```typescript
// From @/lib/api/track
trackExploreAction({ action, source, node_count })
trackLineageSelection({ action })
trackMultiNodesAction({ type, selected })
trackLineageViewRender({ ... })
trackCopyToClipboard({ type, from })
trackPreviewChange({ action, node, status })
trackPreviewChangeFeedback({ feedback, node })
trackSingleEnvironment({ action, from, node })
```

### Run Registry Dependency

```typescript
// From @/components/run/registry
findByRunType(type: string) => { icon: ComponentType, title: string }
```

This function provides icons and titles for run types. Used extensively in:
- `GraphNode.tsx`
- `LineageViewContextMenu.tsx`
- `LineageViewTopBar.tsx`
- `NodeTag.tsx`
- `NodeView.tsx`

### OSS Component Dependencies

Components that are OSS-specific and used within lineage files:

| Component | Used In |
|-----------|---------|
| `SetupConnectionPopover` | `LineageViewContextMenu.tsx`, `LineageViewTopBar.tsx`, `NodeTag.tsx`, `NodeView.tsx` |
| `QueryForm` | `SandboxView.tsx` |
| `RunResultPane` | `SandboxView.tsx` |
| `SchemaView` / `SingleEnvSchemaView` | `NodeView.tsx` |
| `HistoryToggle` | `LineageViewTopBar.tsx` |
| `RecceNotification` | `NodeView.tsx` |

---

## Migration Strategy

### Phase 1: Migrate Utility Layer (lineage.ts)

**Priority**: High
**Effort**: 1-2 days

`lineage.ts` contains two key functions:
- `toReactFlow()` - Converts `LineageGraph` to React Flow nodes/edges
- `layout()` - Applies dagre layout algorithm

**Migration approach**:
1. Move `toReactFlow()` and `layout()` to `@datarecce/ui/utils`
2. These functions are already pure (no OSS dependencies)
3. Only depends on @datarecce/ui types and `@dagrejs/dagre`

**Files affected**: `LineageView.tsx` (update import path)

### Phase 2: Migrate useMultiNodesAction

**Priority**: High
**Effort**: 2-3 days

`useMultiNodesAction.ts` orchestrates batch operations across multiple nodes.

**Current OSS dependencies**:
- `useApiConfig` - Already uses `submitRun`, `waitRun`, `cancelRun` from @datarecce/ui/api
- `useRecceActionContext` - Only uses `showRunId()`
- Tracking functions - OSS-specific analytics

**Migration approach**:
1. Create abstract callback interface in @datarecce/ui:
   ```typescript
   interface MultiNodesActionCallbacks {
     onShowRunId?: (runId: string) => void;
     onTrackAction?: (action: string, source: string, nodeCount: number) => void;
   }
   ```
2. Move core logic to @datarecce/ui with callback injection
3. OSS wrapper provides tracking and context integration

### Phase 3: Migrate Context Menu

**Priority**: Medium
**Effort**: 3-4 days

`LineageViewContextMenu.tsx` is complex (639 lines) with heavy OSS integration.

**Current OSS dependencies**:
- `useRecceActionContext` - For `runAction()`
- `useRecceQueryContext` - For `setSqlQuery()`, `setPrimaryKeys()`
- `useAppLocation` - For navigation
- `findByRunType` - For icons/titles
- `SetupConnectionPopover` - For metadata-only mode
- Tracking functions

**Migration approach**:
1. Create abstract action handler interface:
   ```typescript
   interface ContextMenuActions {
     onQuery: (query: string, primaryKey?: string) => void;
     onRunAction: (type: string, params: object, options?: object) => void;
     onNavigate: (path: string) => void;
   }
   ```
2. Abstract icon registry pattern:
   ```typescript
   interface RunTypeRegistry {
     getIcon: (type: string) => ComponentType;
     getTitle: (type: string) => string;
   }
   ```
3. Move menu rendering to @datarecce/ui with injected handlers
4. OSS wrapper provides concrete implementations

### Phase 4: Migrate Remaining Controls

**Priority**: Medium
**Effort**: 3-4 days

**Files**:
- `ColumnLevelLineageControl.tsx` - CLL toggle and status display
- `LineageViewTopBar.tsx` - Filter controls and action menu
- `NodeTag.tsx` - Resource type and row count tags
- `NodeView.tsx` - Node detail sidebar

**Migration approach**:
1. Apply same adapter pattern as context menu
2. Extract common action interfaces
3. Move UI rendering to @datarecce/ui
4. OSS provides context and tracking

### Phase 5: Migrate LineageView Orchestrator

**Priority**: Low (after all dependencies migrated)
**Effort**: 5-7 days

`LineageView.tsx` (1385 lines) is the main orchestrator.

**Current state**:
- Already uses many @datarecce/ui types and components
- Provides `LineageViewContextType` to children
- Contains complex state management for:
  - View options (mode, packages, select/exclude)
  - Column-level lineage (CLL)
  - Node selection
  - Multi-node actions
  - Run result integration

**Migration approach**:
1. Wait until Phases 1-4 complete
2. Extract view state management to @datarecce/ui hook
3. Keep orchestration logic in OSS initially
4. Consider partial migration of rendering logic

---

## Test Requirements

### Existing Tests

| Test File | Coverage | Status |
|-----------|----------|--------|
| `lineage.test.ts` | `buildLineageGraph` | Tests @datarecce/ui function |
| `GraphNode.test.tsx` | GraphNode component | Tests OSS wrapper |
| `GraphEdge.test.tsx` | GraphEdge component | Tests OSS wrapper |
| `GraphColumnNode.test.tsx` | GraphColumnNode | Tests OSS wrapper |
| `NodeSqlView.test.tsx` | NodeSqlView | Tests OSS wrapper |
| `ActionControl.test.tsx` | ActionControl | Tests OSS wrapper |
| `LineageViewNotification.test.tsx` | Notification | Tests re-export |
| `useValueDiffAlertDialog.test.tsx` | Alert dialog | Tests tracking integration |
| `LineageView.test.tsx` | Main view | Integration test |

### Tests Needed

| Component | Test Type | Priority |
|-----------|-----------|----------|
| `toReactFlow()` | Unit test in @datarecce/ui | High |
| `layout()` | Unit test in @datarecce/ui | High |
| `useMultiNodesAction` | Hook test with mocks | High |
| `LineageViewContextMenu` | Component test | Medium |
| `ColumnLevelLineageControl` | Component test | Medium |
| `LineageViewTopBar` | Component test | Medium |

### Test Strategy

1. **Unit tests in @datarecce/ui**: Pure functions and presentation components
2. **Integration tests in OSS**: Wrapper components with mocked contexts
3. **E2E tests**: Critical user flows (unchanged)

---

## Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Comprehensive test coverage; gradual rollout |
| Type mismatches between packages | Medium | Strict TypeScript; shared type definitions |
| Context dependency leakage | Medium | Clear adapter interfaces; code review |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance regression | Medium | Benchmark before/after; profiling |
| Bundle size increase | Low | Tree-shaking; lazy loading |
| Developer confusion | Medium | Documentation; migration guide |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| CSS conflicts | Low | Scoped styles; CSS modules |
| Import path changes | Low | Automated codemods |

---

## Recommended Next Steps

### Immediate Actions (Week 1)

1. **Migrate `lineage.ts` functions** to `@datarecce/ui/utils`
   - Move `toReactFlow()` and `layout()`
   - Add unit tests
   - Update imports in `LineageView.tsx`

2. **Create abstract interfaces** in `@datarecce/ui/types`
   - `MultiNodesActionCallbacks`
   - `ContextMenuActions`
   - `RunTypeRegistry`

### Short-term (Weeks 2-3)

3. **Migrate `useMultiNodesAction`** with callback injection pattern

4. **Begin context menu migration**
   - Start with `ModelNodeContextMenu` subcomponent
   - Test with OSS wrapper

### Medium-term (Weeks 4-6)

5. **Complete control migrations**
   - `ColumnLevelLineageControl`
   - `LineageViewTopBar`
   - `NodeTag` (may stay in OSS due to heavy OSS component deps)

6. **Evaluate `NodeView` migration**
   - Complex due to `SchemaView`, `SandboxView` dependencies
   - May require additional component migrations first

### Long-term (Weeks 7+)

7. **Assess `LineageView` migration feasibility**
   - Depends on completion of previous phases
   - May benefit from partial migration approach

---

## Appendix: File Line Counts

```
Fully Migrated:
  LineageViewContext.tsx       21 lines
  ActionControl.tsx            53 lines
  GraphNode.tsx               445 lines
  GraphEdge.tsx                60 lines
  GraphColumnNode.tsx          98 lines
  NodeSqlView.tsx              40 lines
  LineageViewNotification.tsx   3 lines
  useValueDiffAlertDialog.tsx  37 lines
  lineage.test.ts             170 lines

Pending Migration:
  lineage.ts                  240 lines
  useMultiNodesAction.ts      360 lines
  LineageViewContextMenu.tsx  639 lines
  ColumnLevelLineageControl.tsx 328 lines
  SandboxView.tsx             442 lines
  LineageViewTopBar.tsx       602 lines
  LineageView.tsx            1385 lines
  NodeTag.tsx                 285 lines
  NodeView.tsx                645 lines

Stay in OSS:
  LineagePage.tsx              11 lines
  SetupConnectionBanner.tsx   ~50 lines
  ServerDisconnectedModalContent.tsx ~30 lines
  SingleEnvironmentQueryView.tsx ~100 lines

TOTAL: ~5,894 lines across all lineage files
```

---

*Last Updated: 2026-01-11*
*Author: Claude Code Migration Analysis*
