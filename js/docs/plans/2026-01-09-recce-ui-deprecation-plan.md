# recce-ui Deprecation Plan

**Issue:** DRC-2517
**Date:** 2026-01-09
**Status:** In Progress

## Summary

This document outlines the work required to deprecate the recce-ui repository by consolidating all functionality into @datarecce/ui (published directly from the recce repo).

## Current Architecture

```
recce-cloud-infra
    ↓ imports from
@datarecce/ui (npm package)
    ↓ published by
recce-ui (wrapper repo)
    ↓ re-exports from
recce (OSS repo, via git submodule)
```

## Target Architecture

```
recce-cloud-infra
    ↓ imports from
@datarecce/ui (npm package)
    ↓ published by
recce (OSS repo)
```

## Gap Analysis

### Export Paths Required by recce-cloud-infra

recce-cloud-infra imports from these paths:

| Path | Status in @datarecce/ui | Notes |
|------|------------------------|-------|
| `@datarecce/ui` | ✅ Exists | Main entry point |
| `@datarecce/ui/hooks` | ❌ Missing | Provided by recce-ui wrapper |
| `@datarecce/ui/components` | ❌ Missing | Provided by recce-ui wrapper |
| `@datarecce/ui/theme` | ✅ Exists | Some exports missing |
| `@datarecce/ui/contexts` | ✅ Exists | RouteConfigContext added |

### Missing Exports from `@datarecce/ui/hooks`

recce-cloud-infra uses these from `@datarecce/ui/hooks`:

| Export | Current Location | Action Required |
|--------|-----------------|-----------------|
| `ApiConfigProvider` | `contexts-entry.ts` (as `ApiProvider`) | Add alias or new export path |
| `IdleTimeoutProvider` | `contexts-entry.ts` | Add to hooks export |
| `LineageGraphContextProvider` | `contexts/index.ts` (as `LineageGraphProvider`) | Add alias |
| `RecceCheckContextProvider` | Not in @datarecce/ui | Export from js/src |
| `RecceContextProvider` | Not in @datarecce/ui | Export from js/src |
| `RouteConfigProvider` | ✅ Added (DRC-2516) | Complete |
| `RecceActionContext` | `contexts/index.ts` | Add to hooks export |
| `RecceActionContextType` | `contexts/index.ts` | Add to hooks export |
| `useRecceActionContext` | `contexts/index.ts` | Add to hooks export |
| `useRecceCheckContext` | Not in @datarecce/ui | Export from js/src |

### Missing Exports from `@datarecce/ui/components`

recce-cloud-infra uses these from `@datarecce/ui/components`:

| Export | Current Location | Action Required |
|--------|-----------------|-----------------|
| `LineageView` | ✅ In @datarecce/ui | Add to components export |
| `QueryPage` | `js/src/components/query/QueryPage.tsx` | Export from packages/ui |
| `RunResultPane` | `js/src/components/run/RunResultPane.tsx` | Export from packages/ui |
| (Checklist components) | Various | Audit and export |

### Missing Exports from `@datarecce/ui/theme`

| Export | Current Location | Action Required |
|--------|-----------------|-----------------|
| `muiTheme` | `js/src/components/ui/mui-theme.ts` | Add to theme exports |
| `lightTheme` | `js/src/components/ui/mui-theme.ts` | Add to theme exports |
| `darkTheme` | `js/src/components/ui/mui-theme.ts` | Add to theme exports |
| `semanticColors` | `js/src/components/ui/mui-theme.ts` | Add to theme exports |
| `token` | `js/src/components/ui/mui-theme.ts` | Add to theme exports |

## Implementation Tasks

### Phase 1: Add Missing Export Paths (High Priority)

1. **Create `/hooks` export path**
   - Add `hooks.ts` entry file
   - Export all context providers with recce-ui compatible names
   - Update `package.json` exports

2. **Create `/components` export path**
   - Add `components-entry.ts` entry file
   - Export high-level components (QueryPage, RunResultPane, etc.)
   - Update `package.json` exports

### Phase 2: Complete Theme Exports

3. **Add missing theme exports**
   - Export `muiTheme`, `lightTheme`, `darkTheme`
   - Export `semanticColors`, `token`

### Phase 3: Export Missing Contexts

4. **Export remaining contexts**
   - `RecceContextProvider`
   - `RecceCheckContextProvider`, `useRecceCheckContext`
   - Ensure name compatibility with recce-ui

### Phase 4: Validation

5. **Test recce-cloud-infra with @datarecce/ui**
   - Update import paths
   - Verify all functionality works
   - Run full test suite

### Phase 5: Deprecation

6. **Archive recce-ui repository**
   - Update README with deprecation notice
   - Point users to @datarecce/ui from recce repo
   - Archive repository

## Effort Estimate

| Phase | Effort |
|-------|--------|
| Phase 1: Export paths | ~4 hours |
| Phase 2: Theme exports | ~1 hour |
| Phase 3: Context exports | ~2 hours |
| Phase 4: Validation | ~2 hours |
| Phase 5: Deprecation | ~1 hour |
| **Total** | **~10 hours** |

## Prerequisites

- [x] RouteConfigContext added to @datarecce/ui (DRC-2516)
- [x] isSchemaChanged utility migration complete (DRC-2507)
- [x] Split.tsx component migrated with HSplit/VSplit (DRC-2508)
- [x] DiffText.tsx component migrated (DRC-2509)
- [ ] All remaining migration tasks from audit complete
- [ ] recce-cloud-infra team ready to update imports

## Risks

1. **Name mismatches**: recce-ui uses some different names (e.g., `LineageGraphContextProvider` vs `LineageGraphProvider`)
2. **Missing internal exports**: Some contexts/hooks may have internal dependencies not yet in @datarecce/ui
3. **Build configuration**: May need to update tsdown config for new export paths

## Decision: Recommended Approach

**Option A: Create `/hooks` and `/components` paths (Recommended)**
- Pros: Clean separation, easy for consumers
- Cons: More export configuration work

**Option B: Export everything from main entry**
- Pros: Simpler configuration
- Cons: Larger bundle size for consumers, less clear API

Recommend Option A for better API design and tree-shaking.

---

## Changelog

### 2026-01-09 (Session 2)

**Components Migrated:**
- [x] `isSchemaChanged()` utility - Added 20 unit tests
- [x] `HSplit`/`VSplit` components - Created as wrappers around SplitPane with 15 tests
- [x] `DiffText` component - Migrated with onCopy callback abstraction, 15 tests added

**Export Additions:**
- `DiffText`, `DiffTextProps` added to main, primitives, and components exports
- `HSplit`, `VSplit`, `SplitProps` added to main, primitives, and components exports
- `isSchemaChanged` already exported from utils

**Files Updated:**
- Updated 5 files to use `HSplit`/`VSplit` from `@datarecce/ui`
- OSS `DiffText.tsx` now wraps `@datarecce/ui` component with toast callback
- OSS `Split.tsx` can be deprecated (consumers use @datarecce/ui directly)

**Test Coverage:**
- `schemaDiff.test.ts` - 20 tests
- `Split.test.tsx` - 15 tests
- `DiffText.test.tsx` - 15 tests
