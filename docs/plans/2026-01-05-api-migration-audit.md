# API Migration Audit: OSS to @datarecce/ui Library

**Date:** 2026-01-05
**Goal:** Audit all API files to ensure shareable code is in `@datarecce/ui` and OSS imports from library

---

## Summary

| Status | Count | Description |
|--------|-------|-------------|
| Properly Migrated | 8 | OSS imports from library correctly |
| Needs Update | 12 | OSS duplicates library code |
| OSS-Only | 4 | Should remain in OSS (app-specific) |

---

## Properly Migrated Files

These files correctly import from `@datarecce/ui/api` and wrap with default `axiosClient`:

| OSS File | Status | Notes |
|----------|--------|-------|
| `runs.ts` | OK | Imports from library, adds OSS-specific `mutateAddKey` |
| `checks.ts` | OK | Imports from library, wraps with default client |
| `models.ts` | OK | Re-exports types from library |
| `adhocQuery.ts` | OK | Imports from library |
| `profile.ts` | OK | Imports from library |
| `rowcount.ts` | OK | Imports from library |
| `valuediff.ts` | OK | Imports from library |
| `types.ts` | OK | Re-exports types from library |

---

## Files Needing Update

### Priority 1: Full Duplicates (import from library, wrap with default client)

| OSS File | Library File | Action |
|----------|--------------|--------|
| `checkEvents.ts` | `checkEvents.ts` | Import all, wrap with default client |
| `lineagecheck.ts` | `lineagecheck.ts` | Import `createLineageDiffCheck`, wrap |
| `schemacheck.ts` | `schemacheck.ts` | Import `createSchemaDiffCheck`, wrap |
| `state.ts` | `state.ts` | Import all functions, wrap |
| `select.ts` | `select.ts` | Import `select`, wrap |
| `keepAlive.ts` | `keepAlive.ts` | Import all, wrap |
| `cacheKeys.ts` | `cacheKeys.ts` | Import `cacheKeys` constant |

### Priority 2: Type/Function Differences

| OSS File | Issue | Action |
|----------|-------|--------|
| `cll.ts` | OSS uses `Set<string>`, library uses `string[]` | Fix OSS to use library types |
| `info.ts` | OSS uses lowercase types, library uses PascalCase | Import library types, keep OSS functions |
| `instanceInfo.ts` | Missing `ServerMode` export | Import from library |
| `version.ts` | OSS uses `useApiConfig`, library uses `useApiConfigOptional` | Import from library |
| `flag.ts` | OSS has extra `markOnboardingCompleted` | Import shared, keep OSS-specific |

### Priority 3: Storage Keys

| OSS File | Library Location | Action |
|----------|------------------|--------|
| `localStorageKeys.ts` | `storageKeys.ts` | Import `LOCAL_STORAGE_KEYS` from library |
| `sessionStorageKeys.ts` | `storageKeys.ts` | Import `SESSION_STORAGE_KEYS` from library |

---

## OSS-Only Files (Keep As-Is)

| File | Reason |
|------|--------|
| `axiosClient.ts` | Default axios instance with `PUBLIC_API_URL` - OSS app config |
| `track.ts` | Amplitude analytics - OSS-specific |
| `connectToCloud.ts` | Cloud connection API - OSS app feature |
| `user.ts` | User API with GitHub avatar - OSS app feature |

---

## Detailed Findings

### `checkEvents.ts`
- **OSS (253 lines):** Full duplicate with default `axiosClient`
- **Library:** Same code requiring explicit client
- **Action:** Import all types and functions from library, wrap with default client

