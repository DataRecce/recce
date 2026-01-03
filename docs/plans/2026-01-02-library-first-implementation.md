# Library-First Component Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rearchitect Recce OSS frontend into a composable three-layer component library (`@datarecce/ui`) that recce-cloud-infra can consume without workarounds.

**Architecture:** Three layers - Foundation (RecceProvider, contexts, hooks), Primitives (pure presentation components), and High-Level Views (self-contained composable views). All presentation components are props-driven with no internal data fetching.

**Tech Stack:** React 19, TypeScript 5.9, MUI 7, TanStack Query 5, React Flow 12, tsdown, pnpm workspaces

---

## Pre-Flight Checklist

Before starting ANY task:

```bash
# Verify you're in the worktree
pwd  # Should show: .worktrees/library-architecture

# Verify clean git state
git status  # Should show clean or only expected changes

# Verify packages are installed
cd js && pnpm install
```

---

## Phase 1: Fix Foundation Issues

### Task 1.1: Fix Jest Module Resolution for Workspace Package

**Problem:** Jest cannot resolve `@datarecce/ui` workspace package, causing 3 test suites to fail.

**Files:**
- Modify: `js/jest.config.mjs`
- Verify: `js/src/components/lineage/graph.ts:24` (the failing import)

**Step 1: Read current Jest config**

```bash
cat js/jest.config.mjs
```

**Step 2: Identify the import causing issues**

```bash
head -30 js/src/components/lineage/graph.ts
```

Expected: Line 24 imports from `@datarecce/ui`

**Step 3: Add moduleNameMapper to Jest config**

Add this to the Jest config to map `@datarecce/ui` to the packages/ui source:

```javascript
moduleNameMapper: {
  '^@datarecce/ui$': '<rootDir>/packages/ui/src/index.ts',
  '^@datarecce/ui/(.*)$': '<rootDir>/packages/ui/src/$1',
},
```

**Step 4: Run tests to verify fix**

```bash
cd js && pnpm test
```

Expected: All 30 test suites pass (911 tests)

**Step 5: Validate assumption - check that import actually works**

```bash
cd js && pnpm type:check
```

Expected: No type errors related to @datarecce/ui imports

**Step 6: Commit**

```bash
git add js/jest.config.mjs
git commit -s -m "fix(jest): add moduleNameMapper for @datarecce/ui workspace package"
```

---

### Task 1.2: Audit Current packages/ui Exports

**Purpose:** Understand what's already exported and what gaps exist before adding more.

**Files:**
- Read: `js/packages/ui/src/index.ts`
- Read: `js/packages/ui/src/contexts/index.ts`
- Read: `js/packages/ui/src/providers/index.ts`
- Create: `docs/plans/audit-packages-ui-exports.md` (temporary working doc)

**Step 1: Document current main exports**

```bash
cat js/packages/ui/src/index.ts
```

Record what's exported in each category:
- API utilities
- Components
- Contexts
- Hooks
- Providers
- Theme

**Step 2: Document current context structure**

```bash
find js/packages/ui/src/contexts -name "*.ts" -o -name "*.tsx" | head -20
```

```bash
cat js/packages/ui/src/contexts/index.ts
```

**Step 3: Document current provider structure**

```bash
find js/packages/ui/src/providers -name "*.ts" -o -name "*.tsx" | head -20
```

**Step 4: Compare with OSS contexts to identify gaps**

```bash
ls js/src/lib/hooks/*.tsx
```

Expected contexts in OSS that may need library versions:
- RecceCheckContext
- RecceQueryContext
- RecceShareStateContext

**Step 5: Validate assumption - verify packages/ui builds successfully**

```bash
cd js/packages/ui && pnpm build
```

Expected: Build completes with index.mjs, index.cjs, styles.css in dist/

**Step 6: Record findings (no commit - this is research)**

Create mental checklist of:
- [ ] What contexts exist in packages/ui
- [ ] What contexts are missing vs OSS
- [ ] What the RecceProvider currently does

---

### Task 1.3: Complete RecceProvider Orchestration

**Purpose:** Make RecceProvider the single entry point that sets up all required contexts.

**Files:**
- Modify: `js/packages/ui/src/providers/RecceProvider.tsx`
- Create: `js/packages/ui/src/providers/contexts/CheckContext.tsx`
- Create: `js/packages/ui/src/providers/contexts/QueryContext.tsx`
- Create: `js/packages/ui/src/providers/hooks/useLineageData.ts`
- Modify: `js/packages/ui/src/providers/index.ts`

