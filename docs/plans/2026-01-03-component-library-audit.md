# Component Library Audit - @datarecce/ui

**Date:** 2026-01-03
**Status:** In Progress
**Goal:** Migrate shareable/reusable components from js/src to packages/ui

## Context & Drivers

1. **Primary:** Internal reuse between recce-cloud-infra and Recce OSS
2. **Secondary:** Code quality - cleaner separation, easier testing, reduced duplication
3. **Tertiary:** External consumers (future possibility)

## Approach

### Phase 1: Audit packages/ui (current state)
- Document what components exist
- Identify their purpose and completeness
- Note gaps vs. what Recce OSS has locally

### Phase 2: Comprehensive audit of js/src/components
- Map the entire component landscape
- Categorize by reusability potential
- Identify Recce-specific vs. generic logic

### Phase 3: Recommendations
- Prioritized list of migration candidates
- Refactoring suggestions for complex components
- Phased implementation plan

---

## Phase 1: packages/ui Audit

### Directory Structure
```
packages/ui/src/components/
├── check/       - Check-related components
├── data/        - Data display components
├── editor/      - Code editor components
├── lineage/     - Lineage graph components
├── query/       - Query-related components
├── run/         - Run execution components
├── schema/      - Schema display components
├── ui/          - Generic UI primitives
└── views/       - High-level view compositions
```

### Component Details

#### check/ (7 files) - **Completeness: HIGH, Reusability: HIGH**
| Component | Purpose | Recce-Specific |
|-----------|---------|----------------|
| CheckActions | Action button/menu with primary/secondary actions | Low |
| CheckCard | Check item display with type icon, status, approval | Low |
| CheckDescription | Editable description with click-to-edit | None |
| CheckDetail | Full check view with tabs, description, actions | Low |
| CheckEmptyState | Empty state placeholder | None |
| CheckList | Scrollable list of CheckCard items | None |

#### data/ (3 files) - **Completeness: HIGH, Reusability: HIGH**
| Component | Purpose | Recce-Specific |
|-----------|---------|----------------|
| HistogramChart | Chart.js histogram with base/current comparison | Low |
| ProfileTable | AG Grid column statistics with diff coloring | Low |
| TopKBarChart | Horizontal bar chart for top-K distributions | Low |

#### editor/ (1 file) - **Completeness: HIGH, Reusability: HIGH**
| Component | Purpose | Recce-Specific |
|-----------|---------|----------------|
| DiffEditor | CodeMirror merge view for text diffs | None |

#### lineage/ (6+ files) - **Completeness: HIGH, Reusability: HIGH**
| Component | Purpose | Recce-Specific |
|-----------|---------|----------------|
| LineageView | High-level wrapper with filtering, layout | Medium |
| LineageCanvas | React Flow canvas with nodes/edges | Low |
| LineageNode | Individual node with type badge, status | Low |
| LineageEdge | Edge with color-coded status | Low |
| LineageControls | Graph controls | Low |
| LineageLegend | Status legend | Low |

#### query/ (3 files) - **Completeness: HIGH, Reusability: HIGH**
| Component | Purpose | Recce-Specific |
|-----------|---------|----------------|
| QueryDiffView | AG Grid table for row-level diffs | Low |
| QueryEditor | CodeMirror SQL editor with toolbar | None |
| QueryResults | AG Grid for query results | None |

#### run/ (3 files) - **Completeness: HIGH, Reusability: HIGH**
| Component | Purpose | Recce-Specific |
|-----------|---------|----------------|
| RunList | List with date grouping, status badges | Low |
| RunProgress | Progress indicator (spinner/linear/circular) | None |
| RunStatusBadge | Status indicator with color coding | None |

#### schema/ (2 files) - **Completeness: HIGH, Reusability: HIGH**
| Component | Purpose | Recce-Specific |
|-----------|---------|----------------|
| SchemaDiff | AG Grid comparing base vs current schema | Low |
| SchemaTable | Simple schema table for single environment | None |

#### ui/ (3 files) - **Completeness: HIGH, Reusability: HIGH**
| Component | Purpose | Recce-Specific |
|-----------|---------|----------------|
| EmptyState | Centered empty state with icon, actions | None |
| SplitPane | Resizable split panes wrapper | None |
| StatusBadge | Generic status indicator (7 types) | None |

#### views/ (4 files) - **Completeness: HIGH, Reusability: MEDIUM**
| Component | Purpose | Recce-Specific |
|-----------|---------|----------------|
| ChecksView | Split-pane combining CheckList + CheckDetail | Medium |
| QueryView | Query execution view | Medium |
| RunsView | Runs management view | Medium |
| RecceLayout | Application layout wrapper | Medium |

### External Dependencies
- **AG Grid Community**: Data tables
- **React Flow (@xyflow/react)**: Lineage graph
- **CodeMirror 6**: SQL/YAML editing and diffing
- **Chart.js**: Histogram/bar charts
- **Material-UI**: All UI components, theming
- **react-split**: Resizable panes

