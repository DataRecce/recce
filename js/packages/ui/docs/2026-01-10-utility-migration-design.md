# Design: Utility Code Migration to @datarecce/ui

**Date:** 2026-01-10
**Status:** Approved
**Project:** [datarecce/ui Component Library](https://linear.app/recce/project/datarecceui-component-library-23c5dc1a64a0/)

## Overview

Audit and migrate utility code from `js/src` to `js/packages/ui` (@datarecce/ui). The goal is to make @datarecce/ui a clean, well-documented, reusable component library for Recce OSS and recce-cloud-infra.

## Audit Summary

### Files Ready for Full Migration
| File | Reason |
|------|--------|
| ScreenShot.tsx | Generic clipboard/screenshot utility, no API dependencies |
| ApiConfigContext.tsx | Already exists in @datarecce/ui - OSS has duplicate |
| Run types (types.ts) | Pure TypeScript types, extends library types |

### Files for Partial Migration
| File | What Migrates | What Stays in OSS |
|------|---------------|-------------------|
| useCSVExport.ts | Browser utils (copyToClipboard, download) | Hook using Run type |
| info.ts | LineageDiffResult type | getModelInfo() API call |
| registry.ts | RegistryEntry interface, utility functions | Component mappings |
| useRun.tsx | Core hook logic | Type casting, side effects |

### Files to Keep in OSS
| File | Reason |
|------|--------|
| LineageGraphAdapter.tsx | WebSocket, modals, analytics - OSS-specific |
| useModelColumns.tsx | Direct backend API calls |
| RecceQueryContext.tsx | Too narrow, OSS-only state |
| useCheckToast.tsx | Redundant - just calls toaster (remove) |

## Implementation Phases

### Phase 1: Cleanup

**Pre-step:** N/A (first phase)

**Goal:** Remove redundant code before adding complexity.

#### 1.1 Remove useCheckToast.tsx
- **Location:** `src/lib/hooks/useCheckToast.tsx`
- **Action:** Inline toast call at usage sites, delete file
- **Reason:** 2 lines of logic, just wraps `toaster.create()`

#### 1.2 Deduplicate ApiConfigContext.tsx
- **Location:** `src/lib/hooks/ApiConfigContext.tsx`
- **Action:** Re-export from `@datarecce/ui/hooks`, delete duplicate (~150 lines)
- **Reason:** Already exists in library

#### 1.3 Evaluate RecceQueryContext.tsx
- **Location:** `src/lib/hooks/RecceQueryContext.tsx`
- **Action:** Check usage, remove if redundant
- **Reason:** Narrow context, may be superseded

---

### Phase 2: Quick Wins

**Pre-step:** Re-evaluate to ensure Phase tasks are up-to-date after Phase 1.

**Goal:** Migrate code that's library-ready with minimal changes.

#### 2.1 Migrate ScreenShot.tsx
- **Source:** `src/lib/hooks/ScreenShot.tsx`
- **Target:** `packages/ui/src/hooks/useScreenshot.ts`
- **Changes:**
  - Update theme import to `@datarecce/ui/theme`
  - Remove `DataGridHandle` type (use generic `HTMLElement`)
- **Exports:** `useCopyToClipboard`, `useCopyToClipboardButton`, `useImageDownloadModal`

#### 2.2 Migrate Run Types
- **Source:** `src/lib/api/types.ts`
- **Target:** `packages/ui/src/api/types/run.ts`
- **Types:** `Run` (discriminated union), `RunParamTypes`
- **Dependency:** Requires LineageDiffResult migration first (see 3.3)

#### 2.3 Migrate CSV Browser Utilities
- **Source:** `src/lib/csv/index.ts`
- **Target:** `packages/ui/src/utils/csv/browser.ts`
- **Functions:** `copyCSVToClipboard()`, `downloadCSV()`
- **Reason:** Generic browser utilities, no Recce dependencies

---

### Phase 3: Foundation

**Pre-step:** Re-evaluate to ensure Phase tasks are up-to-date after Phase 2.

**Goal:** Establish patterns enabling future migrations.

#### 3.1 Migrate Registry Types
- **Source:** `src/components/run/registry.ts`
- **Target:** `packages/ui/src/types/registry.ts`
- **What migrates:**
  - `RegistryEntry` interface
  - `RefTypes` and `ViewOptionTypes` unions
  - `runTypeHasRef()` utility
- **What stays in OSS:**
  - `RunRegistry` object (maps to OSS components)
  - `findByRunType()` function
  - Component implementations

#### 3.2 Migrate useRun Hook Core
- **Source:** `src/lib/hooks/useRun.tsx`
- **Target:** `packages/ui/src/hooks/useRun.ts`
- **Pattern:** Dependency injection for apiClient
  ```typescript
  // Library version
  export const useRun = (runId?: string, options?: UseRunOptions) => {
    const contextConfig = useApiConfigOptional();
    const apiClient = options?.apiClient ?? contextConfig?.apiClient;
  }
  ```
- **OSS:** Thin wrapper injecting local context

#### 3.3 Migrate LineageDiffResult Type
- **Source:** `src/lib/api/info.ts`
- **Target:** `packages/ui/src/api/types/lineage.ts`
- **Type:**
  ```typescript
  export interface LineageDiffResult {
    base?: LineageData;
    current?: LineageData;
    base_error?: string;
    current_error?: string;
  }
  ```
- **Note:** Unblocks Run type migration (Phase 2.2)

---

### Phase 4: Consumer-Driven

**Pre-step:** Re-evaluate to ensure Phase tasks are up-to-date after Phase 3.

**Goal:** Address gaps for recce-cloud-infra.

#### 4.1 Export Screenshot Utilities
- **Action:** Ensure hooks exported from `@datarecce/ui/hooks` with documentation
- **Benefit:** Cloud can replace `html-to-image` usage with library utilities

#### 4.2 Document Adapter Pattern
- **Action:** Create documentation explaining:
  - How to wrap/extend library contexts
  - Theme bridging patterns (CSS Variables vs legacy mode)
  - Provider stacking order recommendations
- **Location:** `packages/ui/docs/adapter-patterns.md`

#### 4.3 Evaluate Run History Gap
- **Action:** Audit `RunHistoryDrawer` in recce-cloud-infra
- **Decision:** Determine if generic enough for library or cloud-specific

#### 4.4 Document WebSocket Strategy
- **Action:** Document that WebSocket handling is left to consumers
- **Reason:** Both OSS and Cloud have deployment-specific implementations

---

## Architecture Principles

1. **Library provides stateless components** - Props-driven, no API calls
2. **Consumers provide data-fetching adapters** - OSS/Cloud wrap library contexts
3. **Types are library-owned** - Discriminated unions, interfaces in @datarecce/ui
4. **Utilities are generic** - No Recce-specific dependencies in migrated code

## Files Changed

### Created in @datarecce/ui
- `packages/ui/src/hooks/useScreenshot.ts`
- `packages/ui/src/hooks/useRun.ts`
- `packages/ui/src/api/types/run.ts`
- `packages/ui/src/api/types/lineage.ts`
- `packages/ui/src/types/registry.ts`
- `packages/ui/src/utils/csv/browser.ts`
- `packages/ui/docs/adapter-patterns.md`

### Deleted from OSS
- `src/lib/hooks/useCheckToast.tsx`
- `src/lib/hooks/ApiConfigContext.tsx` (replaced with re-export)

### Modified in OSS
- `src/lib/hooks/useRun.tsx` (thin wrapper)
- `src/lib/api/types.ts` (re-export from library)
- `src/lib/api/info.ts` (remove migrated type)
- `src/components/run/registry.ts` (import types from library)
- Files using useCheckToast (inline toast calls)

## Success Criteria

1. All tests pass after each phase
2. No duplicate code between OSS and @datarecce/ui
3. recce-cloud-infra can use new exports without changes
4. Clear documentation for adapter patterns