**Step 1: Read current RecceProvider implementation**

```bash
cat js/packages/ui/src/providers/RecceProvider.tsx
```

**Step 2: Read OSS RecceContextProvider for reference**

```bash
cat js/src/lib/hooks/RecceContextProvider.tsx
```

Note: OSS nests 7 providers. Our library version will be props-driven.

**Step 3: Create CheckContext (props-driven)**

Create file `js/packages/ui/src/providers/contexts/CheckContext.tsx`:

```tsx
"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";

export interface Check {
  check_id: string;
  name: string;
  type: string;
  description?: string;
  is_checked?: boolean;
  // Add other fields as needed from OSS Check type
}

export interface CheckContextType {
  checks: Check[];
  isLoading: boolean;
  error?: string;
  selectedCheckId?: string;
  onSelectCheck?: (checkId: string) => void;
  onCreateCheck?: (check: Partial<Check>) => Promise<Check>;
  onUpdateCheck?: (checkId: string, updates: Partial<Check>) => Promise<Check>;
  onDeleteCheck?: (checkId: string) => Promise<void>;
  onReorderChecks?: (sourceIndex: number, destIndex: number) => Promise<void>;
  refetchChecks?: () => void;
}

const defaultContext: CheckContextType = {
  checks: [],
  isLoading: false,
};

const CheckContext = createContext<CheckContextType>(defaultContext);
CheckContext.displayName = "RecceCheckContext";

export interface CheckProviderProps {
  children: ReactNode;
  checks?: Check[];
  isLoading?: boolean;
  error?: string;
  selectedCheckId?: string;
  onSelectCheck?: (checkId: string) => void;
  onCreateCheck?: (check: Partial<Check>) => Promise<Check>;
  onUpdateCheck?: (checkId: string, updates: Partial<Check>) => Promise<Check>;
  onDeleteCheck?: (checkId: string) => Promise<void>;
  onReorderChecks?: (sourceIndex: number, destIndex: number) => Promise<void>;
  refetchChecks?: () => void;
}

export function CheckProvider({
  children,
  checks = [],
  isLoading = false,
  error,
  selectedCheckId,
  onSelectCheck,
  onCreateCheck,
  onUpdateCheck,
  onDeleteCheck,
  onReorderChecks,
  refetchChecks,
}: CheckProviderProps) {
  const contextValue = useMemo<CheckContextType>(
    () => ({
      checks,
      isLoading,
      error,
      selectedCheckId,
      onSelectCheck,
      onCreateCheck,
      onUpdateCheck,
      onDeleteCheck,
      onReorderChecks,
      refetchChecks,
    }),
    [
      checks,
      isLoading,
      error,
      selectedCheckId,
      onSelectCheck,
      onCreateCheck,
      onUpdateCheck,
      onDeleteCheck,
      onReorderChecks,
      refetchChecks,
    ],
  );

  return (
    <CheckContext.Provider value={contextValue}>
      {children}
    </CheckContext.Provider>
  );
}

export function useCheckContext(): CheckContextType {
  return useContext(CheckContext);
}
```

**Step 4: Validate - check file compiles**

```bash
cd js && pnpm type:check
```

Expected: No type errors

**Step 5: Create QueryContext (props-driven)**

Create file `js/packages/ui/src/providers/contexts/QueryContext.tsx`:

```tsx
"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react";

export interface QueryResult {
  columns: string[];
  data: Record<string, unknown>[];
  rowCount: number;
}

export interface QueryContextType {
  // Current query state
  sql: string;
  isExecuting: boolean;
  error?: string;

  // Results
  baseResult?: QueryResult;
  currentResult?: QueryResult;

  // Actions
  onSqlChange?: (sql: string) => void;
  onExecute?: (sql: string) => Promise<void>;
  onCancel?: () => void;
}

const defaultContext: QueryContextType = {
  sql: "",
  isExecuting: false,
};

const QueryContext = createContext<QueryContextType>(defaultContext);
QueryContext.displayName = "RecceQueryContext";

export interface QueryProviderProps {
  children: ReactNode;
  sql?: string;
  isExecuting?: boolean;
  error?: string;
  baseResult?: QueryResult;
  currentResult?: QueryResult;
  onSqlChange?: (sql: string) => void;
  onExecute?: (sql: string) => Promise<void>;
  onCancel?: () => void;
}

export function QueryProvider({
  children,
  sql = "",
  isExecuting = false,
  error,
  baseResult,
  currentResult,
  onSqlChange,
  onExecute,
  onCancel,
}: QueryProviderProps) {
  const contextValue = useMemo<QueryContextType>(
    () => ({
      sql,
      isExecuting,
      error,
      baseResult,
      currentResult,
      onSqlChange,
      onExecute,
      onCancel,
    }),
    [sql, isExecuting, error, baseResult, currentResult, onSqlChange, onExecute, onCancel],
  );

  return (
    <QueryContext.Provider value={contextValue}>
      {children}
    </QueryContext.Provider>
  );
}

export function useQueryContext(): QueryContextType {
  return useContext(QueryContext);
}
```

