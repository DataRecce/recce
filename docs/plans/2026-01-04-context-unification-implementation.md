# Context Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Recce OSS to consume @datarecce/ui contexts, making @datarecce/ui the single source of truth for context implementations.

**Architecture:** Tests-first approach with three migration strategies: direct import for IDENTICAL contexts, adapter pattern for PROPS-DRIVEN contexts, and interface merging for DIFFERENT PURPOSE contexts.

**Tech Stack:** React 19, TypeScript 5.9, Jest 30, React Testing Library, @tanstack/react-query 5

---

## Phase Overview

| Phase | Scope | Risk | Dependencies |
|-------|-------|------|--------------|
| **2A** | Tests for all contexts | None | None |
| **2B** | IDENTICAL migrations (Instance, Idle) | Low | 2A |
| **2C** | ApiConfig with optional fallback | Low | 2A |
| **2D** | PROPS-DRIVEN adapters (Lineage, Action) | Medium | 2A |
| **2E** | Interface merge (Check, Query) | Medium | 2A |

---

## Phase 2A: Tests First

### Task 1: RecceInstanceContext Tests (OSS)

**Files:**
- Create: `js/src/lib/hooks/__tests__/RecceInstanceContext.test.tsx`
- Reference: `js/src/lib/hooks/RecceInstanceContext.tsx`

**Step 1: Create test file with imports**

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RecceInstanceInfoProvider,
  useRecceInstanceInfo,
  useRecceFeatureToggles,
} from "../RecceInstanceContext";

// Mock the API client
jest.mock("@/lib/api/instance", () => ({
  getRecceInstanceInfo: jest.fn(),
}));

import { getRecceInstanceInfo } from "@/lib/api/instance";

const mockGetRecceInstanceInfo = getRecceInstanceInfo as jest.MockedFunction<typeof getRecceInstanceInfo>;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function TestConsumer() {
  const info = useRecceInstanceInfo();
  const toggles = useRecceFeatureToggles();
  return (
    <div>
      <span data-testid="version">{info?.recce_version ?? "loading"}</span>
      <span data-testid="cloud-mode">{String(toggles.enableCloudFeatures)}</span>
      <span data-testid="single-env">{String(toggles.singleEnvOnlyMode)}</span>
    </div>
  );
}
```

**Step 2: Write test for loading state**

```typescript
describe("RecceInstanceContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns undefined while loading", () => {
    mockGetRecceInstanceInfo.mockImplementation(() => new Promise(() => {})); // Never resolves

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RecceInstanceInfoProvider>
          <TestConsumer />
        </RecceInstanceInfoProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("version")).toHaveTextContent("loading");
  });
});
```

**Step 3: Write test for successful data fetch**

```typescript
it("provides instance info after successful fetch", async () => {
  mockGetRecceInstanceInfo.mockResolvedValue({
    recce_version: "1.0.0",
    server_mode: "local",
    cloud_mode: false,
    single_env_only_mode: false,
    demo_mode: false,
  });

  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RecceInstanceInfoProvider>
        <TestConsumer />
      </RecceInstanceInfoProvider>
    </QueryClientProvider>
  );

  await waitFor(() => {
    expect(screen.getByTestId("version")).toHaveTextContent("1.0.0");
  });
});
```

**Step 4: Write test for feature toggles computation**

```typescript
it("computes enableCloudFeatures correctly for cloud mode", async () => {
  mockGetRecceInstanceInfo.mockResolvedValue({
    recce_version: "1.0.0",
    server_mode: "cloud",
    cloud_mode: true,
    single_env_only_mode: false,
    demo_mode: false,
  });

  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RecceInstanceInfoProvider>
        <TestConsumer />
      </RecceInstanceInfoProvider>
    </QueryClientProvider>
  );

  await waitFor(() => {
    expect(screen.getByTestId("cloud-mode")).toHaveTextContent("true");
  });
});

it("computes singleEnvOnlyMode correctly", async () => {
  mockGetRecceInstanceInfo.mockResolvedValue({
    recce_version: "1.0.0",
    server_mode: "local",
    cloud_mode: false,
    single_env_only_mode: true,
    demo_mode: false,
  });

  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RecceInstanceInfoProvider>
        <TestConsumer />
      </RecceInstanceInfoProvider>
    </QueryClientProvider>
  );

  await waitFor(() => {
    expect(screen.getByTestId("single-env")).toHaveTextContent("true");
  });
});
```

**Step 5: Run tests**

Run: `pnpm -C js test -- --testPathPattern="RecceInstanceContext.test"`
Expected: All tests pass

**Step 6: Commit**

```bash
git add js/src/lib/hooks/__tests__/RecceInstanceContext.test.tsx
git commit -s -m "test(hooks): add RecceInstanceContext tests for Phase 2A"
```

---

### Task 2: RecceInstanceContext Tests (@datarecce/ui)

**Files:**
- Create: `js/packages/ui/src/contexts/instance/__tests__/RecceInstanceContext.test.tsx`
- Reference: `js/packages/ui/src/contexts/instance/RecceInstanceContext.tsx`

**Step 1: Create test file with same structure as OSS**

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RecceInstanceInfoProvider,
  useRecceInstanceInfo,
  useRecceFeatureToggles,
} from "../RecceInstanceContext";

// Mock the API - @datarecce/ui uses relative import
jest.mock("../../../api/instance", () => ({
  getRecceInstanceInfo: jest.fn(),
}));

import { getRecceInstanceInfo } from "../../../api/instance";

const mockGetRecceInstanceInfo = getRecceInstanceInfo as jest.MockedFunction<typeof getRecceInstanceInfo>;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function TestConsumer() {
  const info = useRecceInstanceInfo();
  const toggles = useRecceFeatureToggles();
  return (
    <div>
      <span data-testid="version">{info?.recce_version ?? "loading"}</span>
      <span data-testid="cloud-mode">{String(toggles.enableCloudFeatures)}</span>
      <span data-testid="single-env">{String(toggles.singleEnvOnlyMode)}</span>
    </div>
  );
}
```

**Step 2: Write identical tests to OSS**

