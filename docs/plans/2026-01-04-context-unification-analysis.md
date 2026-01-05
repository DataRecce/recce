# Context Unification Analysis - Phase 2

**Date:** 2026-01-04
**Status:** ✅ Complete (Analysis complete, implementation in 2026-01-04-context-unification-implementation.md)
**Goal:** Understand context interfaces to determine migration strategy for Recce OSS to consume @datarecce/ui

---

## Executive Summary

After thorough investigation of all contexts in both OSS and @datarecce/ui, I found:

1. **Three categories of contexts exist:**
   - **IDENTICAL** - Same implementation, just different imports
   - **PROPS-DRIVEN** - @datarecce/ui version is headless, OSS has data fetching + UI
   - **DIFFERENT PURPOSE** - Contexts have different responsibilities

2. **ZERO tests exist for any context** in either OSS or @datarecce/ui

3. **The design doc's claim was partially correct** - Some @datarecce/ui contexts ARE props-driven, but not all

---

## Context Analysis Matrix

| Context | OSS Location | @datarecce/ui Location | Similarity | Data Fetching | Migration Strategy |
|---------|--------------|------------------------|------------|---------------|-------------------|
| **RecceInstanceContext** | `hooks/RecceInstanceContext.tsx` | `contexts/instance/` | IDENTICAL | Both fetch via useQuery | DELETE OSS, use @datarecce/ui |
| **IdleTimeoutContext** | `hooks/IdleTimeoutContext.tsx` | `contexts/idle/` | IDENTICAL | Both fetch via useRecceInstanceInfo | DELETE OSS, use @datarecce/ui |
| **LineageGraphContext** | `hooks/LineageGraphContext.tsx` | `contexts/lineage/` | DIFFERENT | OSS fetches + WebSocket + UI modals; @datarecce/ui is props-driven | CREATE ADAPTER |
| **RecceActionContext** | `hooks/RecceActionContext.tsx` | `contexts/action/` | DIFFERENT | OSS has submitRun + RunModal; @datarecce/ui is props-driven | CREATE ADAPTER |
| **RecceCheckContext** | `hooks/RecceCheckContext.tsx` | `providers/contexts/CheckContext.tsx` | DIFFERENT PURPOSE | OSS: selection only; @datarecce/ui: full CRUD | KEEP BOTH or EXTEND OSS |
| **RecceQueryContext** | `hooks/RecceQueryContext.tsx` | `providers/contexts/QueryContext.tsx` | DIFFERENT PURPOSE | OSS: input state; @datarecce/ui: execution state | KEEP BOTH or MERGE |
| **ApiConfigContext** | `hooks/ApiConfigContext.tsx` | `providers/contexts/ApiContext.tsx` | SIMILAR | OSS optional provider; @datarecce/ui required | MIGRATE with fallback |

---

## Detailed Findings

### Category 1: IDENTICAL (Easy Migration)

#### RecceInstanceContext
**OSS:** 130 lines, uses `useRecceInstanceInfo` → `useQuery` → `getRecceInstanceInfo(apiClient)`
**@datarecce/ui:** 147 lines, identical logic with better documentation

**Proof of equivalence:**
- Same `RecceFeatureToggles` interface
- Same `InstanceInfoType` interface
- Same feature toggle computation logic (server_mode checks)
- Same context value structure

**Migration:** Direct switch - OSS can import from `@datarecce/ui/contexts`

#### IdleTimeoutContext
**OSS:** 178 lines with `useIdleDetection` companion
**@datarecce/ui:** 178 lines with identical `useIdleDetection` companion

**Proof of equivalence:**
- Same `IdleTimeoutContextType` interface
- Same keep-alive callback system
- Same countdown logic
- Same `useIdleTimeoutSafe` hook

**Migration:** Direct switch - OSS can import from `@datarecce/ui/contexts`

---

### Category 2: PROPS-DRIVEN (Adapter Required)

#### LineageGraphContext
**OSS (513 lines) - Has internal data fetching + UI:**
```typescript
// Internal data fetching
const queryServerInfo = useQuery({
  queryKey: cacheKeys.lineage(),
  queryFn: () => getServerInfo(apiClient),
});

// WebSocket handling
const { connectionStatus, connect, envStatus } = useLineageWatcher({...});

// UI modals
<MuiDialog open={connectionStatus === "disconnected"}>
  <ServerDisconnectedModalContent ... />
</MuiDialog>
```