### Architecture Pattern
Three-layer structure:
1. **Presentational primitives** (CheckCard, LineageNode, StatusBadge)
2. **Composite components** (CheckDetail, QueryDiffView, ProfileTable)
3. **High-level views** (ChecksView, LineageView, QueryView)

### Assessment Summary
- **~30 component files** - all fully implemented, no placeholders
- **Production ready** - mature, well-architected library
- **Pure presentation** - no API calls or business logic in components
- **Themeable** - dark/light theme support throughout

---

## Phase 2: js/src/components Audit

### Goal
Identify components in Recce OSS that:
1. Are NOT yet in packages/ui
2. Could be migrated (high reusability)
3. Need refactoring to separate generic vs. Recce-specific logic

### Directories Analyzed (18 not in packages/ui)

| Directory | Files | Reusability | Recce Logic | Action |
|-----------|-------|-------------|-------------|--------|
| **screenshot/** | 1 | HIGH | None | Migrate |
| **split/** | 1 | HIGH | None | Migrate |
| **icons/** | 1+ | HIGH | None | Migrate |
| **rowcount/** | 2 | HIGH | Low | Migrate |
| **data-grid/** | 2 | HIGH | Medium | Migrate-then-refactor |
| **charts/** | 4 | HIGH | Low | Migrate |
| **valuediff/** | 3 | HIGH | Medium | Migrate |
| **histogram/** | 2 | MEDIUM | Medium | Migrate |
| **profile/** | 2 | MEDIUM | Medium | Migrate-then-refactor |
| **top-k/** | 2 | MEDIUM | Medium | Migrate |
| **errorboundary/** | 1 | MEDIUM | Low | Migrate-then-refactor |
| **summary/** | 3 | MEDIUM | High | Keep-in-OSS |
| **app/** | 8 | LOW | High | Keep-in-OSS |
| **routing/** | 3 | LOW | High | Keep-in-OSS |
| **shared/** | 1 | LOW | High | Keep-in-OSS |
| **timeout/** | 1 | LOW | High | Keep-in-OSS |
| **onboarding-guide/** | 1 | LOW | High | Keep-in-OSS |
| **AuthModal/** | 1 | LOW | High | Keep-in-OSS |

### Key Finding: ResultView Pattern

Ten components follow an **identical structural pattern**:

| Component | Type | Tests | Factory Status | Notes |
|-----------|------|-------|----------------|-------|
| `RowCountDiffResultView` | Grid | ✅ | ✅ Migrated | Simplest |
| `RowCountResultView` | Grid | ✅ | ✅ Migrated | Shares with above |
| `ValueDiffResultView` | Grid | ✅ | ✅ Migrated | Grid + header |
| `HistogramDiffResultView` | Chart | ✅ | ✅ Migrated | Chart-based |
| `ProfileDiffResultView` | Grid | ✅ | ✅ Migrated | Grid + toolbar |
| `ProfileResultView` | Grid | ✅ | ✅ Migrated | Shares with above |
| `TopKDiffResultView` | Chart | ✅ | ❌ Deferred | Has local useState |
| `ValueDiffDetailResultView` | Grid | ✅ | ✅ Migrated | Uses toolbar-in-empty-state pattern |
| `QueryResultView` | Grid | ✅ | ✅ Migrated | Uses amber warning styling |
| `QueryDiffResultView` | Grid | ✅ | ❌ Deferred | Bifurcation logic |

**Common Pattern:**
```typescript
1. Type-guard check (isXyzRun)
2. Extract params/result from run
3. Render data with optional toolbar
4. Use forwardRef for screenshot capture
5. Implement RunResultViewProps<T> generic interface
```

**Implemented:** `createResultView` factory in `packages/ui/src/components/result/`

**Current Factory Capabilities:**
- ✅ Type guard validation
- ✅ Grid and box screenshot wrappers
- ✅ Header/footer slots
- ✅ Empty state + conditional empty state
- ✅ View options (generic)
- ✅ Toolbar slot (ReactNode)
- ✅ Warnings array (string[])
- ✅ onAddToChecklist callback
- ✅ Toolbar-in-empty-state (emptyMessage + toolbar renders together)
- ✅ Custom warning styling (warningStyle: 'alert' | 'amber')

**Remaining Gaps:**
- ❌ Local useState support (TopKDiffResultView needs this)

**See:** [Factory Toolbar Extension Plan](./2026-01-03-factory-toolbar-extension.md)

### Pure Utilities (Easy Wins)
| File | Purpose | Action |
|------|---------|--------|
| `rowcount/delta.ts` | `deltaPercentageString()` | Migrate |
| `valuediff/shared.ts` | `columnPrecisionSelectOptions()` | Migrate |
| `data-grid/agGridTheme.ts` | Grid theme definitions | Migrate |
| `charts/chartTheme.ts` | Chart theme definitions | Migrate |

### Missing from packages/ui (Critical)
1. **ScreenshotDataGrid** - AG Grid wrapper with screenshot capture
2. **ScreenshotBox** - Wrapper for rendering to image
3. **Data grid factory** (`createDataGrid`)
4. **Chart components** - Enhanced versions in src/

---

## Phase 3: Recommendations

### Proposed Migration Roadmap

#### Phase A: Pure Utilities & Infrastructure (Lowest Risk)
**Effort: ~1-2 days | Risk: Low**

| Item | Source | Target | Notes |
|------|--------|--------|-------|
| delta utilities | `rowcount/delta.ts` | `packages/ui/src/utils/` | Pure calculation |
| precision utilities | `valuediff/shared.ts` | `packages/ui/src/utils/` | Pure config builder |
| SVG icons | `icons/index.tsx` | `packages/ui/src/components/icons/` | No dependencies |
| Split panes | `split/Split.tsx` | `packages/ui/src/components/ui/` | Already have SplitPane |
| ScreenshotBox | `screenshot/ScreenshotBox.tsx` | `packages/ui/src/components/ui/` | Pure wrapper |

#### Phase B: Data Grid & Visualization (Core Features)
**Effort: ~3-5 days | Risk: Medium**

| Item | Source | Target | Notes |
|------|--------|--------|-------|
| ScreenshotDataGrid | `data-grid/ScreenshotDataGrid.tsx` | `packages/ui/src/components/data/` | Refactor theme handling |
| AG Grid theme | `data-grid/agGridTheme.ts` | `packages/ui/src/theme/` | Integrate with theme system |
| Chart components | `charts/*.tsx` | `packages/ui/src/components/data/` | Merge with existing |

#### Phase C: ResultView Abstraction (Complex)
**Effort: ~5-10 days | Risk: Medium-High**

1. **Design ResultView abstraction** - Generic HOC/factory in packages/ui
2. **Migrate simplest first**: rowcount → histogram → top-k
3. **Migrate complex**: valuediff → profile (most complex)

#### Phase D: Cleanup (Secondary)
**Effort: ~2-3 days | Risk: Low**

| Item | Source | Target | Notes |
|------|--------|--------|-------|
| ErrorBoundary | `errorboundary/` | `packages/ui/src/components/ui/` | Make Sentry optional |

### Keep in Recce OSS (Do Not Migrate)
- `app/` - State management, cloud sync
- `routing/` - URL patterns
- `AuthModal/` - Authentication
- `timeout/` - Session management
- `onboarding-guide/` - Feature toggles
- `shared/` - HistoryToggle
- `summary/` - Aggregation views

### Success Criteria
1. Recce OSS imports from `@datarecce/ui` instead of local copies
2. `recce-cloud-infra` can use same components
3. No duplicate implementations
4. Clean separation of generic vs. Recce-specific logic

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-03 | Start with packages/ui audit | Need to understand current state before identifying gaps |
| 2026-01-03 | Document in markdown file | Preserve context across auto-compaction events |
| 2026-01-03 | Implement createResultView factory | Reduce boilerplate, ensure consistency across ResultView components |
| 2026-01-03 | Add toolbar slot to factory | Support complex components with DiffDisplayModeSwitch, ChangedOnlyCheckbox |
| 2026-01-03 | Add warnings array to factory | Consistent warning display, consumer provides messages |
| 2026-01-03 | Add onAddToChecklist callback | Support QueryResultView "Add to Checklist" button |
| 2026-01-03 | Defer QueryDiffResultView | Bifurcation logic (two internal components) too complex for factory |
| 2026-01-03 | Defer TopKDiffResultView | Local useState pattern needs factory extension |
| 2026-01-03 | Tests required before migration | All ResultView components now have baseline tests |
| 2026-01-03 | Factory toolbar extension complete | Added toolbar slot, warnings array, onAddToChecklist callback with 10 new tests |
| 2026-01-03 | Defer ValueDiffDetailResultView | Shows toolbar in "No change" empty state - factory doesn't support toolbar-in-empty-state |
| 2026-01-03 | Defer QueryResultView | Uses custom amber background for warnings - different from factory's MUI Alert |
| 2026-01-03 | Add toolbar-in-empty-state to factory | Added emptyMessage to ResultViewData, factory renders toolbar above emptyMessage when isEmpty + toolbar/warnings present. 6 new tests added. |
| 2026-01-03 | Add custom warning styling to factory | Added warningStyle: 'alert' \| 'amber' to ResultViewData, amber style uses PiWarning icon with amber colors. 6 new tests added. |
| 2026-01-03 | Add defaultColumnOptions to factory | Added defaultColumnOptions (resizable, maxWidth, minWidth) and noRowsMessage to ResultViewData. 2 new tests added (54 total). |
| 2026-01-03 | Migrate QueryResultView | Successfully migrated to createResultView factory. Uses combined type guard (isQueryRun \|\| isQueryBaseRun), amber warnings, onAddToChecklist button. 21/21 tests pass. |
| 2026-01-03 | Migrate ValueDiffDetailResultView | Successfully migrated to createResultView factory. Uses toolbar-in-empty-state pattern for "No change" state, amber warnings, noRowsMessage. 28/28 tests pass. |