```typescript
describe("RecceInstanceContext (@datarecce/ui)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns undefined while loading", () => {
    mockGetRecceInstanceInfo.mockImplementation(() => new Promise(() => {}));

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RecceInstanceInfoProvider>
          <TestConsumer />
        </RecceInstanceInfoProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("version")).toHaveTextContent("loading");
  });

  it("provides instance info after successful fetch", async () => {
    mockGetRecceInstanceInfo.mockResolvedValue({
      recce_version: "1.0.0",
      server_mode: "local",
      cloud_mode: false,
      single_env_only_mode: false,
      demo_mode: false,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RecceInstanceInfoProvider>
          <TestConsumer />
        </RecceInstanceInfoProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("version")).toHaveTextContent("1.0.0");
    });
  });

  it("computes enableCloudFeatures correctly for cloud mode", async () => {
    mockGetRecceInstanceInfo.mockResolvedValue({
      recce_version: "1.0.0",
      server_mode: "cloud",
      cloud_mode: true,
      single_env_only_mode: false,
      demo_mode: false,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RecceInstanceInfoProvider>
          <TestConsumer />
        </RecceInstanceInfoProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("cloud-mode")).toHaveTextContent("true");
    });
  });

  it("computes singleEnvOnlyMode correctly", async () => {
    mockGetRecceInstanceInfo.mockResolvedValue({
      recce_version: "1.0.0",
      server_mode: "local",
      cloud_mode: false,
      single_env_only_mode: true,
      demo_mode: false,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RecceInstanceInfoProvider>
          <TestConsumer />
        </RecceInstanceInfoProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("single-env")).toHaveTextContent("true");
    });
  });
});
```

**Step 3: Run tests**

Run: `pnpm -C js/packages/ui test -- --testPathPattern="RecceInstanceContext.test"`
Expected: All tests pass (identical behavior to OSS)

**Step 4: Commit**

```bash
git add js/packages/ui/src/contexts/instance/__tests__/RecceInstanceContext.test.tsx
git commit -s -m "test(ui): add RecceInstanceContext tests for Phase 2A"
```

---

### Task 3: IdleTimeoutContext Tests (OSS)

**Files:**
- Create: `js/src/lib/hooks/__tests__/IdleTimeoutContext.test.tsx`
- Reference: `js/src/lib/hooks/IdleTimeoutContext.tsx`

**Step 1: Create test file**

```typescript
import { render, screen, act } from "@testing-library/react";
import {
  IdleTimeoutProvider,
  useIdleTimeout,
  useIdleTimeoutSafe,
  useIdleDetection,
} from "../IdleTimeoutContext";

function TestConsumer() {
  const context = useIdleTimeout();
  return (
    <div>
      <span data-testid="enabled">{String(context.isEnabled)}</span>
      <span data-testid="timeout">{context.timeout ?? "none"}</span>
      <span data-testid="countdown">{context.countdownSeconds ?? "none"}</span>
    </div>
  );
}

function SafeTestConsumer() {
  const context = useIdleTimeoutSafe();
  return (
    <div>
      <span data-testid="safe-enabled">{context ? String(context.isEnabled) : "no-provider"}</span>
    </div>
  );
}
```

**Step 2: Write test for disabled state (no timeout)**

```typescript
describe("IdleTimeoutContext", () => {
  it("reports disabled when timeout is null", () => {
    render(
      <IdleTimeoutProvider timeout={null} onTimeout={() => {}}>
        <TestConsumer />
      </IdleTimeoutProvider>
    );

    expect(screen.getByTestId("enabled")).toHaveTextContent("false");
    expect(screen.getByTestId("timeout")).toHaveTextContent("none");
  });
});
```

**Step 3: Write test for enabled state**

```typescript
it("reports enabled when timeout is set", () => {
  render(
    <IdleTimeoutProvider timeout={300} onTimeout={() => {}}>
      <TestConsumer />
    </IdleTimeoutProvider>
  );

  expect(screen.getByTestId("enabled")).toHaveTextContent("true");
  expect(screen.getByTestId("timeout")).toHaveTextContent("300");
});
```

**Step 4: Write test for useIdleTimeoutSafe fallback**

```typescript
it("useIdleTimeoutSafe returns null without provider", () => {
  render(<SafeTestConsumer />);
  expect(screen.getByTestId("safe-enabled")).toHaveTextContent("no-provider");
});

it("useIdleTimeoutSafe returns context with provider", () => {
  render(
    <IdleTimeoutProvider timeout={300} onTimeout={() => {}}>
      <SafeTestConsumer />
    </IdleTimeoutProvider>
  );
  expect(screen.getByTestId("safe-enabled")).toHaveTextContent("true");
});
```

**Step 5: Write test for keep-alive callback**

```typescript
it("registerKeepAlive adds callback that can be called", () => {
  const keepAliveFn = jest.fn();

  function KeepAliveConsumer() {
    const { registerKeepAlive } = useIdleTimeout();
    React.useEffect(() => {
      const unregister = registerKeepAlive(keepAliveFn);
      return unregister;
    }, [registerKeepAlive]);
    return null;
  }

  render(
    <IdleTimeoutProvider timeout={300} onTimeout={() => {}}>
      <KeepAliveConsumer />
    </IdleTimeoutProvider>
  );

  // Keep-alive should be registered (implementation detail - verify no errors)
  expect(keepAliveFn).not.toHaveBeenCalled(); // Not called until timeout approaches
});
```

**Step 6: Run tests**

Run: `pnpm -C js test -- --testPathPattern="IdleTimeoutContext.test"`
Expected: All tests pass

**Step 7: Commit**

```bash
git add js/src/lib/hooks/__tests__/IdleTimeoutContext.test.tsx
git commit -s -m "test(hooks): add IdleTimeoutContext tests for Phase 2A"
```

---

### Task 4: IdleTimeoutContext Tests (@datarecce/ui)

**Files:**
- Create: `js/packages/ui/src/contexts/idle/__tests__/IdleTimeoutContext.test.tsx`
- Reference: `js/packages/ui/src/contexts/idle/IdleTimeoutContext.tsx`

**Step 1: Create test file with same tests as OSS**

(Same test structure as Task 3, adjusted imports)

**Step 2: Run tests**

Run: `pnpm -C js/packages/ui test -- --testPathPattern="IdleTimeoutContext.test"`
Expected: All tests pass (identical behavior to OSS)

**Step 3: Commit**

```bash
git add js/packages/ui/src/contexts/idle/__tests__/IdleTimeoutContext.test.tsx
git commit -s -m "test(ui): add IdleTimeoutContext tests for Phase 2A"
```

---

### Task 5: LineageGraphContext Tests (OSS)

**Files:**
- Create: `js/src/lib/hooks/__tests__/LineageGraphContext.test.tsx`
- Reference: `js/src/lib/hooks/LineageGraphContext.tsx`

**Step 1: Create test file**

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  LineageGraphContextProvider,
  useLineageGraphContext,
} from "../LineageGraphContext";

// Mock dependencies
jest.mock("@/lib/api/lineage", () => ({
  getServerInfo: jest.fn(),
}));

jest.mock("../useLineageWatcher", () => ({
  useLineageWatcher: jest.fn(() => ({
    connectionStatus: "connected",
    connect: jest.fn(),
    envStatus: { base: "ready", current: "ready" },
  })),
}));

import { getServerInfo } from "@/lib/api/lineage";