**Step 6: Validate - check file compiles**

```bash
cd js && pnpm type:check
```

Expected: No type errors

**Step 7: Update RecceProvider to orchestrate all contexts**

Modify `js/packages/ui/src/providers/RecceProvider.tsx` to compose all providers:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode, useMemo } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "../theme";
import { ApiProvider, type ApiConfig } from "./contexts/ApiContext";
import {
  RoutingProvider,
  type RoutingConfig,
} from "./contexts/RoutingContext";
import { RecceInstanceInfoProvider } from "../contexts/instance";
import { IdleTimeoutProvider } from "../contexts/idle";
import { LineageGraphProvider, type LineageGraphProviderProps } from "../contexts/lineage";
import { RecceActionProvider } from "../contexts/action";

export interface RecceProviderProps {
  children: ReactNode;

  /**
   * API configuration - how to connect to the Recce backend
   */
  api: ApiConfig;

  /**
   * Theme mode
   * @default "system"
   */
  theme?: "light" | "dark" | "system";

  /**
   * Routing configuration for navigation
   */
  routing?: RoutingConfig;

  /**
   * Feature flags to enable/disable functionality
   */
  features?: {
    enableExport?: boolean;
    enableImport?: boolean;
    enableWebSocket?: boolean;
    enableIdleTimeout?: boolean;
  };

  /**
   * TanStack Query client configuration
   */
  queryClientConfig?: {
    staleTime?: number;
    gcTime?: number;
  };

  /**
   * Optional: Pre-loaded lineage data (for SSR or testing)
   */
  initialLineageData?: Omit<LineageGraphProviderProps, "children">;
}

export function RecceProvider({
  children,
  api,
  theme: themeMode = "system",
  routing,
  features = {},
  queryClientConfig = {},
  initialLineageData,
}: RecceProviderProps) {
  // Create a stable QueryClient instance
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: queryClientConfig.staleTime ?? 5 * 60 * 1000, // 5 minutes
            gcTime: queryClientConfig.gcTime ?? 10 * 60 * 1000, // 10 minutes
            retry: 1,
          },
        },
      }),
    [queryClientConfig.staleTime, queryClientConfig.gcTime],
  );

  const {
    enableIdleTimeout = false,
  } = features;

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={themeMode}
      enableSystem={themeMode === "system"}
    >
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <ApiProvider config={api}>
            <RoutingProvider config={routing}>
              <RecceInstanceInfoProvider>
                {enableIdleTimeout ? (
                  <IdleTimeoutProvider>
                    <LineageGraphProvider {...initialLineageData}>
                      <RecceActionProvider>
                        {children}
                      </RecceActionProvider>
                    </LineageGraphProvider>
                  </IdleTimeoutProvider>
                ) : (
                  <LineageGraphProvider {...initialLineageData}>
                    <RecceActionProvider>
                      {children}
                    </RecceActionProvider>
                  </LineageGraphProvider>
                )}
              </RecceInstanceInfoProvider>
            </RoutingProvider>
          </ApiProvider>
        </QueryClientProvider>
      </MuiThemeProvider>
    </NextThemesProvider>
  );
}
```

**Step 8: Validate - full type check**

```bash
cd js && pnpm type:check
```

Expected: No type errors. If errors, fix imports.

**Step 9: Validate - build packages/ui**

```bash
cd js/packages/ui && pnpm build
```

Expected: Build succeeds

**Step 10: Validate - run all tests**

```bash
cd js && pnpm test
```

Expected: All tests pass

**Step 11: Commit**

```bash
git add js/packages/ui/src/providers/
git commit -s -m "feat(ui): complete RecceProvider orchestration with props-driven contexts"
```

---

### Task 1.4: Export New Contexts from packages/ui

**Files:**
- Modify: `js/packages/ui/src/providers/index.ts`
- Modify: `js/packages/ui/src/index.ts`

**Step 1: Update providers/index.ts exports**

```bash
cat js/packages/ui/src/providers/index.ts
```

Add exports for new contexts:

```typescript
// Existing exports...
export { CheckProvider, useCheckContext, type CheckProviderProps, type Check, type CheckContextType } from "./contexts/CheckContext";
export { QueryProvider, useQueryContext, type QueryProviderProps, type QueryResult, type QueryContextType } from "./contexts/QueryContext";
```

**Step 2: Update main index.ts exports**

Add to `js/packages/ui/src/index.ts`:

```typescript
// Add to Providers section
export type { Check, CheckContextType, CheckProviderProps } from "./providers";
export { CheckProvider, useCheckContext } from "./providers";