### `cll.ts`
- **OSS:** Uses `Set<string>` for `parent_map`/`child_map`
- **Library:** Uses `string[]` (correct - JSON doesn't support Sets)
- **Action:** Import from library, OSS should convert if needed

### `lineagecheck.ts`
- **OSS (36 lines):** Full duplicate
- **Library:** Same `createLineageDiffCheck` function
- **Action:** Import and wrap

### `schemacheck.ts`
- **OSS (32 lines):** Full duplicate
- **Library:** Same `createSchemaDiffCheck` function
- **Action:** Import and wrap

### `state.ts`
- **OSS (118 lines):** Full duplicate
- **Library:** Same functions (`saveAs`, `rename`, `exportState`, etc.)
- **Action:** Import all and wrap

### `select.ts`
- **OSS (26 lines):** Full duplicate
- **Library:** Same `select` function
- **Action:** Import and wrap

### `version.ts`
- **OSS (41 lines):** Uses `useApiConfig`
- **Library:** Uses `useApiConfigOptional` pattern
- **Action:** Import from library (handles provider-less usage)

### `flag.ts`
- **OSS (38 lines):** Has `getFlag`, `setFlag`, `markOnboardingCompleted`
- **Library:** Has `getFlag`, `setFlag` only
- **Action:** Import shared, keep `markOnboardingCompleted` in OSS

### `info.ts`
- **OSS (199 lines):** Many extra functions, lowercase types
- **Library:** Core functions with PascalCase types
- **Action:** Import library types/functions, keep OSS-specific (`getLineage`, `getLineageDiff`, etc.)

### `instanceInfo.ts`
- **OSS (26 lines):** Missing `ServerMode` type export
- **Library:** Has `ServerMode` type
- **Action:** Import from library

### `keepAlive.ts`
- **OSS (109 lines):** Full duplicate
- **Library:** Same code
- **Action:** Import and wrap

### `cacheKeys.ts`
- **OSS (14 lines):** Full duplicate
- **Library:** Same `cacheKeys` constant
- **Action:** Import from library

### Storage Keys
- **OSS:** Separate `localStorageKeys.ts` and `sessionStorageKeys.ts`
- **Library:** Combined `storageKeys.ts` with `LOCAL_STORAGE_KEYS` and `SESSION_STORAGE_KEYS`
- **Action:** Import from library

---

## Implementation Plan

### Phase 1: Simple Imports (Full Duplicates)
1. `cacheKeys.ts` - Import `cacheKeys` from library
2. `select.ts` - Import `select`, wrap with default client
3. `lineagecheck.ts` - Import and wrap
4. `schemacheck.ts` - Import and wrap
5. `checkEvents.ts` - Import all, wrap with default client
6. `state.ts` - Import all functions, wrap
7. `keepAlive.ts` - Import all, wrap

### Phase 2: Type Updates
1. `cll.ts` - Import from library
2. `instanceInfo.ts` - Import including `ServerMode`
3. `version.ts` - Import from library (uses `useApiConfigOptional`)

### Phase 3: Partial Updates
1. `flag.ts` - Import shared, keep OSS-specific `markOnboardingCompleted`
2. `info.ts` - Import library types, keep OSS-specific functions
3. Storage keys - Import from library

---

## Verification Checklist

After changes:
- [x] `pnpm type:check` passes
- [x] `pnpm test` passes (1620 tests)
- [x] `pnpm lint:fix` passes
- [ ] `pnpm build` succeeds
- [x] No duplicate code between OSS and library
- [x] All OSS API files import from `@datarecce/ui/api`

---

## Implementation Complete: 2026-01-05

All 14 OSS API files have been updated to import from `@datarecce/ui/api`:

| File | Status | Notes |
|------|--------|-------|
| `cacheKeys.ts` | Updated | Re-exports from library |
| `select.ts` | Updated | Wrapper with default client |
| `lineagecheck.ts` | Updated | Wrapper with default client |
| `schemacheck.ts` | Updated | Wrapper with default client |
| `checkEvents.ts` | Updated | Wrapper with default client + re-exports |
| `state.ts` | Updated | Wrapper with default client |
| `keepAlive.ts` | Updated | Wrapper with default client |
| `cll.ts` | Updated | Fixed `Set<string>` → `string[]` type |
| `instanceInfo.ts` | Updated | Added `ServerMode` export |
| `version.ts` | Updated | Uses library's `useApiConfigOptional` |
| `flag.ts` | Updated | Keeps OSS-specific `markOnboardingCompleted` |
| `info.ts` | Updated | Keeps OSS-specific lineage functions |
| `localStorageKeys.ts` | Updated | Re-exports from library |
| `sessionStorageKeys.ts` | Updated | Re-exports from library |