const mockGetServerInfo = getServerInfo as jest.MockedFunction<typeof getServerInfo>;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function TestConsumer() {
  const context = useLineageGraphContext();
  return (
    <div>
      <span data-testid="loading">{String(context.isLoading)}</span>
      <span data-testid="node-count">{context.lineageGraph?.nodes?.length ?? 0}</span>
      <span data-testid="connection">{context.connectionStatus}</span>
    </div>
  );
}
```

**Step 2: Write test for loading state**

```typescript
describe("LineageGraphContext (OSS)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading state initially", () => {
    mockGetServerInfo.mockImplementation(() => new Promise(() => {}));

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <LineageGraphContextProvider>
          <TestConsumer />
        </LineageGraphContextProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("true");
  });
});
```

**Step 3: Write test for successful data fetch**

```typescript
it("provides lineage graph after fetch", async () => {
  mockGetServerInfo.mockResolvedValue({
    lineage: {
      nodes: [{ id: "model.test" }],
      edges: [],
    },
    envInfo: { base: {}, current: {} },
  });

  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <LineageGraphContextProvider>
        <TestConsumer />
      </LineageGraphContextProvider>
    </QueryClientProvider>
  );

  await waitFor(() => {
    expect(screen.getByTestId("node-count")).toHaveTextContent("1");
  });
});
```

**Step 4: Write test for connection status**

```typescript
it("exposes connection status from WebSocket watcher", async () => {
  mockGetServerInfo.mockResolvedValue({
    lineage: { nodes: [], edges: [] },
    envInfo: {},
  });

  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <LineageGraphContextProvider>
        <TestConsumer />
      </LineageGraphContextProvider>
    </QueryClientProvider>
  );

  await waitFor(() => {
    expect(screen.getByTestId("connection")).toHaveTextContent("connected");
  });
});
```

**Step 5: Run tests**

Run: `pnpm -C js test -- --testPathPattern="LineageGraphContext.test"`
Expected: All tests pass

**Step 6: Commit**

```bash
git add js/src/lib/hooks/__tests__/LineageGraphContext.test.tsx
git commit -s -m "test(hooks): add LineageGraphContext tests for Phase 2A"
```

---

### Task 6: LineageGraphContext Tests (@datarecce/ui)

**Files:**
- Create: `js/packages/ui/src/contexts/lineage/__tests__/LineageGraphContext.test.tsx`
- Reference: `js/packages/ui/src/contexts/lineage/LineageGraphContext.tsx`

**Step 1: Create test file for props-driven provider**

```typescript
import { render, screen } from "@testing-library/react";
import {
  LineageGraphProvider,
  useLineageGraphContext,
} from "../LineageGraphContext";