**@datarecce/ui (198 lines) - Props-driven:**
```typescript
export interface LineageGraphProviderProps {
  lineageGraph?: LineageGraph;
  envInfo?: EnvInfo;
  isLoading?: boolean;
  error?: string;
  onRefetchLineageGraph?: () => void;
  // ... all data passed as props
}
```

**Migration Strategy:**
1. Create OSS adapter that wraps @datarecce/ui's `LineageGraphProvider`
2. Adapter does the data fetching
3. Adapter handles WebSocket
4. Adapter renders disconnect/relaunch modals
5. Pass data to provider as props

#### RecceActionContext
**OSS (270 lines):**
- Internal `submitRun(type, params, options, apiClient)` calls
- Embedded `<RunModal />` component
- Uses `findByRunType` registry lookup
- Uses `useQueryClient` for cache invalidation
- Uses `useAppLocation` for routing

**@datarecce/ui (200 lines):**
- Props-driven: `onRunAction`, `onShowRunId` callbacks
- No internal API calls
- No embedded UI
- Pure state management

**Migration Strategy:**
1. Create OSS adapter wrapping `RecceActionProvider`
2. Adapter implements `onRunAction` callback with submitRun logic
3. Adapter renders `<RunModal />` separately
4. Pass callbacks to provider

---

### Category 3: DIFFERENT PURPOSE (Keep Both or Merge)

#### RecceCheckContext vs CheckContext
**OSS RecceCheckContext (34 lines) - Minimal selection state:**
```typescript
export interface CheckContext {
  latestSelectedCheckId: string;
  setLatestSelectedCheckId: (selectCheckId: string) => void;
}
```

**@datarecce/ui CheckContext (98 lines) - Full CRUD:**
```typescript
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
```

**Decision Needed:**
- Option A: Keep OSS's minimal context, use @datarecce/ui's for components that need it
- Option B: Extend OSS to use @datarecce/ui's CheckContext
- Option C: Merge - OSS creates adapter passing check data to @datarecce/ui

#### RecceQueryContext vs QueryContext
**OSS RecceQueryContext (99 lines) - Query INPUT state:**
```typescript
export interface QueryContext {
  sqlQuery: string;
  setSqlQuery: (sqlQuery: string) => void;
  primaryKeys: string[] | undefined;
  setPrimaryKeys: (primaryKeys: string[] | undefined) => void;
  isCustomQueries: boolean;
  baseSqlQuery?: string;
}
// Also includes RowCountStateContext for node fetching state
```

**@datarecce/ui QueryContext (86 lines) - Query EXECUTION state:**
```typescript
export interface QueryContextType {
  sql: string;
  isExecuting: boolean;
  error?: string;
  baseResult?: QueryResult;
  currentResult?: QueryResult;
  onSqlChange?: (sql: string) => void;
  onExecute?: (sql: string) => Promise<void>;
  onCancel?: () => void;
}
```

**Decision Needed:**
- These serve different concerns (input vs execution)
- Option A: Keep both, use for different purposes
- Option B: Merge into unified context with both concerns
- Option C: OSS adapter that bridges both

---

### Category 4: API Config (Similar but Different Behavior)

#### ApiConfigContext
**OSS (182 lines) - Optional provider:**
```typescript
// Returns default config if outside provider (OSS mode)
export function useApiConfig(): ApiConfigContextType {
  const context = useContext(ApiConfigContext);
  return context ?? defaultApiConfigContext;  // Fallback!
}
```

**@datarecce/ui (199 lines) - Required provider:**
```typescript
export function useApiConfig(): ApiContextValue {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error("useApiConfig must be used within RecceProvider");  // Throws!
  }
  return context;
}
```

**Migration Strategy:**
- @datarecce/ui's strict requirement is intentional for library use
- OSS can wrap with its own optional-fallback layer
- Or: Add `useApiConfigOptional` to @datarecce/ui (like we did with `useRecceThemeOptional`)

---

## Additional Contexts in @datarecce/ui (No OSS Equivalent)

### ThemeContext
- Manages theme mode (light/dark/system)
- Toggles `.dark` class on document
- Has `useRecceThemeOptional` for fallback (already used by hooks migration)

### RoutingContext
- Provides routing abstraction
- Has `useAppLocation` hook designed to match OSS's API
- OSS uses Next.js directly; @datarecce/ui is framework-agnostic

**Integration Strategy:**
- OSS provides `onNavigate` callback from Next.js router
- @datarecce/ui components use `useAppLocation` which works in both

---

## Test Coverage Gap

**CRITICAL: Zero tests exist for any context!**

| Location | Test Files Found |
|----------|------------------|
| OSS `hooks/` | Only `useAppRouter.test.ts` (routing, not contexts) |
| @datarecce/ui `contexts/` | None |
| @datarecce/ui `providers/` | None |