export type { QueryResult, QueryContextType, QueryProviderProps } from "./providers";
export { QueryProvider, useQueryContext } from "./providers";
```

**Step 3: Validate - type check**

```bash
cd js && pnpm type:check
```

**Step 4: Validate - build**

```bash
cd js/packages/ui && pnpm build
```

**Step 5: Commit**

```bash
git add js/packages/ui/src/providers/index.ts js/packages/ui/src/index.ts
git commit -s -m "feat(ui): export CheckContext and QueryContext from packages/ui"
```

---

## Phase 2: Extract Lineage Primitives

### Task 2.1: Analyze Lineage Component Dependencies

**Purpose:** Map what lineage components exist and their interdependencies before extraction.

**Files:**
- Read: `js/src/components/lineage/` (all files)

**Step 1: List all lineage component files**

```bash
find js/src/components/lineage -name "*.tsx" -o -name "*.ts" | sort
```

**Step 2: For each file, identify imports from other directories**

```bash
grep -r "from '@/" js/src/components/lineage/*.tsx | grep -v "lineage/" | head -50
```

This reveals external dependencies that primitives will need.

**Step 3: Identify which components render UI vs pure logic**

```bash
# Files with JSX (presentation)
grep -l "return (" js/src/components/lineage/*.tsx | head -20

# Files that are pure logic
grep -L "return (" js/src/components/lineage/*.ts | head -20
```

**Step 4: Document dependency graph (mental model)**

Key files likely include:
- `lineage.ts` - Core types and graph building
- `graph.ts` - React Flow integration
- `LineagePage.tsx` - High-level page component
- `LineageNode.tsx` - Node rendering
- `LineageEdge.tsx` - Edge rendering
- Various control components

**Step 5: Validate assumption - current lineage imports from packages/ui work**

```bash
grep "@datarecce/ui" js/src/components/lineage/*.ts js/src/components/lineage/*.tsx
```

Document which files already import from packages/ui.

---

### Task 2.2: Create Primitives Entry Point

**Files:**
- Create: `js/packages/ui/src/primitives.ts`
- Modify: `js/packages/ui/package.json` (add export)
- Modify: `js/packages/ui/tsdown.config.ts` (add entry point)

**Step 1: Create primitives.ts skeleton**

Create `js/packages/ui/src/primitives.ts`:

```typescript
// @datarecce/ui/primitives - Building block components for custom composition
// These are pure presentation components - no data fetching, just props and callbacks.

"use client";

export const PRIMITIVES_API_VERSION = "0.1.0";

// Lineage primitives (to be added in subsequent tasks)
// export { LineageNode } from "./components/lineage/LineageNode";
// export { LineageEdge } from "./components/lineage/LineageEdge";
// export { LineageControls } from "./components/lineage/LineageControls";

// Check primitives (to be added)
// export { CheckList } from "./components/check/CheckList";
// export { CheckCard } from "./components/check/CheckCard";

// Data primitives (to be added)
// export { DataGrid } from "./components/data/DataGrid";

// Placeholder export to prevent empty module error
export {};
```

**Step 2: Add to package.json exports**

Modify `js/packages/ui/package.json` exports field:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs"
  },
  "./primitives": {
    "types": "./dist/primitives.d.ts",
    "import": "./dist/primitives.mjs",
    "require": "./dist/primitives.cjs"
  },
  "./advanced": {
    "types": "./dist/advanced.d.ts",
    "import": "./dist/advanced.mjs",
    "require": "./dist/advanced.cjs"
  },
  "./styles": {
    "default": "./dist/styles.css"
  }
}
```

**Step 3: Add to tsdown.config.ts entry points**

```bash
cat js/packages/ui/tsdown.config.ts
```

Add `primitives` to entry:

```typescript
entry: {
  index: "src/index.ts",
  primitives: "src/primitives.ts",
  advanced: "src/advanced.ts",
},
```

**Step 4: Validate - build**

```bash
cd js/packages/ui && pnpm build
```

Expected: dist/ contains primitives.mjs, primitives.cjs, primitives.d.ts

**Step 5: Validate - check exports exist**

```bash
ls -la js/packages/ui/dist/primitives.*
```

**Step 6: Commit**

```bash
git add js/packages/ui/src/primitives.ts js/packages/ui/package.json js/packages/ui/tsdown.config.ts
git commit -s -m "feat(ui): add primitives entry point for building block components"
```

---

### Task 2.3: Extract LineageNode Component

**Purpose:** Create a pure presentation LineageNode component that accepts all data via props.

**Files:**
- Create: `js/packages/ui/src/components/lineage/nodes/LineageNode.tsx`
- Create: `js/packages/ui/src/components/lineage/nodes/index.ts`
- Modify: `js/packages/ui/src/primitives.ts`

**Step 1: Read OSS LineageNode for reference**

```bash
find js/src/components/lineage -name "*Node*" -type f
cat js/src/components/lineage/[found-file]
```

Note: The actual file structure may vary. Adapt based on what exists.

**Step 2: Create presentation-only LineageNode**

Create `js/packages/ui/src/components/lineage/nodes/LineageNode.tsx`:

```tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";

export type NodeChangeStatus = "added" | "removed" | "modified" | "unchanged";

export interface LineageNodeData {
  /** Display label for the node */
  label: string;
  /** Node type (model, source, seed, etc.) */
  nodeType?: string;
  /** Change status for diff visualization */
  changeStatus?: NodeChangeStatus;
  /** Whether this node is currently selected */
  isSelected?: boolean;
  /** Resource type for icon display */
  resourceType?: string;
  /** Package name */
  packageName?: string;
  /** Whether to show column-level details */
  showColumns?: boolean;
  /** Column data if showing columns */
  columns?: Array<{
    name: string;
    type?: string;
    changeStatus?: NodeChangeStatus;
  }>;
}

