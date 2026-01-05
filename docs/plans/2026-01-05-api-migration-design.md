# API Migration to @datarecce/ui

**Date:** 2026-01-05
**Status:** Ready for Implementation
**Authors:** Jared Scott, Claude

## Executive Summary

This document describes the selective migration of API files from Recce OSS (`js/src/lib/api/`) to the `@datarecce/ui` component library (`js/packages/ui/src/api/`). The goal is to make `@datarecce/ui` a self-contained library that provides API endpoints as interfaces that consumers can use.

**Current state:** Recce OSS has 26 API files in `js/src/lib/api/`. Only 6 have been migrated to `packages/ui`. The OSS `registry.ts` defines `RunType` and view options, creating circular dependencies with API files.

**Target state:** `@datarecce/ui` owns all shareable API functions and types. Recce OSS becomes a consumer, importing types from the library. The library has zero dependencies on consumer components.

---

## Design Principles

1. **Library has no consumer dependencies** - `@datarecce/ui` never imports from Recce OSS
2. **Library files used internally or by consumers** - Flow is always library → consumer
3. **No default axios client** - All API functions require `client: AxiosInstance` parameter
4. **Hooks use optional pattern** - `useApiConfigOptional()` with fallback for OSS compatibility

---

## API File Categorization

### Category 1: SHAREABLE (Pure API Functions)
Direct migration - pure functions with axios client injection:

| File | Lines | Exports |
|------|-------|---------|
| `adhocQuery.ts` | 71 | Query types + submit functions |
| `checkEvents.ts` | 253 | Check events CRUD + type guards |
| `cll.ts` | 54 | Column-level lineage types + API |
| `lineagecheck.ts` | 36 | createLineageDiffCheck |
| `models.ts` | 60 | Model row count helpers |
| `rowcount.ts` | 20 | Row count types + submit |
| `schemacheck.ts` | 32 | createSchemaDiffCheck |
| `select.ts` | 26 | Node selection API |
| `state.ts` | 118 | State management CRUD |
| `valuediff.ts` | 47 | Value diff types + submit |
| `profile.ts` | 78 | Profile/TopK/Histogram types |
| `localStorageKeys.ts` | 8 | Key constants |
| `sessionStorageKeys.ts` | 9 | Key constants |

### Category 2: SHAREABLE WITH HOOK ADAPTATION
Hooks need `useApiConfigOptional()` pattern:

| File | Hook | Change Required |
|------|------|-----------------|
| `checks.ts` | `useChecks()` | Use `useApiConfigOptional()` with fallback |
| `version.ts` | `useVersionNumber()` | Use `useApiConfigOptional()` with fallback |

### Category 3: SHAREABLE WITH TYPE EXTRACTION
Complex files requiring RunType/types extraction:

| File | Issue | Solution |
|------|-------|----------|
| `runs.ts` | Imports `RunType` from registry, uses `track.ts` | Move RunType to library, remove track dependency |
| `types.ts` | Imports `RunType` from registry | Move all types to library |

### Category 4: OSS-SPECIFIC (Do NOT Migrate)

| File | Reason |
|------|--------|
| `axiosClient.ts` | Uses `PUBLIC_API_URL` from OSS env vars |
| `track.ts` | Amplitude analytics with OSS-specific config |
| `connectToCloud.ts` | OSS-to-cloud connection only |

---

## Architecture Design

### Breaking the Circular Dependency

**Current (problematic):**
```
registry.ts (defines RunType)
    ↓ exports RunType
types.ts (uses RunType in Run union)
    ↓ exports Run
runs.ts (uses Run type)
    ↓ exports submitRun
adhocQuery.ts (uses submitRun)
    ↓ exports QueryViewOptions
registry.ts (imports QueryViewOptions) ← CIRCULAR
```

**Target (library-first):**
```
@datarecce/ui/api/types/run.ts (defines RunType, Run, type guards)
    ↓ exports to
@datarecce/ui/api/runs.ts (uses Run type)
    ↓ exports to
@datarecce/ui/api/adhocQuery.ts (uses submitRun, exports QueryViewOptions)
    ↓ exports to
@datarecce/ui/index.ts (re-exports all)
    ↓ consumed by
Recce OSS registry.ts (imports types, registers React components)
```

