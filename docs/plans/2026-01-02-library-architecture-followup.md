# Library-First Architecture: Follow-Up Implementation Plan

**Date:** 2026-01-02
**Status:** In Progress
**Context:** This is a follow-up to `2026-01-02-library-first-component-architecture.md`

> **For Claude:** After context compaction, read this file to restore state. Use `superpowers:subagent-driven-development` to execute.

---

## Current State Summary

### What's Complete (DO NOT REDO)

1. **RecceProvider** - Full orchestration layer with feature flags
2. **Provider Contexts**: ApiContext, CheckContext, QueryContext, RoutingContext, ThemeContext
3. **Legacy Contexts**: LineageGraphProvider, RecceActionProvider, IdleTimeoutProvider, RecceInstanceInfoProvider
4. **Theme System**: colors.ts, theme.ts with CSS variables
5. **Entry Files**: index.ts, primitives.ts, advanced.ts exist
6. **Lineage Primitives**: LineageNode, LineageEdge (pure presentation)
7. **Lineage Composed**: LineageCanvas (React Flow wrapper)
8. **Lineage View**: LineageView (high-level, uses context)

### What's Missing (THE WORK TO DO)

#### File Structure Gaps
```
packages/ui/src/components/
├── views/           ← CREATE (for Layer 3 high-level views)
├── lineage/         ← EXISTS (needs more primitives)
├── check/           ← CREATE
├── query/           ← CREATE
├── run/             ← CREATE
├── data/            ← CREATE
├── schema/          ← CREATE
├── editor/          ← CREATE
└── ui/              ← CREATE
```

#### Missing Primitives by Group

| Group | Missing Components |
|-------|-------------------|
| lineage | LineageControls, ColumnLineage, NodeSelector |
| check | CheckList, CheckDetail, CheckCard, CheckEmptyState, CheckActions |
| query | QueryEditor, QueryResults, QueryDiffView |
| run | RunList, RunResultPane, RunProgress |
| data | DataGrid, DataGridDiff, HistogramChart, ProfileTable, TopKTable |
| schema | SchemaView, SchemaDiff, ColumnList |
| editor | SqlEditor, YamlEditor, DiffEditor |
| ui | SplitPane, Icons, ErrorBoundary, Toaster, LoadingSpinner |

#### Missing High-Level Views (Layer 3)
- ChecksView
- QueryView
- RunsView
- RecceLayout

---

## Implementation Strategy

### Recommended Approach: Subagent-Driven Development

**Why subagents work best here:**
1. Each component group is independent (no cross-dependencies during extraction)
2. Fresh context per task prevents confusion
3. Two-stage review (spec + quality) catches issues early
4. Can parallelize RESEARCH phases, serialize IMPLEMENTATION phases

### Execution Order (Critical Path)

```
Phase 2A: Remaining Lineage Primitives (3 components)
    ↓
Phase 2B: Check Primitives (5 components)
    ↓
Phase 2C: Query Primitives (3 components)
    ↓
Phase 2D: Run Primitives (3 components)
    ↓
Phase 2E: Data Primitives (5 components)
    ↓
Phase 2F: Schema Primitives (3 components)
    ↓
Phase 2G: Editor Primitives (3 components)
    ↓
Phase 2H: UI Primitives (5 components)
    ↓
Phase 3: High-Level Views (5 views)
    ↓
Phase 4: Export Structure Cleanup
```

---

## Detailed Task Breakdown

### Phase 2A: Remaining Lineage Primitives

**Task 2A.1: Analyze existing OSS lineage components**
- Location: `js/src/components/lineage/`
- Find: LineageControls equivalent, column lineage rendering, node selector
- Document: Props needed, dependencies, what to extract

**Task 2A.2: Extract LineageControls**
- Create: `packages/ui/src/components/lineage/controls/LineageControls.tsx`
- Pattern: Pure presentation, receives callbacks (onZoomIn, onZoomOut, onFitView, onToggleView)
- Export from: primitives.ts

**Task 2A.3: Extract ColumnLineage**
- Create: `packages/ui/src/components/lineage/columns/ColumnLineage.tsx`
- Pattern: Pure presentation for column-level lineage visualization
- Export from: primitives.ts

**Task 2A.4: Extract NodeSelector**
- Create: `packages/ui/src/components/lineage/selector/NodeSelector.tsx`
- Pattern: Pure presentation for model/node selection dropdown
- Export from: primitives.ts