export interface LineageNodeProps extends NodeProps<LineageNodeData> {
  /** Callback when node is clicked */
  onNodeClick?: (nodeId: string) => void;
  /** Callback when node is double-clicked */
  onNodeDoubleClick?: (nodeId: string) => void;
}

const statusColors: Record<NodeChangeStatus, string> = {
  added: "#22c55e",      // green
  removed: "#ef4444",    // red
  modified: "#f59e0b",   // amber
  unchanged: "#6b7280",  // gray
};

function LineageNodeComponent({
  id,
  data,
  selected,
  onNodeClick,
  onNodeDoubleClick,
}: LineageNodeProps) {
  const {
    label,
    nodeType,
    changeStatus = "unchanged",
    isSelected,
    resourceType,
    packageName,
  } = data;

  const borderColor = statusColors[changeStatus];
  const isActive = selected || isSelected;

  return (
    <Box
      onClick={() => onNodeClick?.(id)}
      onDoubleClick={() => onNodeDoubleClick?.(id)}
      sx={{
        minWidth: 150,
        maxWidth: 250,
        padding: "8px 12px",
        borderRadius: "8px",
        border: `2px solid ${borderColor}`,
        backgroundColor: isActive ? "action.selected" : "background.paper",
        cursor: "pointer",
        transition: "all 0.2s ease",
        "&:hover": {
          backgroundColor: "action.hover",
        },
      }}
    >
      <Handle type="target" position={Position.Left} />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {nodeType && (
          <Chip
            label={nodeType}
            size="small"
            sx={{ fontSize: "0.65rem", height: 18 }}
          />
        )}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Typography>
      </Box>

      {packageName && (
        <Typography variant="caption" color="text.secondary">
          {packageName}
        </Typography>
      )}

      <Handle type="source" position={Position.Right} />
    </Box>
  );
}

export const LineageNode = memo(LineageNodeComponent);
LineageNode.displayName = "LineageNode";
```

**Step 3: Create index.ts for nodes**

Create `js/packages/ui/src/components/lineage/nodes/index.ts`:

```typescript
export { LineageNode, type LineageNodeProps, type LineageNodeData, type NodeChangeStatus } from "./LineageNode";
```

**Step 4: Validate - type check**

```bash
cd js && pnpm type:check
```

**Step 5: Export from primitives.ts**

Update `js/packages/ui/src/primitives.ts`:

```typescript
"use client";

