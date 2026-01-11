# Lineage Module Test Coverage Audit

**Date:** 2026-01-11
**Module:** `js/src/components/lineage/`
**Purpose:** Pre-migration test coverage assessment for @datarecce/ui integration

---

## Executive Summary

The lineage module contains 21 source files with approximately **43% test coverage** (9/21 files have any tests). Of the files with tests, 8 have comprehensive coverage while 1 has only partial coverage. This audit identifies critical gaps that should be addressed before proceeding with the @datarecce/ui migration to ensure safe refactoring.

### Key Findings

- **Strengths:** Core visualization components (`GraphNode`, `GraphEdge`, `GraphColumnNode`) have excellent test coverage with 1000+ lines of tests
- **Critical Gaps:** `useMultiNodesAction.ts` (complex async hook) and `LineageView.tsx` (main orchestrator) need tests before migration
- **Risk Assessment:** HIGH - The untested files handle critical user interactions and state management

---

## Test Coverage Matrix

| File | Has Tests | Test File | Coverage Notes | Priority |
|------|-----------|-----------|----------------|----------|
| `lineage.ts` | YES | `lineage.test.ts`, `LineageView.test.tsx` | Tests `toReactFlow`, `layout`, and integration with @datarecce/ui | HIGH |
| `useMultiNodesAction.ts` | NO | - | Complex async hook with API calls, run submission, cancellation. Needs extensive mocking | HIGH |
| `LineageViewContextMenu.tsx` | NO | - | Complex menu with many conditional items, tracking, setup popover | MEDIUM |
| `ColumnLevelLineageControl.tsx` | NO | - | CLL toggle, analyze change button, loading states | MEDIUM |
| `SandboxView.tsx` | NO | - | Complex with VSplit, DiffEditor, QueryForm, mutation handling | MEDIUM |
| `LineageViewNotification.tsx` | YES | `LineageViewNotification.test.tsx` | Comprehensive: rendering, types, dismiss, sessionStorage | HIGH |
| `useValueDiffAlertDialog.tsx` | YES | `useValueDiffAlertDialog.test.tsx` | Comprehensive: hook return, dialog, confirm/cancel | HIGH |
| `LineageViewTopBar.tsx` | NO | - | Complex with menus, filters, view mode selection | MEDIUM |
| `LineageView.tsx` | PARTIAL | `LineageView.test.tsx` | Only utility function tests, no component render tests | HIGH |
| `ActionControl.tsx` | YES | `ActionControl.test.tsx` | Comprehensive: progress, status, cancel/close, state transitions | HIGH |
| `GraphNode.tsx` | YES | `GraphNode.test.tsx` | Comprehensive: rendering, selection, hover, action tags, handles, dark mode | HIGH |
| `GraphEdge.tsx` | YES | `GraphEdge.test.tsx` | Comprehensive: rendering, change status styling, highlighting | HIGH |
| `GraphColumnNode.tsx` | YES | `GraphColumnNode.test.tsx` | Comprehensive: rendering, toggle behavior, hover, highlighting | HIGH |
| `NodeSqlView.tsx` | YES | `NodeSqlView.test.tsx` | Comprehensive: loading, resource types, single/diff modes, theme | HIGH |
| `NodeTag.tsx` | NO | - | Simple presentation components | LOW |
| `NodeView.tsx` | NO | - | Tab-based view, integrates many subcomponents | LOW |
| `LineageViewContext.tsx` | NO | - | Simple context definition, tested indirectly | LOW |
| `LineagePage.tsx` | NO | - | Trivial wrapper (10 lines) | LOW |
| `SetupConnectionBanner.tsx` | NO | - | Conditional banner, simple rendering | LOW |
| `ServerDisconnectedModalContent.tsx` | NO | - | Modal content, simple presentation | LOW |
| `SingleEnvironmentQueryView.tsx` | NO | - | Setup guide, mostly static | LOW |

---

## Statistics

| Metric | Value |
|--------|-------|
| Total source files | 21 |
| Files with comprehensive tests | 8 |
| Files with partial tests | 1 |
| Files without tests | 12 |
| **Overall test coverage** | **~43%** (9/21 have any tests) |

### Test File Line Counts