function TestConsumer() {
  const context = useLineageGraphContext();
  return (
    <div>
      <span data-testid="loading">{String(context.isLoading)}</span>
      <span data-testid="node-count">{context.lineageGraph?.nodes?.length ?? 0}</span>
      <span data-testid="error">{context.error ?? "none"}</span>
    </div>
  );
}
```

**Step 2: Write test for props-driven loading state**

```typescript
describe("LineageGraphContext (@datarecce/ui - props-driven)", () => {
  it("reflects isLoading prop", () => {
    render(
      <LineageGraphProvider isLoading={true}>
        <TestConsumer />
      </LineageGraphProvider>
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("true");
  });

  it("reflects isLoading=false when data provided", () => {
    render(
      <LineageGraphProvider
        isLoading={false}
        lineageGraph={{ nodes: [], edges: [] }}
      >
        <TestConsumer />
      </LineageGraphProvider>
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });
});
```

**Step 3: Write test for lineage graph data**

```typescript
it("provides lineage graph from props", () => {
  render(
    <LineageGraphProvider
      lineageGraph={{ nodes: [{ id: "model.a" }, { id: "model.b" }], edges: [] }}
    >
      <TestConsumer />
    </LineageGraphProvider>
  );

  expect(screen.getByTestId("node-count")).toHaveTextContent("2");
});
```

**Step 4: Write test for error prop**

```typescript
it("provides error from props", () => {
  render(
    <LineageGraphProvider error="Failed to load lineage">
      <TestConsumer />
    </LineageGraphProvider>
  );

  expect(screen.getByTestId("error")).toHaveTextContent("Failed to load lineage");
});
```

**Step 5: Run tests**

Run: `pnpm -C js/packages/ui test -- --testPathPattern="LineageGraphContext.test"`
Expected: All tests pass

**Step 6: Commit**

```bash
git add js/packages/ui/src/contexts/lineage/__tests__/LineageGraphContext.test.tsx
git commit -s -m "test(ui): add LineageGraphContext tests for Phase 2A"
```

---

### Task 7: RecceActionContext Tests (OSS)

**Files:**
- Create: `js/src/lib/hooks/__tests__/RecceActionContext.test.tsx`
- Reference: `js/src/lib/hooks/RecceActionContext.tsx`

**Step 1: Create test file**

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RecceActionContextProvider,
  useRecceActionContext,
} from "../RecceActionContext";

// Mock dependencies
jest.mock("@/lib/api/runs", () => ({
  submitRun: jest.fn(),
}));

import { submitRun } from "@/lib/api/runs";

const mockSubmitRun = submitRun as jest.MockedFunction<typeof submitRun>;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function TestConsumer() {
  const { runAction, isRunning, currentRunId } = useRecceActionContext();
  return (
    <div>
      <span data-testid="running">{String(isRunning)}</span>
      <span data-testid="run-id">{currentRunId ?? "none"}</span>
      <button onClick={() => runAction("row_count_diff", { node_id: "model.test" })}>
        Run
      </button>
    </div>
  );
}
```

**Step 2: Write test for initial state**

```typescript
describe("RecceActionContext (OSS)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts with isRunning=false", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RecceActionContextProvider>
          <TestConsumer />
        </RecceActionContextProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("running")).toHaveTextContent("false");
    expect(screen.getByTestId("run-id")).toHaveTextContent("none");
  });
});
```

**Step 3: Write test for runAction**

```typescript
it("calls submitRun when runAction is invoked", async () => {
  mockSubmitRun.mockResolvedValue({ run_id: "run-123" });

  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RecceActionContextProvider>
        <TestConsumer />
      </RecceActionContextProvider>
    </QueryClientProvider>
  );

  fireEvent.click(screen.getByText("Run"));

  await waitFor(() => {
    expect(mockSubmitRun).toHaveBeenCalledWith(
      "row_count_diff",
      { node_id: "model.test" },
      expect.anything()
    );
  });
});
```

**Step 4: Run tests**

Run: `pnpm -C js test -- --testPathPattern="RecceActionContext.test"`
Expected: All tests pass

**Step 5: Commit**

```bash
git add js/src/lib/hooks/__tests__/RecceActionContext.test.tsx
git commit -s -m "test(hooks): add RecceActionContext tests for Phase 2A"
```

---

### Task 8: RecceActionContext Tests (@datarecce/ui)

**Files:**
- Create: `js/packages/ui/src/contexts/action/__tests__/RecceActionContext.test.tsx`
- Reference: `js/packages/ui/src/contexts/action/RecceActionContext.tsx`

**Step 1: Create test file for props-driven provider**

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RecceActionProvider,
  useRecceActionContext,
} from "../RecceActionContext";

function TestConsumer() {
  const { runAction, isRunning, currentRunId } = useRecceActionContext();
  return (
    <div>
      <span data-testid="running">{String(isRunning)}</span>
      <span data-testid="run-id">{currentRunId ?? "none"}</span>
      <button onClick={() => runAction("row_count_diff", { node_id: "model.test" })}>
        Run
      </button>
    </div>
  );
}
```

**Step 2: Write test for props-driven callbacks**

```typescript
describe("RecceActionContext (@datarecce/ui - props-driven)", () => {
  it("reflects isRunning prop", () => {
    render(
      <RecceActionProvider isRunning={true} currentRunId="run-456">
        <TestConsumer />
      </RecceActionProvider>
    );

    expect(screen.getByTestId("running")).toHaveTextContent("true");
    expect(screen.getByTestId("run-id")).toHaveTextContent("run-456");
  });

  it("calls onRunAction callback when runAction invoked", () => {
    const onRunAction = jest.fn();

    render(
      <RecceActionProvider onRunAction={onRunAction}>
        <TestConsumer />
      </RecceActionProvider>
    );

    fireEvent.click(screen.getByText("Run"));

    expect(onRunAction).toHaveBeenCalledWith("row_count_diff", { node_id: "model.test" });
  });
});
```

**Step 3: Run tests**

Run: `pnpm -C js/packages/ui test -- --testPathPattern="RecceActionContext.test"`
Expected: All tests pass

**Step 4: Commit**

```bash
git add js/packages/ui/src/contexts/action/__tests__/RecceActionContext.test.tsx
git commit -s -m "test(ui): add RecceActionContext tests for Phase 2A"
```

---

### Task 9: RecceCheckContext Tests (OSS)

**Files:**
- Create: `js/src/lib/hooks/__tests__/RecceCheckContext.test.tsx`
- Reference: `js/src/lib/hooks/RecceCheckContext.tsx`

**Step 1: Create test file**

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RecceCheckContextProvider,
  useRecceCheckContext,
} from "../RecceCheckContext";

function TestConsumer() {
  const { latestSelectedCheckId, setLatestSelectedCheckId } = useRecceCheckContext();
  return (
    <div>
      <span data-testid="selected">{latestSelectedCheckId || "none"}</span>
      <button onClick={() => setLatestSelectedCheckId("check-123")}>
        Select Check
      </button>
    </div>
  );
}
```

**Step 2: Write test for initial state**

```typescript
describe("RecceCheckContext (OSS)", () => {
  it("starts with empty selection", () => {
    render(
      <RecceCheckContextProvider>
        <TestConsumer />
      </RecceCheckContextProvider>
    );

    expect(screen.getByTestId("selected")).toHaveTextContent("none");
  });
});
```

**Step 3: Write test for selection update**

```typescript
it("updates selection when setLatestSelectedCheckId called", () => {
  render(
    <RecceCheckContextProvider>
      <TestConsumer />
    </RecceCheckContextProvider>
  );

  fireEvent.click(screen.getByText("Select Check"));

  expect(screen.getByTestId("selected")).toHaveTextContent("check-123");
});
```

**Step 4: Run tests**

Run: `pnpm -C js test -- --testPathPattern="RecceCheckContext.test"`
Expected: All tests pass

**Step 5: Commit**

```bash
git add js/src/lib/hooks/__tests__/RecceCheckContext.test.tsx
git commit -s -m "test(hooks): add RecceCheckContext tests for Phase 2A"
```

---

### Task 10: CheckContext Tests (@datarecce/ui)

**Files:**
- Create: `js/packages/ui/src/providers/contexts/__tests__/CheckContext.test.tsx`
- Reference: `js/packages/ui/src/providers/contexts/CheckContext.tsx`

**Step 1: Create test file**

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CheckProvider, useCheckContext } from "../CheckContext";

function TestConsumer() {
  const context = useCheckContext();
  return (
    <div>
      <span data-testid="count">{context.checks.length}</span>
      <span data-testid="loading">{String(context.isLoading)}</span>
      <span data-testid="selected">{context.selectedCheckId ?? "none"}</span>
      <button onClick={() => context.onSelectCheck?.("check-456")}>
        Select
      </button>
    </div>
  );
}
```

**Step 2: Write test for props-driven data**

```typescript
describe("CheckContext (@datarecce/ui)", () => {
  it("provides checks from props", () => {
    render(
      <CheckProvider checks={[{ id: "1" }, { id: "2" }]} isLoading={false}>
        <TestConsumer />
      </CheckProvider>
    );

    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });

  it("reflects loading state", () => {
    render(
      <CheckProvider checks={[]} isLoading={true}>
        <TestConsumer />
      </CheckProvider>
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("true");
  });
});
```

**Step 3: Write test for selection callback**

```typescript
it("calls onSelectCheck callback", () => {
  const onSelectCheck = jest.fn();

  render(
    <CheckProvider
      checks={[]}
      isLoading={false}
      onSelectCheck={onSelectCheck}
    >
      <TestConsumer />
    </CheckProvider>
  );

  fireEvent.click(screen.getByText("Select"));

  expect(onSelectCheck).toHaveBeenCalledWith("check-456");
});
```

**Step 4: Run tests**

Run: `pnpm -C js/packages/ui test -- --testPathPattern="CheckContext.test"`
Expected: All tests pass

**Step 5: Commit**

```bash
git add js/packages/ui/src/providers/contexts/__tests__/CheckContext.test.tsx
git commit -s -m "test(ui): add CheckContext tests for Phase 2A"
```

---

### Task 11: RecceQueryContext Tests (OSS)

**Files:**
- Create: `js/src/lib/hooks/__tests__/RecceQueryContext.test.tsx`
- Reference: `js/src/lib/hooks/RecceQueryContext.tsx`

**Step 1: Create test file**

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RecceQueryContextProvider,
  useRecceQueryContext,
} from "../RecceQueryContext";

function TestConsumer() {
  const { sqlQuery, setSqlQuery, primaryKeys, setPrimaryKeys } = useRecceQueryContext();
  return (
    <div>
      <span data-testid="sql">{sqlQuery || "empty"}</span>
      <span data-testid="pks">{primaryKeys?.join(",") || "none"}</span>
      <button onClick={() => setSqlQuery("SELECT * FROM users")}>Set SQL</button>
      <button onClick={() => setPrimaryKeys(["id", "name"])}>Set PKs</button>
    </div>
  );
}
```

**Step 2: Write tests**

```typescript
describe("RecceQueryContext (OSS)", () => {
  it("starts with empty query", () => {
    render(
      <RecceQueryContextProvider>
        <TestConsumer />
      </RecceQueryContextProvider>
    );

    expect(screen.getByTestId("sql")).toHaveTextContent("empty");
  });

  it("updates SQL query", () => {
    render(
      <RecceQueryContextProvider>
        <TestConsumer />
      </RecceQueryContextProvider>
    );

    fireEvent.click(screen.getByText("Set SQL"));

    expect(screen.getByTestId("sql")).toHaveTextContent("SELECT * FROM users");
  });

  it("updates primary keys", () => {
    render(
      <RecceQueryContextProvider>
        <TestConsumer />
      </RecceQueryContextProvider>
    );

    fireEvent.click(screen.getByText("Set PKs"));

    expect(screen.getByTestId("pks")).toHaveTextContent("id,name");
  });
});
```

**Step 3: Run tests**

Run: `pnpm -C js test -- --testPathPattern="RecceQueryContext.test"`
Expected: All tests pass

**Step 4: Commit**

```bash
git add js/src/lib/hooks/__tests__/RecceQueryContext.test.tsx
git commit -s -m "test(hooks): add RecceQueryContext tests for Phase 2A"
```

---

### Task 12: QueryContext Tests (@datarecce/ui)

**Files:**
- Create: `js/packages/ui/src/providers/contexts/__tests__/QueryContext.test.tsx`
- Reference: `js/packages/ui/src/providers/contexts/QueryContext.tsx`

**Step 1: Create test file**

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryProvider, useQueryContext } from "../QueryContext";