export const PRIMITIVES_API_VERSION = "0.1.0";

// Lineage node components
export {
  LineageNode,
  type LineageNodeProps,
  type LineageNodeData,
  type NodeChangeStatus,
} from "./components/lineage/nodes";
```

**Step 6: Validate - build**

```bash
cd js/packages/ui && pnpm build
```

**Step 7: Validate - check export exists in built output**

```bash
grep -l "LineageNode" js/packages/ui/dist/primitives.*
```

**Step 8: Commit**

```bash
git add js/packages/ui/src/components/lineage/nodes/ js/packages/ui/src/primitives.ts
git commit -s -m "feat(ui): extract LineageNode as presentation-only primitive"
```

---

### Task 2.4: Extract LineageEdge Component

**Files:**
- Create: `js/packages/ui/src/components/lineage/edges/LineageEdge.tsx`
- Create: `js/packages/ui/src/components/lineage/edges/index.ts`
- Modify: `js/packages/ui/src/primitives.ts`

**Step 1: Read OSS edge rendering for reference**

```bash
find js/src/components/lineage -name "*Edge*" -o -name "*edge*" | head -10
```

**Step 2: Create presentation-only LineageEdge**

Create `js/packages/ui/src/components/lineage/edges/LineageEdge.tsx`:

```tsx
"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

export type EdgeChangeStatus = "added" | "removed" | "modified" | "unchanged";

export interface LineageEdgeData {
  /** Change status for diff visualization */
  changeStatus?: EdgeChangeStatus;
  /** Whether this edge is highlighted */
  isHighlighted?: boolean;
  /** Label to display on edge */
  label?: string;
}

export interface LineageEdgeProps extends EdgeProps<LineageEdgeData> {}

const statusColors: Record<EdgeChangeStatus, string> = {
  added: "#22c55e",
  removed: "#ef4444",
  modified: "#f59e0b",
  unchanged: "#94a3b8",
};

function LineageEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: LineageEdgeProps) {
  const { changeStatus = "unchanged", isHighlighted, label } = data ?? {};

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = statusColors[changeStatus];
  const strokeWidth = isHighlighted || selected ? 2.5 : 1.5;
  const strokeOpacity = isHighlighted || selected ? 1 : 0.6;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          opacity: strokeOpacity,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              fontWeight: 500,
              background: "white",
              padding: "2px 4px",
              borderRadius: 4,
              pointerEvents: "all",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const LineageEdge = memo(LineageEdgeComponent);
LineageEdge.displayName = "LineageEdge";
```

**Step 3: Create index.ts**

Create `js/packages/ui/src/components/lineage/edges/index.ts`:

```typescript
export { LineageEdge, type LineageEdgeProps, type LineageEdgeData, type EdgeChangeStatus } from "./LineageEdge";
```

**Step 4: Export from primitives.ts**

Add to `js/packages/ui/src/primitives.ts`:

```typescript
// Lineage edge components
export {
  LineageEdge,
  type LineageEdgeProps,
  type LineageEdgeData,
  type EdgeChangeStatus,
} from "./components/lineage/edges";
```

**Step 5: Validate - type check and build**

```bash
cd js && pnpm type:check
cd js/packages/ui && pnpm build
```

**Step 6: Commit**

```bash
git add js/packages/ui/src/components/lineage/edges/ js/packages/ui/src/primitives.ts
git commit -s -m "feat(ui): extract LineageEdge as presentation-only primitive"
```

---

### Task 2.5: Create LineageGraph Composed Component

**Purpose:** Create a composed component that uses LineageNode and LineageEdge primitives.

**Files:**
- Create: `js/packages/ui/src/components/lineage/LineageGraph.tsx`
- Modify: `js/packages/ui/src/components/lineage/index.ts`
- Modify: `js/packages/ui/src/index.ts`

**Step 1: Create LineageGraph component**

Create `js/packages/ui/src/components/lineage/LineageGraph.tsx`:

```tsx
"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Box from "@mui/material/Box";

import { LineageNode, type LineageNodeData } from "./nodes";
import { LineageEdge, type LineageEdgeData } from "./edges";

export interface LineageGraphProps {
  /** Nodes to display */
  nodes: Node<LineageNodeData>[];
  /** Edges connecting nodes */
  edges: Edge<LineageEdgeData>[];
  /** Callback when node selection changes */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Callback when node is double-clicked */
  onNodeDoubleClick?: (nodeId: string) => void;
  /** Whether to show minimap */
  showMiniMap?: boolean;
  /** Whether to show controls */
  showControls?: boolean;
  /** Whether to show background grid */
  showBackground?: boolean;
  /** Height of the graph container */
  height?: number | string;
  /** Whether the graph is interactive */
  interactive?: boolean;
}

const nodeTypes = {
  lineageNode: LineageNode,
};

const edgeTypes = {
  lineageEdge: LineageEdge,
};

export function LineageGraph({
  nodes: initialNodes,
  edges: initialEdges,
  onNodeSelect,
  onNodeDoubleClick,
  showMiniMap = true,
  showControls = true,
  showBackground = true,
  height = 600,
  interactive = true,
}: LineageGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect],
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeDoubleClick?.(node.id);
    },
    [onNodeDoubleClick],
  );

  return (
    <Box sx={{ width: "100%", height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={interactive ? onNodesChange : undefined}
        onEdgesChange={interactive ? onEdgesChange : undefined}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={interactive}
        nodesConnectable={false}
        elementsSelectable={interactive}
      >
        {showBackground && <Background />}
        {showControls && <Controls />}
        {showMiniMap && (
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as LineageNodeData;
              switch (data.changeStatus) {
                case "added":
                  return "#22c55e";
                case "removed":
                  return "#ef4444";
                case "modified":
                  return "#f59e0b";
                default:
                  return "#94a3b8";
              }
            }}
          />
        )}
      </ReactFlow>
    </Box>
  );
}
```

**Step 2: Update lineage index.ts**

Update `js/packages/ui/src/components/lineage/index.ts`:

```typescript
"use client";