**Task 2A.5: Update primitives.ts exports**
- Add all new lineage exports
- Verify types are exported

---

### Phase 2B: Check Primitives

**Task 2B.1: Analyze existing OSS check components**
- Location: `js/src/components/check/`
- Files to examine: CheckList, CheckDetail, CheckCard patterns
- Document: Data shapes, callbacks, styling patterns

**Task 2B.2: Create check directory structure**
- Create: `packages/ui/src/components/check/`
- Create: index.ts barrel export

**Task 2B.3: Extract CheckCard**
- Pure presentation for a single check summary
- Props: check data, onSelect, onDelete, isSelected

**Task 2B.4: Extract CheckList**
- Pure presentation for list of checks
- Props: checks array, onSelectCheck, onReorderChecks, selectedId

**Task 2B.5: Extract CheckDetail**
- Pure presentation for check detail view
- Props: check, runs, onUpdate, onDelete, onRunCheck

**Task 2B.6: Extract CheckEmptyState**
- Pure presentation for empty check list
- Props: onCreateFirst callback

**Task 2B.7: Extract CheckActions**
- Pure presentation for check action buttons
- Props: callbacks for run, edit, delete, duplicate

**Task 2B.8: Update primitives.ts with check exports**

---

### Phase 2C: Query Primitives

**Task 2C.1: Analyze existing OSS query components**
- Location: `js/src/components/query/`
- Document: SQL editor integration, results display patterns

**Task 2C.2: Create query directory structure**
- Create: `packages/ui/src/components/query/`

**Task 2C.3: Extract QueryEditor**
- Pure presentation wrapping CodeMirror
- Props: sql, onChange, onExecute, disabled

**Task 2C.4: Extract QueryResults**
- Pure presentation for query result table
- Props: columns, rows, isLoading, error

**Task 2C.5: Extract QueryDiffView**
- Pure presentation for side-by-side query diff
- Props: baseResult, currentResult

**Task 2C.6: Update primitives.ts with query exports**

---

### Phase 2D: Run Primitives

**Task 2D.1: Analyze existing OSS run components**
- Location: `js/src/components/run/`

**Task 2D.2: Create run directory structure**

**Task 2D.3: Extract RunList**
- Props: runs array, onSelectRun, selectedRunId

**Task 2D.4: Extract RunResultPane**
- Props: run, result data, display options

**Task 2D.5: Extract RunProgress**
- Props: status, progress percentage, cancelCallback

**Task 2D.6: Update primitives.ts with run exports**

---

### Phase 2E: Data Primitives

**Task 2E.1: Analyze existing OSS data components**
- Location: `js/src/components/data-grid/`, profile components

**Task 2E.2: Create data directory structure**

**Task 2E.3: Extract DataGrid**
- AG Grid wrapper, pure presentation
- Props: columns, rows, onCellClick, options

**Task 2E.4: Extract DataGridDiff**
- Side-by-side data comparison
- Props: baseData, currentData, diffConfig

**Task 2E.5: Extract HistogramChart**
- Chart.js histogram wrapper
- Props: data, options, height

**Task 2E.6: Extract ProfileTable**
- Data profiling results display
- Props: profileData, columns

**Task 2E.7: Extract TopKTable**
- Top-K values display
- Props: data, k, column

**Task 2E.8: Update primitives.ts with data exports**

---

### Phase 2F: Schema Primitives

**Task 2F.1: Analyze existing OSS schema components**

**Task 2F.2: Create schema directory structure**

**Task 2F.3: Extract SchemaView**
- Props: schema, columns, onColumnSelect

**Task 2F.4: Extract SchemaDiff**
- Props: baseSchema, currentSchema

**Task 2F.5: Extract ColumnList**
- Props: columns, selectedColumn, onSelect

**Task 2F.6: Update primitives.ts with schema exports**

---

### Phase 2G: Editor Primitives

**Task 2G.1: Analyze existing OSS editor components**
- CodeMirror integrations

**Task 2G.2: Create editor directory structure**

**Task 2G.3: Extract SqlEditor**
- CodeMirror with SQL syntax
- Props: value, onChange, readOnly, theme

**Task 2G.4: Extract YamlEditor**
- CodeMirror with YAML syntax
- Props: value, onChange, readOnly

**Task 2G.5: Extract DiffEditor**
- Side-by-side diff view
- Props: original, modified, language

