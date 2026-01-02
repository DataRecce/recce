# Library-First Component Architecture

**Date:** 2026-01-02
**Status:** Approved
**Authors:** Jared Scott, Claude

## Executive Summary

This document describes the architecture for rearchitecting Recce OSS's frontend from an application-centric design to a composable component library. The goal is to decouple presentation logic from business logic, enabling `@datarecce/ui` to be consumed as a true library by recce-cloud-infra and other consumers.

**Current state:** Recce OSS is a Next.js application where components tightly couple data fetching, state management, and rendering. The existing `packages/ui` has established props-driven contexts but lacks extracted presentation components.

**Target state:** A three-layer architecture where high-level views compose primitives, primitives are pure functions of props, and a foundation layer handles data orchestration through `RecceProvider`.

---

## Problem Statement

### Current Architecture Issues

1. **Components mix concerns:** A typical component like `CheckDetail` does data fetching (useQuery), mutations (useMutation), local state, and rendering all in one file.

2. **Context providers fetch internally:** The original `LineageGraphContextProvider` (500+ lines) manages WebSocket connections, renders MUI dialogs, and handles toasts - not just state.

3. **No clean extraction path:** Components can't be used outside the OSS app without bringing the entire application context.

4. **125 component files** across 25 directories need consideration, with largest groups being lineage (28), ui (17), check (14), query (9), run (9).

### What Phase 1 Established (Keep This)

The existing `packages/ui` work created the right foundation:
- Props-driven `LineageGraphProvider` that accepts data and callbacks (no internal fetching)
- Theme system with CSS variables
- Utility functions for lineage graph manipulation
- Type definitions

---

## Architecture Design

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: HIGH-LEVEL COMPONENTS (Composable Views)          │
│  LineageView, ChecksView, QueryView, RunsView               │
│  → Self-contained, props-driven, ready to drop in           │
└─────────────────────────────────────────────────────────────┘
                              ↓ uses
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: PRIMITIVES (Building Blocks)                       │
│  LineageNode, LineageEdge, CheckList, CheckDetail,          │
│  DataGrid, SqlEditor, HistogramChart, ProfileTable          │
│  → Individual components for custom composition             │
└─────────────────────────────────────────────────────────────┘
                              ↓ uses
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: FOUNDATION (Contexts, Hooks, Theme, Types)         │
│  RecceProvider, useLineageGraph, useChecks, theme, colors   │
│  → Props-driven contexts and data orchestration             │
└─────────────────────────────────────────────────────────────┘
```

### Separation Pattern: Container/Presenter

Components are split into presentation-only primitives and context-aware views:

```tsx
// Layer 2: Pure presentation (no fetching, no mutations)
function CheckDetailView({ check, isLoading, onUpdate, onDelete }) {
  // Only rendering logic
  return <div>...</div>;
}

// Layer 3: High-level with context
function ChecksView({ checkId }) {
  const { check, isLoading } = useCheckContext();
  const { updateCheck } = useCheckActions();
  return <CheckDetailView check={check} isLoading={isLoading} onUpdate={updateCheck} />;
}
```

**Key principle:** Primitives (Layer 2) are pure functions of props. They receive data and callbacks, never fetch. High-level components (Layer 3) wire up providers to primitives.

---

## Component Groupings

### Layer 2 - Primitives (`@datarecce/ui/primitives`)

| Group | Components | Files |
|-------|------------|-------|
| **lineage** | LineageNode, LineageEdge, LineageControls, ColumnLineage, NodeSelector | 28 |
| **check** | CheckList, CheckDetail, CheckCard, CheckEmptyState, CheckActions | 14 |
| **query** | QueryEditor, QueryResults, QueryDiffView | 9 |
| **run** | RunList, RunResultPane, RunProgress | 9 |
| **data** | DataGrid, DataGridDiff, HistogramChart, ProfileTable, TopKTable | 11 |
| **schema** | SchemaView, SchemaDiff, ColumnList | 4 |
| **editor** | SqlEditor, YamlEditor, DiffEditor | 3 |
| **ui** | Split panels, Icons, ErrorBoundary, Toaster | ~20 |

### Layer 3 - High-Level Views (`@datarecce/ui`)

| Component | Description |
|-----------|-------------|
| `LineageView` | Complete lineage graph with interactions, column-level lineage |
| `ChecksView` | Check list + detail panel with drag-reorder |
| `QueryView` | SQL editor with execution and results |
| `RunsView` | Run history and result display |
| `RecceLayout` | NavBar + TopBar + content area (the shell) |

### Export Structure

```ts
import { LineageView, ChecksView } from '@datarecce/ui';           // Layer 3
import { LineageNode, CheckList } from '@datarecce/ui/primitives'; // Layer 2
import { useLineageGraph, theme } from '@datarecce/ui';            // Layer 1
```

---

## RecceProvider API

Single entry point that orchestrates all contexts:

```tsx
<RecceProvider
  // Required: API configuration
  api={{
    baseUrl: '/api/v2/sessions/abc123',
    authToken: 'eyJ...',
  }}
  // OR bring your own client
  api={{ client: customAxiosInstance }}

  // Optional: Theme
  theme="system" // 'light' | 'dark' | 'system'

  // Optional: Routing integration
  routing={{
    basePath: '/oss',
    navigate: nextRouter.push,
    useLocation: () => nextRouter.asPath,
  }}

  // Optional: Feature flags
  features={{
    enableExport: true,
    enableImport: false,
    enableWebSocket: false,
  }}

  // Optional: Action overrides (escape hatches)
  actions={{
    onShowHistory: () => openCustomHistoryModal(),
  }}