// Existing exports
export type { LineageViewProps, LineageViewRef } from "./LineageView";
export { LineageView } from "./LineageView";

// New composed component
export { LineageGraph, type LineageGraphProps } from "./LineageGraph";

// Re-export primitives for convenience
export * from "./nodes";
export * from "./edges";
```

**Step 3: Export from main index.ts**

Add to `js/packages/ui/src/index.ts` components section:

```typescript
export type { LineageGraphProps } from "./components";
export { LineageGraph } from "./components";
```

**Step 4: Validate - type check and build**

```bash
cd js && pnpm type:check
cd js/packages/ui && pnpm build
```

**Step 5: Run all tests**

```bash
cd js && pnpm test
```

**Step 6: Commit**

```bash
git add js/packages/ui/src/components/lineage/
git commit -s -m "feat(ui): add LineageGraph composed component using node/edge primitives"
```

---

## Phase 3: Build High-Level Views (Continues...)

### Task 3.1: Create Real LineageView Implementation

**Purpose:** Replace the placeholder LineageView with a real implementation that uses LineageGraph and consumes from LineageGraphContext.

**Files:**
- Modify: `js/packages/ui/src/components/lineage/LineageView.tsx`
- Modify: `js/packages/ui/src/components/lineage/index.ts`

**Step 1: Read current placeholder**

```bash
cat js/packages/ui/src/components/lineage/LineageView.tsx
```

Note: Currently throws an error.

**Step 2: Implement real LineageView**

Replace `js/packages/ui/src/components/lineage/LineageView.tsx`:

```tsx
"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, type Ref } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { toPng } from "html-to-image";

import { useLineageGraphContext } from "../../contexts/lineage";
import { toReactFlowBasic } from "../../contexts/lineage/utils";
import { LineageGraph } from "./LineageGraph";

export interface LineageViewProps {
  /** View options for lineage diff visualization */
  viewOptions?: {
    view_mode?: "changed_models" | "all";
    node_ids?: string[];
    select?: string;
    exclude?: string;
    packages?: string[];
  };
  /** Whether the view allows user interaction */
  interactive?: boolean;
  /** Height of the view */
  height?: number | string;
  /** Callback when a node is selected */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Callback when a node is double-clicked */
  onNodeDoubleClick?: (nodeId: string) => void;
  /** Whether to show minimap */
  showMiniMap?: boolean;
  /** Whether to show controls */
  showControls?: boolean;
}

export interface LineageViewRef {
  /** Copy the lineage view as an image to clipboard */
  copyToClipboard: () => Promise<void>;
  /** Download the lineage view as a PNG */
  downloadImage: (filename?: string) => Promise<void>;
}