| Test File | Lines | Covered Component |
|-----------|-------|-------------------|
| `GraphNode.test.tsx` | 1,061 | Node rendering and interactions |
| `ActionControl.test.tsx` | 781 | Progress and status display |
| `NodeSqlView.test.tsx` | 771 | SQL preview component |
| `GraphColumnNode.test.tsx` | 593 | Column-level lineage nodes |
| `useValueDiffAlertDialog.test.tsx` | 576 | Value diff confirmation dialog |
| `LineageViewNotification.test.tsx` | 426 | Notification banner |
| `GraphEdge.test.tsx` | 384 | Edge rendering and styling |
| `LineageView.test.tsx` | 351 | Utility functions only (partial) |

**Total test lines:** ~4,943 lines

---

## Priority Analysis

### HIGH Priority - Must Test Before Migration

These files contain critical business logic or serve as integration points that will be modified during migration.

#### 1. `useMultiNodesAction.ts`

**Risk Level:** CRITICAL

**Complexity Factors:**
- Async hook with complex state management
- API calls to `/api/runs` for batch operations
- Run submission and cancellation logic
- Error handling and recovery
- Interaction with `useLineageViewContext`

**Why It Matters:**
This hook orchestrates multi-node actions (running checks on multiple selected nodes). Any migration changes could break batch operations silently without tests.

**Recommended Test Scenarios:**
- Hook initialization with different node selections
- Run submission success/failure paths
- Cancellation during execution
- Progress updates and completion
- Error recovery and cleanup

---

#### 2. `LineageView.tsx` (Component Tests)

**Risk Level:** HIGH

**Complexity Factors:**
- Main orchestrator component for lineage visualization
- Integrates ReactFlow, context providers, and child components
- Handles keyboard shortcuts and user interactions
- Manages selection state and view modes

**Current State:**
Only utility function tests exist (`LineageView.test.tsx` tests `toReactFlow` and `layout`). No component render tests.

**Why It Matters:**
This is the primary entry point for lineage functionality. Changes during migration need regression protection.

**Recommended Test Scenarios:**
- Component mounting with mock context
- ReactFlow integration rendering
- Keyboard shortcut handlers
- Selection state updates
- View mode transitions

---

### MEDIUM Priority - Should Test Before Migration

These files have moderate complexity and user-facing interactions.

#### 3. `LineageViewContextMenu.tsx`

**Complexity:** Right-click context menu with conditional items, analytics tracking, setup popover integration

**Test Focus:** Menu item visibility, click handlers, tracking calls

---

#### 4. `ColumnLevelLineageControl.tsx`

**Complexity:** Toggle controls for column-level lineage, analyze change button, loading states

**Test Focus:** Toggle behavior, button states, loading indicators

---

#### 5. `SandboxView.tsx`

**Complexity:** Preview changes view with VSplit, DiffEditor, QueryForm, mutation handling

**Test Focus:** Layout rendering, form submission, mutation triggers

---

#### 6. `LineageViewTopBar.tsx`

**Complexity:** Top bar with dropdown menus, filters, view mode selection

**Test Focus:** Menu interactions, filter changes, view mode switching

---

### LOW Priority - Can Skip Testing

These files are either trivial wrappers, simple presentation components, or are tested indirectly through integration.

| File | Reason to Skip |
|------|----------------|
| `NodeTag.tsx` | Simple presentation, no logic |
| `NodeView.tsx` | Integration tested via parent |
| `LineageViewContext.tsx` | Context definition only |
| `LineagePage.tsx` | 10-line wrapper component |
| `SetupConnectionBanner.tsx` | Simple conditional render |
| `ServerDisconnectedModalContent.tsx` | Static modal content |
| `SingleEnvironmentQueryView.tsx` | Static setup guide |

---

## Recommendations

### Pre-Migration Testing Strategy

1. **Immediate (Before Migration Starts)**
   - Add comprehensive tests for `useMultiNodesAction.ts`
   - Add component render tests for `LineageView.tsx`

2. **During Migration**
   - Add tests for MEDIUM priority files as they are modified
   - Ensure existing tests pass after each refactoring step

3. **Post-Migration Verification**
   - Run full test suite with coverage
   - Manual QA for untested LOW priority components