function TestConsumer() {
  const context = useQueryContext();
  return (
    <div>
      <span data-testid="sql">{context.sql || "empty"}</span>
      <span data-testid="executing">{String(context.isExecuting)}</span>
      <button onClick={() => context.onSqlChange?.("SELECT 1")}>Change SQL</button>
      <button onClick={() => context.onExecute?.("SELECT 1")}>Execute</button>
    </div>
  );
}
```

**Step 2: Write tests**

```typescript
describe("QueryContext (@datarecce/ui)", () => {
  it("provides sql from props", () => {
    render(
      <QueryProvider sql="SELECT * FROM orders" isExecuting={false}>
        <TestConsumer />
      </QueryProvider>
    );

    expect(screen.getByTestId("sql")).toHaveTextContent("SELECT * FROM orders");
  });

  it("reflects executing state", () => {
    render(
      <QueryProvider sql="" isExecuting={true}>
        <TestConsumer />
      </QueryProvider>
    );

    expect(screen.getByTestId("executing")).toHaveTextContent("true");
  });

  it("calls onSqlChange callback", () => {
    const onSqlChange = jest.fn();

    render(
      <QueryProvider sql="" isExecuting={false} onSqlChange={onSqlChange}>
        <TestConsumer />
      </QueryProvider>
    );

    fireEvent.click(screen.getByText("Change SQL"));

    expect(onSqlChange).toHaveBeenCalledWith("SELECT 1");
  });

  it("calls onExecute callback", () => {
    const onExecute = jest.fn();

    render(
      <QueryProvider sql="" isExecuting={false} onExecute={onExecute}>
        <TestConsumer />
      </QueryProvider>
    );

    fireEvent.click(screen.getByText("Execute"));

    expect(onExecute).toHaveBeenCalledWith("SELECT 1");
  });
});
```

**Step 3: Run tests**

Run: `pnpm -C js/packages/ui test -- --testPathPattern="QueryContext.test"`
Expected: All tests pass

**Step 4: Commit**

```bash
git add js/packages/ui/src/providers/contexts/__tests__/QueryContext.test.tsx
git commit -s -m "test(ui): add QueryContext tests for Phase 2A"
```

---

### Task 13: ApiConfigContext Tests (OSS + @datarecce/ui)

**Files:**
- Create: `js/src/lib/hooks/__tests__/ApiConfigContext.test.tsx`
- Create: `js/packages/ui/src/providers/contexts/__tests__/ApiContext.test.tsx`

**Step 1: Create OSS test file**

```typescript
import { render, screen } from "@testing-library/react";
import { ApiConfigProvider, useApiConfig } from "../ApiConfigContext";

function TestConsumer() {
  const config = useApiConfig();
  return (
    <div>
      <span data-testid="base-url">{config.baseUrl}</span>
    </div>
  );
}

describe("ApiConfigContext (OSS)", () => {
  it("returns default config without provider", () => {
    render(<TestConsumer />);
    expect(screen.getByTestId("base-url")).toHaveTextContent("/api");
  });

  it("returns provided config with provider", () => {
    render(
      <ApiConfigProvider baseUrl="https://api.example.com">
        <TestConsumer />
      </ApiConfigProvider>
    );
    expect(screen.getByTestId("base-url")).toHaveTextContent("https://api.example.com");
  });
});
```

**Step 2: Create @datarecce/ui test file**

```typescript
import { render, screen } from "@testing-library/react";
import { ApiProvider, useApiConfig } from "../ApiContext";

function TestConsumer() {
  const config = useApiConfig();
  return (
    <div>
      <span data-testid="base-url">{config.baseUrl}</span>
    </div>
  );
}

describe("ApiContext (@datarecce/ui)", () => {
  it("throws without provider", () => {
    // Suppress React error boundary logging
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      "useApiConfig must be used within RecceProvider"
    );

    spy.mockRestore();
  });

  it("returns provided config with provider", () => {
    render(
      <ApiProvider baseUrl="https://api.example.com">
        <TestConsumer />
      </ApiProvider>
    );
    expect(screen.getByTestId("base-url")).toHaveTextContent("https://api.example.com");
  });
});
```

**Step 3: Run tests**

Run: `pnpm -C js test -- --testPathPattern="ApiConfigContext.test"`
Run: `pnpm -C js/packages/ui test -- --testPathPattern="ApiContext.test"`
Expected: All tests pass

**Step 4: Commit**

```bash
git add js/src/lib/hooks/__tests__/ApiConfigContext.test.tsx
git add js/packages/ui/src/providers/contexts/__tests__/ApiContext.test.tsx
git commit -s -m "test(hooks,ui): add ApiConfigContext and ApiContext tests for Phase 2A"
```

---

## Phase 2B: IDENTICAL Contexts Migration

### Task 14: Export contexts from @datarecce/ui

**Files:**
- Modify: `js/packages/ui/src/contexts/index.ts`

**Step 1: Update exports**

```typescript
// js/packages/ui/src/contexts/index.ts
export {
  RecceInstanceInfoProvider,
  useRecceInstanceInfo,
  useRecceFeatureToggles,
  type RecceFeatureToggles,
  type InstanceInfoType,
} from "./instance";