### Type Organization

**Base Types (`packages/ui/src/api/types/base.ts`):**
```typescript
export type AxiosQueryParams = Record<string, string | string[] | number | number[] | undefined>;
export type RowDataTypes = number | string | boolean | null | undefined;
export type RowData = RowDataTypes[];
export type ColumnType = "number" | "integer" | "text" | "boolean" | "date" | "datetime" | "timedelta" | "unknown";
export type ColumnRenderMode = "raw" | "percent" | "delta" | 2;

export interface DataFrame {
  columns: { key: string; name: string; type: ColumnType }[];
  data: RowData[];
  limit?: number;
  more?: boolean;
}
```

**Run Types (`packages/ui/src/api/types/run.ts`):**
```typescript
export type RunType =
  | "simple" | "sandbox"
  | "query" | "query_base" | "query_diff"
  | "value_diff" | "value_diff_detail"
  | "schema_diff"
  | "profile" | "profile_diff"
  | "row_count" | "row_count_diff"
  | "lineage_diff"
  | "top_k_diff" | "histogram_diff";

export interface BaseRun {
  type: RunType;
  run_id: string;
  run_at: string;
  name?: string;
  check_id?: string;
  progress?: { message?: string; percentage?: number };
  error?: string;
  status?: "finished" | "failed" | "cancelled" | "running";
}

// Discriminated union - imports param/result types from API files
export type Run =
  | (BaseRun & { type: "query"; params?: QueryRunParams; result?: QueryResult })
  | (BaseRun & { type: "query_diff"; params?: QueryDiffParams; result?: QueryDiffResult })
  // ... all variants

// Type guards
export function isQueryRun(run: Run): run is Extract<Run, { type: "query" }>;
export function isValueDiffRun(run: Run): run is Extract<Run, { type: "value_diff" }>;
// ... all type guards
```

**Param/Result/ViewOptions Types (co-located with API files):**
```typescript
// packages/ui/src/api/adhocQuery.ts
export interface QueryRunParams { sql_template: string; }
export interface QueryResult extends DataFrame {}
export interface QueryDiffParams { sql_template: string; base_sql_template?: string; primary_keys?: string[]; }
export interface QueryDiffResult { base?: DataFrame; current?: DataFrame; diff?: DataFrame; }
export interface QueryViewOptions { pinned_columns?: string[]; columnsRenderMode?: Record<string, ColumnRenderMode>; }
export interface QueryDiffViewOptions extends QueryViewOptions { changed_only?: boolean; display_mode?: "inline" | "side_by_side"; }
```

---

## Target File Structure

```
packages/ui/src/api/
├── types/
│   ├── base.ts              # DataFrame, RowData, ColumnType, etc.
│   ├── run.ts               # RunType, BaseRun, Run union, type guards
│   └── index.ts             # Re-exports
├── adhocQuery.ts            # Query params/results/options + submit functions
├── cacheKeys.ts             # (already migrated)
├── checkEvents.ts           # Check events CRUD + helpers
├── checks.ts                # Check CRUD + useChecks hook
├── cll.ts                   # Column-level lineage
├── flag.ts                  # (already migrated)
├── info.ts                  # (already migrated)
├── instanceInfo.ts          # (already migrated)
├── keepAlive.ts             # (already migrated)
├── lineagecheck.ts          # Lineage diff check creation
├── models.ts                # Model row count helpers
├── profile.ts               # Profile/TopK/Histogram types + submit
├── rowcount.ts              # Row count types + submit
├── runs.ts                  # Core run API (extended from current)
├── schemacheck.ts           # Schema diff check creation
├── select.ts                # Node selection API
├── state.ts                 # State management CRUD
├── storageKeys.ts           # Combined local + session storage keys
├── valuediff.ts             # Value diff types + submit
├── version.ts               # Version API + useVersionNumber hook
└── index.ts                 # Public exports
```

---