export const LineageView = forwardRef<LineageViewRef, LineageViewProps>(
  function LineageView(
    {
      viewOptions,
      interactive = true,
      height = 600,
      onNodeSelect,
      onNodeDoubleClick,
      showMiniMap = true,
      showControls = true,
    }: LineageViewProps,
    ref: Ref<LineageViewRef>,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { lineageGraph, isLoading, error } = useLineageGraphContext();

    // Convert LineageGraph to React Flow nodes/edges
    const { nodes, edges } = lineageGraph
      ? toReactFlowBasic(lineageGraph, viewOptions)
      : { nodes: [], edges: [] };

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      copyToClipboard: async () => {
        if (!containerRef.current) return;
        try {
          const dataUrl = await toPng(containerRef.current);
          const blob = await fetch(dataUrl).then((r) => r.blob());
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
        } catch (err) {
          console.error("Failed to copy to clipboard:", err);
        }
      },
      downloadImage: async (filename = "lineage.png") => {
        if (!containerRef.current) return;
        try {
          const dataUrl = await toPng(containerRef.current);
          const link = document.createElement("a");
          link.download = filename;
          link.href = dataUrl;
          link.click();
        } catch (err) {
          console.error("Failed to download image:", err);
        }
      },
    }));

    if (isLoading) {
      return (
        <Box
          sx={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Box
          sx={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="error">{error}</Typography>
        </Box>
      );
    }

    if (!lineageGraph || nodes.length === 0) {
      return (
        <Box
          sx={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary">No lineage data available</Typography>
        </Box>
      );
    }

    return (
      <Box ref={containerRef} sx={{ width: "100%", height }}>
        <LineageGraph
          nodes={nodes}
          edges={edges}
          onNodeSelect={onNodeSelect}
          onNodeDoubleClick={onNodeDoubleClick}
          interactive={interactive}
          showMiniMap={showMiniMap}
          showControls={showControls}
          height={height}
        />
      </Box>
    );
  },
);
```

**Step 3: Validate - type check**

```bash
cd js && pnpm type:check
```

Note: May need to adjust imports based on actual toReactFlowBasic signature.

**Step 4: Validate - build**

```bash
cd js/packages/ui && pnpm build
```

**Step 5: Validate - run tests**

```bash
cd js && pnpm test
```

**Step 6: Commit**

```bash
git add js/packages/ui/src/components/lineage/LineageView.tsx
git commit -s -m "feat(ui): implement real LineageView consuming from LineageGraphContext"
```

---

## Validation Checkpoints

After completing each phase, run these validation steps:

### Phase 1 Complete Validation

```bash
# All tests pass
cd js && pnpm test

# Type check passes
cd js && pnpm type:check

# packages/ui builds
cd js/packages/ui && pnpm build

# Verify exports
node -e "const pkg = require('./js/packages/ui/dist/index.cjs'); console.log(Object.keys(pkg))"
```

### Phase 2 Complete Validation

```bash
# All above plus:

# Primitives export exists
node -e "const pkg = require('./js/packages/ui/dist/primitives.cjs'); console.log(Object.keys(pkg))"

# LineageNode, LineageEdge, LineageGraph available
```

### Phase 3 Complete Validation

```bash
# All above plus:

# LineageView is not a placeholder
grep -v "throw new Error" js/packages/ui/src/components/lineage/LineageView.tsx

# OSS app builds with new components
cd js && pnpm build
```

---

## Troubleshooting Guide

### "Cannot find module '@datarecce/ui'"

**In Jest:** Add moduleNameMapper to jest.config.mjs
**In TypeScript:** Check tsconfig.json paths

### "X is not exported from @datarecce/ui"

1. Check `js/packages/ui/src/index.ts` has the export
2. Rebuild: `cd js/packages/ui && pnpm build`
3. Check dist/ files contain the export

### Type errors after changes

1. Run `cd js && pnpm type:check` for full errors
2. Check import paths match actual file structure
3. Verify all dependencies in package.json

### Tests fail after component changes

1. Run specific test: `pnpm test -- --testPathPattern=<pattern>`
2. Check if test uses old API that changed
3. Update test to match new component props

---

## Success Criteria

Phase 1 complete when:
- [ ] All 30 test suites pass
- [ ] RecceProvider composes all contexts
- [ ] CheckContext and QueryContext are props-driven
- [ ] packages/ui builds successfully

Phase 2 complete when:
- [ ] primitives.ts exports LineageNode, LineageEdge
- [ ] LineageGraph composes the primitives
- [ ] All exports work from `@datarecce/ui/primitives`

Phase 3 complete when:
- [ ] LineageView is a real implementation (not placeholder)
- [ ] LineageView consumes from LineageGraphContext
- [ ] OSS app can import and use LineageView