### Test Infrastructure Needs

For the HIGH priority gaps, you will need:

- **Mock utilities** for `useLineageViewContext`
- **API mocking** with MSW or jest.mock for run submission
- **ReactFlow test utilities** for component rendering
- **Timer mocking** for async operations

---

## Test Templates

### Template: `useMultiNodesAction.test.ts`

```typescript
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { useMultiNodesAction } from "../useMultiNodesAction";
import { LineageViewProvider } from "../LineageViewContext";

// MSW server setup
const server = setupServer(
  http.post("/api/runs", () => {
    return HttpResponse.json({
      run_id: "test-run-123",
      status: "pending",
    });
  }),
  http.get("/api/runs/:runId", ({ params }) => {
    return HttpResponse.json({
      run_id: params.runId,
      status: "completed",
      result: { /* mock result */ },
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock context wrapper
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LineageViewProvider value={mockLineageContext}>
    {children}
  </LineageViewProvider>
);

const mockLineageContext = {
  selectedNodes: ["model_a", "model_b"],
  // ... other context values
};

describe("useMultiNodesAction", () => {
  describe("initialization", () => {
    it("should initialize with idle state", () => {
      const { result } = renderHook(() => useMultiNodesAction(), { wrapper });

      expect(result.current.status).toBe("idle");
      expect(result.current.progress).toBe(0);
      expect(result.current.isRunning).toBe(false);
    });

    it("should reflect selected nodes from context", () => {
      const { result } = renderHook(() => useMultiNodesAction(), { wrapper });

      expect(result.current.selectedNodeCount).toBe(2);
    });
  });

  describe("run submission", () => {
    it("should submit run for selected nodes", async () => {
      const { result } = renderHook(() => useMultiNodesAction(), { wrapper });

      act(() => {
        result.current.submitRun("row_count_diff");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("running");
      });
    });

    it("should handle submission errors", async () => {
      server.use(
        http.post("/api/runs", () => {
          return HttpResponse.json(
            { error: "Submission failed" },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useMultiNodesAction(), { wrapper });

      act(() => {
        result.current.submitRun("row_count_diff");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("error");
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe("cancellation", () => {
    it("should cancel running operation", async () => {
      const { result } = renderHook(() => useMultiNodesAction(), { wrapper });

      act(() => {
        result.current.submitRun("row_count_diff");
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(true);
      });

      act(() => {
        result.current.cancel();
      });

      await waitFor(() => {
        expect(result.current.status).toBe("cancelled");
        expect(result.current.isRunning).toBe(false);
      });
    });
  });

  describe("progress updates", () => {
    it("should update progress during execution", async () => {
      // Mock progressive responses
      let callCount = 0;
      server.use(
        http.get("/api/runs/:runId", () => {
          callCount++;
          return HttpResponse.json({
            run_id: "test-run-123",
            status: callCount < 3 ? "running" : "completed",
            progress: callCount * 33,
          });
        })
      );

      const { result } = renderHook(() => useMultiNodesAction(), { wrapper });

      act(() => {
        result.current.submitRun("row_count_diff");
      });

      await waitFor(() => {
        expect(result.current.progress).toBeGreaterThan(0);
      });
    });
  });

  describe("completion", () => {
    it("should transition to completed state on success", async () => {
      const { result } = renderHook(() => useMultiNodesAction(), { wrapper });

      act(() => {
        result.current.submitRun("row_count_diff");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("completed");
        expect(result.current.result).toBeDefined();
      });
    });
  });
});
```

---

### Template: `LineageView.component.test.tsx`