## Consumer Updates (Recce OSS)

### registry.ts Transformation

**Before (defines types):**
```typescript
import { QueryDiffViewOptions } from "@/lib/api/adhocQuery";

export type RunType = "simple" | "query" | ...;  // DEFINED HERE
export type ViewOptionTypes = QueryDiffViewOptions | ...;
```

**After (imports types from library):**
```typescript
import {
  RunType,
  QueryViewOptions,
  QueryDiffViewOptions,
  ProfileDiffViewOptions,
  // ... all view option types
} from "@datarecce/ui";
import { QueryResultView } from "../query/QueryResultView";

// Only component registration - no type definitions
export type ViewOptionTypes = QueryViewOptions | QueryDiffViewOptions | ...;

const registry: Record<RunType, RegistryEntry> = {
  query: { title: "Query", icon: TbSql, RunResultView: QueryResultView },
  // ...
};
```

### API File Updates

**Before:**
```typescript
// js/src/lib/api/adhocQuery.ts
import { axiosClient } from "./axiosClient";
import { submitRun } from "./runs";

export async function submitQuery(params, options, client = axiosClient) {
  return await submitRun("query", params, options, client);
}
```

**After:**
```typescript
// js/src/lib/api/adhocQuery.ts
export {
  submitQuery,
  submitQueryBase,
  submitQueryDiff,
  type QueryRunParams,
  type QueryResult,
  type QueryDiffParams,
  type QueryDiffResult,
  type QueryViewOptions,
  type QueryDiffViewOptions,
} from "@datarecce/ui";
```

---

## Migration Strategy

### Phase 1: Type Foundation
1. Create `packages/ui/src/api/types/base.ts` with DataFrame, RowData, etc.
2. Create `packages/ui/src/api/types/run.ts` with RunType enum and BaseRun
3. Update `packages/ui/src/api/types/index.ts` to re-export

### Phase 2: Core API Migration
1. Migrate `runs.ts` (without track.ts dependency)
2. Build Run discriminated union incrementally as param/result types are added
3. Add type guards to `types/run.ts`

### Phase 3: Domain API Migration
Migrate in dependency order:
1. `adhocQuery.ts` (depends on runs)
2. `rowcount.ts` (depends on runs)
3. `valuediff.ts` (depends on runs)
4. `profile.ts` (depends on runs)
5. `models.ts` (depends on rowcount, runs)
6. `checks.ts` (depends on types, cacheKeys)
7. `checkEvents.ts` (standalone)
8. `cll.ts` (depends on info)
9. `lineagecheck.ts` (depends on checks, cll)
10. `schemacheck.ts` (depends on checks)
11. `select.ts` (standalone)
12. `state.ts` (standalone)
13. `version.ts` (standalone with hook)
14. `storageKeys.ts` (standalone)

### Phase 4: Consumer Updates
1. Update OSS `registry.ts` to import types from `@datarecce/ui`
2. Update OSS API files to re-export from `@datarecce/ui`
3. Verify all imports across codebase resolve correctly

### Phase 5: Cleanup
1. Remove duplicated type definitions from OSS
2. Update any remaining direct imports to use library
3. Run full test suite

---

## Verification

After each phase:
```bash
cd js/packages/ui && pnpm type:check && pnpm build
cd js && pnpm type:check && pnpm test
```

Final verification:
```bash
cd js && pnpm dev  # Verify OSS app works
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Circular dependency during migration | Migrate types first, then API functions |
| Breaking OSS imports | Use re-exports in OSS files for backward compatibility |
| Hook compatibility outside RecceProvider | Use `useApiConfigOptional()` pattern consistently |
| Missing type exports | Comprehensive index.ts with explicit exports |

---

## Success Criteria

1. **Zero consumer dependencies** - `@datarecce/ui` has no imports from `js/src/`
2. **Type ownership** - RunType, Run, and all param/result/view types defined in library
3. **Backward compatibility** - OSS imports unchanged (via re-exports)
4. **All tests pass** - Both packages/ui and OSS test suites green
5. **Clean build** - No TypeScript errors in either package