**Task 2G.6: Update primitives.ts with editor exports**

---

### Phase 2H: UI Primitives

**Task 2H.1: Analyze existing OSS ui components**
- Location: `js/src/components/ui/`

**Task 2H.2: Create ui directory structure**

**Task 2H.3: Extract SplitPane**
- Resizable split container
- Props: direction, sizes, onResize

**Task 2H.4: Extract Icons**
- Icon components used throughout
- Export as named exports

**Task 2H.5: Extract ErrorBoundary**
- React error boundary with fallback UI
- Props: fallback, onError

**Task 2H.6: Extract Toaster**
- Toast notification system
- Props: toasts, onDismiss

**Task 2H.7: Extract LoadingSpinner**
- Loading indicator
- Props: size, message

**Task 2H.8: Update primitives.ts with ui exports**

---

### Phase 3: High-Level Views

**Task 3.1: Create views directory**
- Create: `packages/ui/src/components/views/`
- Create: index.ts

**Task 3.2: Create ChecksView**
- Composes: CheckList + CheckDetail
- Uses: useCheckContext
- Props: minimal (most from context)

**Task 3.3: Create QueryView**
- Composes: QueryEditor + QueryResults
- Uses: useQueryContext
- Props: minimal

**Task 3.4: Create RunsView**
- Composes: RunList + RunResultPane
- Uses: context for runs data
- Props: minimal

**Task 3.5: Create RecceLayout**
- Shell component: NavBar + TopBar + content area
- Props: children, navItems, topBarConfig

**Task 3.6: Update components/index.ts**
- Export all Layer 3 views

**Task 3.7: Update main index.ts**
- Ensure Layer 3 views exported from @datarecce/ui

---

### Phase 4: Export Structure Cleanup

**Task 4.1: Audit primitives.ts**
- Ensure all ~40 primitives exported
- Types exported correctly
- Version bump

**Task 4.2: Populate advanced.ts**
- Add internal/unstable exports
- Document what qualifies as "advanced"

**Task 4.3: Verify main index.ts**
- Layer 3 views + Layer 1 foundation
- No primitives (those go in primitives.ts)

**Task 4.4: Create types/index.ts**
- Public TypeScript types barrel export

**Task 4.5: Final verification**
- Type check passes
- Build succeeds
- All exports accessible

---

## Execution Recommendations

### Best Approach: Session-Scoped Execution (RECOMMENDED)

Pure subagent-driven doesn't work optimally because research context is lost between tasks. Instead, use **5 focused sessions**, each handling 2 related phases:

```
SESSION 1: Phase 2A (Lineage) + Phase 2B (Check) - 13 tasks
    Core components, high value

SESSION 2: Phase 2C (Query) + Phase 2D (Run) - 12 tasks
    Execution-focused components

SESSION 3: Phase 2E (Data) + Phase 2F (Schema) - 14 tasks
    Data display (most complex: AG Grid)

SESSION 4: Phase 2G (Editor) + Phase 2H (UI) - 14 tasks
    CodeMirror wrappers + utilities

SESSION 5: Phase 3 (Views) + Phase 4 (Cleanup) - 12 tasks
    Composition + final verification
```

### Within Each Session, Follow This Pattern:

```
1. Read this plan file (restore context)
2. Create TodoWrite with tasks for session's phases
3. For research tasks (X.1):
   - Use Explore agent for deep codebase analysis
   - Save findings in TodoWrite or comment
4. For extraction tasks (X.2, X.3, etc.):
   - Implement in main context (has research)
   - After EACH component: pnpm tsc --noEmit && pnpm biome check
   - Commit after each component (small commits)
5. Export update (last task of phase):
   - Update primitives.ts
   - Verify exports
6. Phase checkpoint:
   - Full type check + lint
   - Commit: "feat(ui): complete Phase 2X - [group] primitives"
```

### When to Use Agents

| Task Type | Tool | Why |
|-----------|------|-----|
| Deep research (X.1) | `Task` with `Explore` agent | Fast codebase search |
| Component extraction | Main context | Needs research context |
| Code review | `Task` with `code-reviewer` agent | Fresh perspective |
| Export updates | Main context | Quick, needs awareness |
| Verification | Main context | Full picture needed |

### Quality Gates (MANDATORY)