export {
  IdleTimeoutProvider,
  useIdleTimeout,
  useIdleTimeoutSafe,
  useIdleDetection,
  type IdleTimeoutContextType,
} from "./idle";
```

**Step 2: Run type check**

Run: `pnpm -C js type:check`
Expected: No errors

**Step 3: Commit**

```bash
git add js/packages/ui/src/contexts/index.ts
git commit -s -m "feat(ui): export RecceInstanceContext and IdleTimeoutContext"
```

---

### Task 15: Switch RecceInstanceContext imports in OSS

**Files:**
- Modify: All files importing from `@/lib/hooks/RecceInstanceContext`

**Step 1: Find all imports**

```bash
grep -r "from.*RecceInstanceContext" js/src --include="*.tsx" --include="*.ts"
```

**Step 2: Update imports**

```typescript
// Before
import { useRecceInstanceInfo } from "@/lib/hooks/RecceInstanceContext";

// After
import { useRecceInstanceInfo } from "@datarecce/ui/contexts";
```

**Step 3: Run tests**

Run: `pnpm -C js test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add -u
git commit -s -m "refactor: switch RecceInstanceContext imports to @datarecce/ui"
```

---

### Task 16: Switch IdleTimeoutContext imports in OSS

**Files:**
- Modify: All files importing from `@/lib/hooks/IdleTimeoutContext`

**Step 1: Find and update imports** (same process as Task 15)

**Step 2: Run tests**

Run: `pnpm -C js test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add -u
git commit -s -m "refactor: switch IdleTimeoutContext imports to @datarecce/ui"
```

---

### Task 17: Delete OSS duplicates

**Files:**
- Delete: `js/src/lib/hooks/RecceInstanceContext.tsx`
- Delete: `js/src/lib/hooks/IdleTimeoutContext.tsx`

**Step 1: Remove files**

```bash
rm js/src/lib/hooks/RecceInstanceContext.tsx
rm js/src/lib/hooks/IdleTimeoutContext.tsx
```

**Step 2: Run tests**

Run: `pnpm -C js test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add -u
git commit -s -m "refactor: remove duplicate RecceInstanceContext and IdleTimeoutContext"
```

---

## Phase 2C: ApiConfigContext Migration

### Task 18: Add useApiConfigOptional to @datarecce/ui

**Files:**
- Modify: `js/packages/ui/src/providers/contexts/ApiContext.tsx`

**Step 1: Add optional hook**

```typescript
// Add to ApiContext.tsx
export function useApiConfigOptional(): ApiContextValue | null {
  return useContext(ApiContext);
}
```

**Step 2: Update exports**

```typescript
// packages/ui/src/providers/contexts/index.ts
export { ApiProvider, useApiConfig, useApiConfigOptional } from "./ApiContext";
```

**Step 3: Add test**

```typescript
it("useApiConfigOptional returns null without provider", () => {
  function OptionalConsumer() {
    const config = useApiConfigOptional();
    return <span data-testid="result">{config ? config.baseUrl : "no-provider"}</span>;
  }

  render(<OptionalConsumer />);
  expect(screen.getByTestId("result")).toHaveTextContent("no-provider");
});
```

**Step 4: Run tests**

Run: `pnpm -C js/packages/ui test -- --testPathPattern="ApiContext.test"`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -u
git commit -s -m "feat(ui): add useApiConfigOptional hook for fallback support"
```

---

### Task 19: Update OSS to use @datarecce/ui ApiContext with fallback

**Files:**
- Modify: `js/src/lib/hooks/ApiConfigContext.tsx`

**Step 1: Wrap @datarecce/ui with fallback**

```typescript
import { useApiConfigOptional, ApiProvider } from "@datarecce/ui/contexts";

const defaultApiConfig: ApiConfigContextType = {
  baseUrl: "/api",
  // ... other defaults
};

export function useApiConfig(): ApiConfigContextType {
  const contextValue = useApiConfigOptional();
  return contextValue ?? defaultApiConfig;
}

// Re-export provider for compatibility
export { ApiProvider as ApiConfigProvider };
```

**Step 2: Run tests**

Run: `pnpm -C js test -- --testPathPattern="ApiConfigContext.test"`
Expected: All tests pass

**Step 3: Commit**

```bash
git add -u
git commit -s -m "refactor: switch ApiConfigContext to use @datarecce/ui with fallback"
```

---

## Phase 2D: PROPS-DRIVEN Adapters

### Task 20: Create LineageGraphAdapter

**Files:**
- Create: `js/src/lib/hooks/adapters/LineageGraphAdapter.tsx`
- Modify: `js/src/lib/hooks/RecceContextProvider.tsx`

**Step 1: Create adapter file**

```typescript
// js/src/lib/hooks/adapters/LineageGraphAdapter.tsx
import { LineageGraphProvider } from "@datarecce/ui/contexts";
import { useQuery } from "@tanstack/react-query";
import { useLineageWatcher } from "../useLineageWatcher";
import { getServerInfo } from "@/lib/api/lineage";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useApiConfig } from "../ApiConfigContext";
import { ServerDisconnectedModal } from "@/components/lineage/ServerDisconnectedModal";

interface LineageGraphAdapterProps {
  children: React.ReactNode;
}

export function LineageGraphAdapter({ children }: LineageGraphAdapterProps) {
  const { apiClient } = useApiConfig();

  // Data fetching (OSS-specific)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: cacheKeys.lineage(),
    queryFn: () => getServerInfo(apiClient),
  });

  // WebSocket handling (OSS-specific)
  const { connectionStatus, connect, envStatus } = useLineageWatcher({
    onReconnect: refetch,
  });

  return (
    <>
      <LineageGraphProvider
        lineageGraph={data?.lineage}
        envInfo={data?.envInfo}
        isLoading={isLoading}
        error={error?.message}
        onRefetchLineageGraph={refetch}
        connectionStatus={connectionStatus}
        envStatus={envStatus}
      >
        {children}
      </LineageGraphProvider>

      {/* OSS-specific UI */}
      <ServerDisconnectedModal
        open={connectionStatus === "disconnected"}
        onReconnect={connect}
      />
    </>
  );
}
```

**Step 2: Add adapter tests**