```typescript
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { LineageView } from "../LineageView";
import { LineageViewProvider } from "../LineageViewContext";

// Mock ReactFlow components
jest.mock("@xyflow/react", () => ({
  ...jest.requireActual("@xyflow/react"),
  ReactFlow: ({ children, nodes, edges }: any) => (
    <div data-testid="reactflow-container" data-nodes={nodes?.length} data-edges={edges?.length}>
      {children}
    </div>
  ),
  Background: () => <div data-testid="reactflow-background" />,
  Controls: () => <div data-testid="reactflow-controls" />,
  MiniMap: () => <div data-testid="reactflow-minimap" />,
  useReactFlow: () => ({
    fitView: jest.fn(),
    setCenter: jest.fn(),
    getNodes: jest.fn(() => []),
    getEdges: jest.fn(() => []),
  }),
}));

// Mock context data
const mockContextValue = {
  nodes: [
    { id: "model_a", type: "model", data: { name: "model_a" } },
    { id: "model_b", type: "model", data: { name: "model_b" } },
  ],
  edges: [
    { id: "e1", source: "model_a", target: "model_b" },
  ],
  selectedNodes: [],
  setSelectedNodes: jest.fn(),
  viewMode: "lineage",
  setViewMode: jest.fn(),
  isLoading: false,
  error: null,
};

const renderLineageView = (contextOverrides = {}) => {
  const contextValue = { ...mockContextValue, ...contextOverrides };

  return render(
    <ReactFlowProvider>
      <LineageViewProvider value={contextValue}>
        <LineageView />
      </LineageViewProvider>
    </ReactFlowProvider>
  );
};

describe("LineageView Component", () => {
  describe("rendering", () => {
    it("should render ReactFlow container", () => {
      renderLineageView();

      expect(screen.getByTestId("reactflow-container")).toBeInTheDocument();
    });

    it("should render with nodes and edges", () => {
      renderLineageView();

      const container = screen.getByTestId("reactflow-container");
      expect(container).toHaveAttribute("data-nodes", "2");
      expect(container).toHaveAttribute("data-edges", "1");
    });

    it("should render background and controls", () => {
      renderLineageView();

      expect(screen.getByTestId("reactflow-background")).toBeInTheDocument();
      expect(screen.getByTestId("reactflow-controls")).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("should show loading indicator when loading", () => {
      renderLineageView({ isLoading: true });

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("should not show loading indicator when not loading", () => {
      renderLineageView({ isLoading: false });

      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("should display error message when error exists", () => {
      renderLineageView({ error: "Failed to load lineage" });

      expect(screen.getByText(/failed to load lineage/i)).toBeInTheDocument();
    });
  });

  describe("keyboard shortcuts", () => {
    it("should handle Escape key to deselect nodes", () => {
      const setSelectedNodes = jest.fn();
      renderLineageView({
        selectedNodes: ["model_a"],
        setSelectedNodes,
      });

      fireEvent.keyDown(document, { key: "Escape" });

      expect(setSelectedNodes).toHaveBeenCalledWith([]);
    });

    it("should handle Ctrl+A to select all nodes", () => {
      const setSelectedNodes = jest.fn();
      renderLineageView({ setSelectedNodes });

      fireEvent.keyDown(document, { key: "a", ctrlKey: true });

      expect(setSelectedNodes).toHaveBeenCalledWith(["model_a", "model_b"]);
    });
  });

  describe("selection", () => {
    it("should update selection when node is clicked", () => {
      const setSelectedNodes = jest.fn();
      renderLineageView({ setSelectedNodes });

      // Simulate node selection (depends on actual implementation)
      // This would typically be handled by ReactFlow's onNodeClick
    });
  });

  describe("view modes", () => {
    it("should render in lineage view mode by default", () => {
      renderLineageView({ viewMode: "lineage" });

      // Assert view mode specific rendering
    });

    it("should render in column lineage view mode", () => {
      renderLineageView({ viewMode: "column-lineage" });

      // Assert column lineage specific rendering
    });
  });

  describe("empty state", () => {
    it("should show empty state when no nodes exist", () => {
      renderLineageView({ nodes: [], edges: [] });

      expect(screen.getByText(/no models found/i)).toBeInTheDocument();
    });
  });
});
```

---

## Conclusion

The lineage module has a solid testing foundation for core visualization components, but critical gaps exist in the business logic and orchestration layers. Addressing the HIGH priority gaps (`useMultiNodesAction.ts` and `LineageView.tsx` component tests) before migration will significantly reduce the risk of regression bugs during the @datarecce/ui integration.

**Estimated effort for HIGH priority tests:** 2-3 days
**Estimated effort for MEDIUM priority tests:** 3-4 days
**Total recommended pre-migration testing effort:** 5-7 days