>
  <YourApp />
</RecceProvider>
```

**Internal contexts set up by RecceProvider:**
- `ApiContext` - Configured axios client
- `LineageGraphContext` - Fetches and holds lineage data
- `CheckContext` - Check list and mutations
- `QueryContext` - Query execution state
- `RunContext` - Run history
- `ThemeContext` - MUI theme with CSS variables
- `RoutingContext` - Navigation abstraction

---

## Target File Structure

```
packages/ui/src/
├── index.ts                    # Main exports (Layer 3 + Layer 1)
├── primitives.ts               # Layer 2 exports
├── advanced.ts                 # Unstable/internal exports
│
├── providers/
│   ├── RecceProvider.tsx       # Single entry provider
│   ├── contexts/               # Internal props-driven contexts
│   │   ├── ApiContext.tsx
│   │   ├── LineageContext.tsx
│   │   ├── CheckContext.tsx
│   │   ├── QueryContext.tsx
│   │   ├── RunContext.tsx
│   │   └── RoutingContext.tsx
│   └── hooks/                  # Data fetching orchestration
│       ├── useLineageData.ts
│       ├── useChecksData.ts
│       └── ...
│
├── components/
│   ├── views/                  # Layer 3 - High-level
│   │   ├── LineageView.tsx
│   │   ├── ChecksView.tsx
│   │   ├── QueryView.tsx
│   │   ├── RunsView.tsx
│   │   └── RecceLayout.tsx
│   │
│   ├── lineage/                # Layer 2 - Primitives
│   ├── check/
│   ├── query/
│   ├── run/
│   ├── data/
│   ├── schema/
│   ├── editor/
│   └── ui/
│
├── theme/
│   ├── theme.ts
│   ├── colors.ts
│   └── index.ts
│
├── hooks/                      # Public utility hooks
├── types/                      # Public TypeScript types
└── styles/
    └── globals.css
```

---

## Migration Strategy

### Phase 1: Foundation Completion

- ✅ Props-driven contexts (LineageGraphProvider, etc.)
- ✅ Theme system with CSS variables
- ⬜ Complete `RecceProvider` orchestration layer
- ⬜ API hooks that work with the provider

### Phase 2: Extract Primitives (Layer 2)

- Start with **lineage** (highest value, most complex - 28 files)
- Then **check** (14 files) → **query** (9) → **run** (9)
- Each primitive: remove data fetching, accept props, export from `@datarecce/ui/primitives`

### Phase 3: Build High-Level Views (Layer 3)

- Create `LineageView` that composes lineage primitives + uses contexts
- Create `ChecksView`, `QueryView`, `RunsView`
- Each view is self-contained when wrapped in `RecceProvider`

### Phase 4: OSS App Migration

- Update OSS app to consume from `packages/ui` instead of `src/components`
- Replace old contexts with `RecceProvider`
- Remove duplicated code from `src/components` as migration completes

**Key principle:** At every phase, the OSS app continues to work. We build the new path alongside the old, then switch over.

---

## Consumer Usage (recce-cloud-infra)

```tsx
import '@datarecce/ui/styles';
import { RecceProvider, LineageView, ChecksView } from '@datarecce/ui';
import { CheckList, DataGrid } from '@datarecce/ui/primitives';

function RecceSession({ sessionId }) {
  return (
    <RecceProvider
      api={{
        baseUrl: `/api/v2/sessions/${sessionId}`,
        authToken: getAuthToken(),
      }}
      theme="system"
      routing={{ basePath: `/oss/${sessionId}` }}
      features={{ enableWebSocket: false }}
    >
      <LineageView />
    </RecceProvider>
  );
}
```

---

## Success Criteria

1. **Clean separation:** Primitives have zero data fetching - only props and callbacks
2. **Single provider:** `RecceProvider` is the only setup required for consumers
3. **Flexible consumption:** Can use high-level views OR compose from primitives
4. **OSS dogfooding:** Recce OSS app consumes the same library
5. **Zero workarounds:** recce-cloud-infra needs no webpack aliases, no theme bridges
6. **Incremental migration:** OSS app works throughout the transition

---

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Keep Phase 1 work | Yes | Props-driven contexts are the right pattern |
| Layer count | 3 layers | Clear separation without over-engineering |
| Primitive export path | `@datarecce/ui/primitives` | Signals these are building blocks, not complete views |
| Migration order | lineage → check → query → run | Lineage is highest value; check is most used |
| Provider pattern | Single RecceProvider | Simple default, escape hatches via config |