```typescript
// js/src/lib/hooks/adapters/__tests__/LineageGraphAdapter.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LineageGraphAdapter } from "../LineageGraphAdapter";
import { useLineageGraphContext } from "@datarecce/ui/contexts";

// ... mock setup ...

function TestConsumer() {
  const context = useLineageGraphContext();
  return <span data-testid="loading">{String(context.isLoading)}</span>;
}

describe("LineageGraphAdapter", () => {
  it("provides context from fetched data", async () => {
    mockGetServerInfo.mockResolvedValue({
      lineage: { nodes: [], edges: [] },
      envInfo: {},
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <LineageGraphAdapter>
          <TestConsumer />
        </LineageGraphAdapter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
  });
});
```

**Step 3: Run tests**

Run: `pnpm -C js test -- --testPathPattern="LineageGraphAdapter.test"`
Expected: All tests pass

**Step 4: Commit**

```bash
git add js/src/lib/hooks/adapters/
git commit -s -m "feat(hooks): add LineageGraphAdapter for @datarecce/ui integration"
```

---

### Task 21: Create RecceActionAdapter

**Files:**
- Create: `js/src/lib/hooks/adapters/RecceActionAdapter.tsx`

**Step 1: Create adapter file**

```typescript
// js/src/lib/hooks/adapters/RecceActionAdapter.tsx
import { RecceActionProvider } from "@datarecce/ui/contexts";
import { useState } from "react";
import { submitRun } from "@/lib/api/runs";
import { useApiConfig } from "../ApiConfigContext";
import { useQueryClient } from "@tanstack/react-query";
import { RunModal } from "@/components/run/RunModal";

interface RecceActionAdapterProps {
  children: React.ReactNode;
}

export function RecceActionAdapter({ children }: RecceActionAdapterProps) {
  const { apiClient } = useApiConfig();
  const queryClient = useQueryClient();

  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [showRunModal, setShowRunModal] = useState(false);

  const handleRunAction = async (type: string, params: Record<string, unknown>) => {
    setIsRunning(true);
    try {
      const result = await submitRun(type, params, {}, apiClient);
      setCurrentRunId(result.run_id);
      setShowRunModal(true);
      // Invalidate queries after run completes
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      return result;
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <RecceActionProvider
        isRunning={isRunning}
        currentRunId={currentRunId}
        onRunAction={handleRunAction}
        onShowRunId={(runId) => {
          setCurrentRunId(runId);
          setShowRunModal(true);
        }}
      >
        {children}
      </RecceActionProvider>

      {/* OSS-specific UI */}
      <RunModal
        open={showRunModal}
        runId={currentRunId}
        onClose={() => setShowRunModal(false)}
      />
    </>
  );
}
```

**Step 2: Add adapter tests** (similar structure to Task 20)

**Step 3: Run tests**

Run: `pnpm -C js test -- --testPathPattern="RecceActionAdapter.test"`
Expected: All tests pass

**Step 4: Commit**

```bash
git add js/src/lib/hooks/adapters/RecceActionAdapter.tsx
git commit -s -m "feat(hooks): add RecceActionAdapter for @datarecce/ui integration"
```

---

### Task 22: Update RecceContextProvider to use adapters

**Files:**
- Modify: `js/src/lib/hooks/RecceContextProvider.tsx`

**Step 1: Replace context providers with adapters**

```typescript
// Before
<LineageGraphContextProvider>
  <RecceActionContextProvider>
    {children}
  </RecceActionContextProvider>
</LineageGraphContextProvider>

// After
import { LineageGraphAdapter } from "./adapters/LineageGraphAdapter";
import { RecceActionAdapter } from "./adapters/RecceActionAdapter";

<LineageGraphAdapter>
  <RecceActionAdapter>
    {children}
  </RecceActionAdapter>
</LineageGraphAdapter>
```

**Step 2: Run all tests**

Run: `pnpm -C js test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add -u
git commit -s -m "refactor: use adapters for LineageGraph and RecceAction contexts"
```

---

### Task 23: Delete old OSS context files

**Files:**
- Delete: `js/src/lib/hooks/LineageGraphContext.tsx`
- Delete: `js/src/lib/hooks/RecceActionContext.tsx`

**Step 1: Remove files**

```bash
rm js/src/lib/hooks/LineageGraphContext.tsx
rm js/src/lib/hooks/RecceActionContext.tsx
```

**Step 2: Run tests**

Run: `pnpm -C js test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add -u
git commit -s -m "refactor: remove old LineageGraphContext and RecceActionContext"
```

---

## Phase 2E: Interface Merge

### Task 24: Extend CheckContext with OSS aliases

**Files:**
- Modify: `js/packages/ui/src/providers/contexts/CheckContext.tsx`

**Step 1: Add backward compatibility aliases**

```typescript
export interface CheckContextType {
  // Existing @datarecce/ui interface
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

  // === OSS backward compatibility aliases ===
  /** @deprecated Use selectedCheckId instead */
  latestSelectedCheckId?: string;
  /** @deprecated Use onSelectCheck instead */
  setLatestSelectedCheckId?: (id: string) => void;
}
```

**Step 2: Update provider to pass aliases**

```typescript
const contextValue: CheckContextType = {
  // ... existing values ...

  // Aliases
  latestSelectedCheckId: selectedCheckId,
  setLatestSelectedCheckId: onSelectCheck,
};
```

**Step 3: Add tests for aliases**

```typescript
it("provides backward-compatible latestSelectedCheckId alias", () => {
  function AliasConsumer() {
    const { latestSelectedCheckId, setLatestSelectedCheckId } = useCheckContext();
    return (
      <div>
        <span data-testid="alias">{latestSelectedCheckId ?? "none"}</span>
        <button onClick={() => setLatestSelectedCheckId?.("check-789")}>
          Select via Alias
        </button>
      </div>
    );
  }

  const onSelectCheck = jest.fn();
  render(
    <CheckProvider
      checks={[]}
      isLoading={false}
      selectedCheckId="check-123"
      onSelectCheck={onSelectCheck}
    >
      <AliasConsumer />
    </CheckProvider>
  );

  expect(screen.getByTestId("alias")).toHaveTextContent("check-123");

  fireEvent.click(screen.getByText("Select via Alias"));
  expect(onSelectCheck).toHaveBeenCalledWith("check-789");
});
```

**Step 4: Run tests**

Run: `pnpm -C js/packages/ui test -- --testPathPattern="CheckContext.test"`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -u
git commit -s -m "feat(ui): add OSS backward-compatible aliases to CheckContext"
```

---

### Task 25: Create CheckContextAdapter

**Files:**
- Create: `js/src/lib/hooks/adapters/CheckContextAdapter.tsx`

**Step 1: Create adapter file**

```typescript
// js/src/lib/hooks/adapters/CheckContextAdapter.tsx
import { CheckProvider } from "@datarecce/ui/contexts";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChecks, createCheck, updateCheck, deleteCheck } from "@/lib/api/checks";
import { useApiConfig } from "../ApiConfigContext";
import { cacheKeys } from "@/lib/api/cacheKeys";