**After EVERY component:**
```bash
cd js/packages/ui && pnpm tsc --noEmit   # Type check
cd js && pnpm biome check packages/ui    # Lint
```

**After EVERY phase:**
```bash
pnpm test                                 # Run tests
git add . && git commit -s -m "..."      # Checkpoint commit
```

**Before marking session complete:**
```bash
# Verify exports are accessible
echo "import { ComponentName } from './src/primitives'" > test-import.ts
pnpm tsc test-import.ts --noEmit
rm test-import.ts
```

### Parallelization (If Using Multiple Sessions)

**CAN parallelize (different worktrees):**
- Session 1 and Session 2 (no shared components)
- Session 3 and Session 4 (no shared components)

**CANNOT parallelize:**
- Session 5 depends on ALL previous sessions
- Any sessions modifying primitives.ts simultaneously

---

## Session Execution Instructions

### SESSION 1: Lineage + Check (Start Here)

**Pre-requisites:** None (first session)

**Tasks:**
- 2A.1 through 2A.5 (Lineage primitives)
- 2B.1 through 2B.8 (Check primitives)

**Expected Output:**
- `components/lineage/controls/LineageControls.tsx`
- `components/lineage/columns/ColumnLineage.tsx`
- `components/lineage/selector/NodeSelector.tsx`
- `components/check/CheckCard.tsx`
- `components/check/CheckList.tsx`
- `components/check/CheckDetail.tsx`
- `components/check/CheckEmptyState.tsx`
- `components/check/CheckActions.tsx`
- Updated `primitives.ts`

**Commit message:** `feat(ui): add lineage and check primitives`

---

### SESSION 2: Query + Run

**Pre-requisites:** Session 1 complete

**Tasks:**
- 2C.1 through 2C.6 (Query primitives)
- 2D.1 through 2D.6 (Run primitives)

**Expected Output:**
- `components/query/QueryEditor.tsx`
- `components/query/QueryResults.tsx`
- `components/query/QueryDiffView.tsx`
- `components/run/RunList.tsx`
- `components/run/RunResultPane.tsx`
- `components/run/RunProgress.tsx`
- Updated `primitives.ts`

---

### SESSION 3: Data + Schema

**Pre-requisites:** Sessions 1-2 complete

**Tasks:**
- 2E.1 through 2E.8 (Data primitives)
- 2F.1 through 2F.6 (Schema primitives)

**Expected Output:**
- `components/data/DataGrid.tsx`
- `components/data/DataGridDiff.tsx`
- `components/data/HistogramChart.tsx`
- `components/data/ProfileTable.tsx`
- `components/data/TopKTable.tsx`
- `components/schema/SchemaView.tsx`
- `components/schema/SchemaDiff.tsx`
- `components/schema/ColumnList.tsx`

---

### SESSION 4: Editor + UI

**Pre-requisites:** Sessions 1-3 complete

**Tasks:**
- 2G.1 through 2G.6 (Editor primitives)
- 2H.1 through 2H.8 (UI primitives)

**Expected Output:**
- `components/editor/SqlEditor.tsx`
- `components/editor/YamlEditor.tsx`
- `components/editor/DiffEditor.tsx`
- `components/ui/SplitPane.tsx`
- `components/ui/Icons.tsx`
- `components/ui/ErrorBoundary.tsx`
- `components/ui/Toaster.tsx`
- `components/ui/LoadingSpinner.tsx`

---

### SESSION 5: Views + Cleanup

**Pre-requisites:** ALL previous sessions complete

**Tasks:**
- 3.1 through 3.7 (High-level views)
- 4.1 through 4.5 (Export cleanup)

**Expected Output:**
- `components/views/ChecksView.tsx`
- `components/views/QueryView.tsx`
- `components/views/RunsView.tsx`
- `components/views/RecceLayout.tsx`
- Finalized `primitives.ts`, `advanced.ts`, `index.ts`

---

## Next Action After Reading This

1. Start SESSION 1
2. Create TodoWrite with Phase 2A + 2B tasks
3. Begin with Task 2A.1: Research lineage components
4. Follow the session pattern above

---

## Files to Reference

- Original plan: `docs/plans/2026-01-02-library-first-component-architecture.md`
- OSS components: `js/src/components/` (source for extraction)
- Target package: `js/packages/ui/src/`
- Current primitives: `js/packages/ui/src/primitives.ts`
- Current index: `js/packages/ui/src/index.ts`