**Recommendation:** Before ANY migration, add tests for:
1. All IDENTICAL contexts (verify behavior before switching imports)
2. Props-driven contexts (verify callbacks work correctly)
3. Adapter layer (when created)

---

## Recommended Migration Order

### Phase 2A: Tests First (Pre-requisite)
Add tests for all contexts before migration:
1. RecceInstanceContext/Provider tests
2. IdleTimeoutContext/Provider tests
3. ApiConfigContext/Provider tests
4. LineageGraphContext tests (OSS data fetching)
5. LineageGraphProvider tests (@datarecce/ui props-driven)
6. RecceActionContext tests (OSS)
7. RecceActionProvider tests (@datarecce/ui)

### Phase 2B: IDENTICAL Contexts (Low Risk)
**After tests pass:**
1. Switch `RecceInstanceContext` imports to `@datarecce/ui/contexts`
2. Switch `IdleTimeoutContext` imports to `@datarecce/ui/contexts`
3. Delete OSS duplicates

### Phase 2C: ApiConfigContext (Medium Risk)
1. Add `useApiConfigOptional` to @datarecce/ui for fallback support
2. Switch OSS imports
3. OSS wraps with fallback layer if needed

### Phase 2D: Props-Driven Adapters (Higher Risk)
1. **LineageGraphContext adapter:**
   - Create `LineageGraphAdapter` in OSS
   - Handles data fetching, WebSocket, modals
   - Wraps @datarecce/ui's `LineageGraphProvider`

2. **RecceActionContext adapter:**
   - Create `RecceActionAdapter` in OSS
   - Handles submitRun, RunModal
   - Wraps @datarecce/ui's `RecceActionProvider`

### Phase 2E: Different-Purpose Contexts (TBD)
- Deferred until we have clearer requirements
- RecceCheckContext vs CheckContext decision
- RecceQueryContext vs QueryContext decision

---

## Open Questions for User

1. **For Check/Query contexts:** Should we merge, keep separate, or create adapters?

2. **For RowCountStateContext:** This only exists in OSS - migrate to @datarecce/ui or keep in OSS?

3. **For WebSocket handling:** Should @datarecce/ui provide a WebSocket abstraction, or should that remain OSS-specific?

4. **Test framework preference:** Jest is used in OSS - should @datarecce/ui context tests also use Jest?

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Recce OSS                                      │
│                                                                          │
│  ┌─────────────────────────┐     ┌─────────────────────────────────┐   │
│  │ OSS Adapter Layer       │     │ OSS-Specific                    │   │
│  │                         │     │                                  │   │
│  │ • LineageGraphAdapter   │     │ • RecceShareStateContext        │   │
│  │   - Data fetching       │     │ • useCountdownToast             │   │
│  │   - WebSocket           │     │ • useFeedbackCollectionToast    │   │
│  │   - Disconnect modals   │     │ • useGuideToast                 │   │
│  │                         │     │ • useCheckEvents (Cloud-only)   │   │
│  │ • RecceActionAdapter    │     │ • RowCountStateContext          │   │
│  │   - submitRun           │     │                                  │   │
│  │   - RunModal            │     │                                  │   │
│  │                         │     │                                  │   │
│  └──────────┬──────────────┘     └─────────────────────────────────┘   │
│             │                                                            │
│             ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      @datarecce/ui                               │   │
│  │                                                                   │   │
│  │  IDENTICAL (direct import):                                       │   │
│  │  • RecceInstanceInfoProvider                                      │   │
│  │  • IdleTimeoutProvider                                            │   │
│  │  • ThemeProvider                                                  │   │
│  │                                                                   │   │
│  │  PROPS-DRIVEN (wrapped by adapter):                               │   │
│  │  • LineageGraphProvider                                           │   │
│  │  • RecceActionProvider                                            │   │
│  │  • RoutingProvider                                                │   │
│  │                                                                   │   │
│  │  DIFFERENT PURPOSE (TBD):                                         │   │
│  │  • CheckProvider                                                  │   │
│  │  • QueryProvider                                                  │   │
│  │  • ApiProvider                                                    │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## References

- [Phase 1: Hooks Migration Design](./2026-01-04-hooks-context-migration-design.md)
- [Component Library Audit](./2026-01-03-component-library-audit.md)
- [@datarecce/ui RecceProvider](../../js/packages/ui/src/providers/RecceProvider.tsx)
- [OSS RecceContextProvider](../../js/src/lib/hooks/RecceContextProvider.tsx)