interface CheckContextAdapterProps {
  children: React.ReactNode;
}

export function CheckContextAdapter({ children }: CheckContextAdapterProps) {
  const { apiClient } = useApiConfig();
  const queryClient = useQueryClient();
  const [selectedCheckId, setSelectedCheckId] = useState<string>("");

  const { data: checks, isLoading, error, refetch } = useQuery({
    queryKey: cacheKeys.checks(),
    queryFn: () => getChecks(apiClient),
  });

  const createMutation = useMutation({
    mutationFn: (check: Partial<Check>) => createCheck(check, apiClient),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cacheKeys.checks() }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Check> }) =>
      updateCheck(id, updates, apiClient),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cacheKeys.checks() }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCheck(id, apiClient),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cacheKeys.checks() }),
  });

  return (
    <CheckProvider
      checks={checks ?? []}
      isLoading={isLoading}
      error={error?.message}
      selectedCheckId={selectedCheckId}
      onSelectCheck={setSelectedCheckId}
      onCreateCheck={createMutation.mutateAsync}
      onUpdateCheck={(id, updates) => updateMutation.mutateAsync({ id, updates })}
      onDeleteCheck={deleteMutation.mutateAsync}
      refetchChecks={refetch}
    >
      {children}
    </CheckProvider>
  );
}
```

**Step 2: Add adapter tests**

**Step 3: Run tests**

Run: `pnpm -C js test -- --testPathPattern="CheckContextAdapter.test"`
Expected: All tests pass

**Step 4: Commit**

```bash
git add js/src/lib/hooks/adapters/CheckContextAdapter.tsx
git commit -s -m "feat(hooks): add CheckContextAdapter for @datarecce/ui integration"
```

---

### Task 26: Extend QueryContext with OSS fields

**Files:**
- Modify: `js/packages/ui/src/providers/contexts/QueryContext.tsx`

**Step 1: Merge interfaces**

```typescript
export interface QueryContextType {
  // @datarecce/ui execution state
  sql: string;
  isExecuting: boolean;
  error?: string;
  baseResult?: QueryResult;
  currentResult?: QueryResult;
  onSqlChange?: (sql: string) => void;
  onExecute?: (sql: string) => Promise<void>;
  onCancel?: () => void;

  // === OSS input state (merged) ===
  sqlQuery?: string;  // Alias for sql
  setSqlQuery?: (sql: string) => void;  // Alias for onSqlChange
  primaryKeys?: string[];
  setPrimaryKeys?: (pks: string[] | undefined) => void;
  isCustomQueries?: boolean;
  baseSqlQuery?: string;
}
```

**Step 2: Update provider**

**Step 3: Add tests**

**Step 4: Run tests**

Run: `pnpm -C js/packages/ui test -- --testPathPattern="QueryContext.test"`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -u
git commit -s -m "feat(ui): merge OSS input state into QueryContext"
```

---

### Task 27: Create QueryContextAdapter

**Files:**
- Create: `js/src/lib/hooks/adapters/QueryContextAdapter.tsx`

(Similar structure to CheckContextAdapter)

**Step 1-5:** Create adapter, tests, run, commit

---

### Task 28: Update RecceContextProvider to use all adapters

**Files:**
- Modify: `js/src/lib/hooks/RecceContextProvider.tsx`

**Step 1: Use all adapters**

```typescript
import { LineageGraphAdapter } from "./adapters/LineageGraphAdapter";
import { RecceActionAdapter } from "./adapters/RecceActionAdapter";
import { CheckContextAdapter } from "./adapters/CheckContextAdapter";
import { QueryContextAdapter } from "./adapters/QueryContextAdapter";

export function RecceContextProvider({ children }: Props) {
  return (
    <LineageGraphAdapter>
      <RecceActionAdapter>
        <CheckContextAdapter>
          <QueryContextAdapter>
            {children}
          </QueryContextAdapter>
        </CheckContextAdapter>
      </RecceActionAdapter>
    </LineageGraphAdapter>
  );
}
```

**Step 2: Run all tests**

Run: `pnpm -C js test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add -u
git commit -s -m "refactor: use all context adapters in RecceContextProvider"
```

---

### Task 29: Delete old OSS context files

**Files:**
- Delete: `js/src/lib/hooks/RecceCheckContext.tsx`
- Delete: `js/src/lib/hooks/RecceQueryContext.tsx`

**Step 1: Remove files**

```bash
rm js/src/lib/hooks/RecceCheckContext.tsx
rm js/src/lib/hooks/RecceQueryContext.tsx
```

**Step 2: Run all tests**

Run: `pnpm -C js test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add -u
git commit -s -m "refactor: remove old RecceCheckContext and RecceQueryContext"
```

---

### Task 30: Final verification

**Step 1: Run full test suite**

```bash
pnpm -C js test
pnpm -C js type:check
pnpm -C js lint
```

**Step 2: Verify all imports are from @datarecce/ui**

```bash
# Should return no results
grep -r "from.*@/lib/hooks/RecceInstanceContext" js/src
grep -r "from.*@/lib/hooks/IdleTimeoutContext" js/src
grep -r "from.*@/lib/hooks/LineageGraphContext" js/src
grep -r "from.*@/lib/hooks/RecceActionContext" js/src
grep -r "from.*@/lib/hooks/RecceCheckContext" js/src
grep -r "from.*@/lib/hooks/RecceQueryContext" js/src
```

**Step 3: Document completion**

Update `docs/plans/2026-01-04-context-unification-analysis.md` with completion status.

**Step 4: Commit**

```bash
git add -u
git commit -s -m "docs: mark Context Unification Phase 2 complete"
```

---

## Success Criteria

- [ ] All 13 test files created (Phase 2A)
- [ ] RecceInstanceContext imports switched to @datarecce/ui
- [ ] IdleTimeoutContext imports switched to @datarecce/ui
- [ ] ApiConfigContext uses @datarecce/ui with fallback
- [ ] LineageGraphAdapter created and integrated
- [ ] RecceActionAdapter created and integrated
- [ ] CheckContext extended with OSS aliases
- [ ] CheckContextAdapter created and integrated
- [ ] QueryContext extended with OSS fields
- [ ] QueryContextAdapter created and integrated
- [ ] All old OSS context files deleted
- [ ] Full test suite passes
- [ ] No breaking changes to existing consumers

---

## References

- [Phase 1: Hooks Migration](./2026-01-04-hooks-context-migration-design.md)
- [Context Analysis](./2026-01-04-context-unification-analysis.md)
- [@datarecce/ui RecceProvider](../../js/packages/ui/src/providers/RecceProvider.tsx)
