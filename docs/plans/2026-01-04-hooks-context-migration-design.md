# Hooks & Context Migration Design - @datarecce/ui

**Date:** 2026-01-04
**Status:** Phase 1 Complete (2026-01-04)
**Goal:** Make Recce OSS a consumer of @datarecce/ui hooks, with contexts deferred to future phase

---

## Context & Drivers

1. **Primary:** Recce OSS should consume shared hooks from @datarecce/ui
2. **Secondary:** @datarecce/ui serves multiple consumers (Recce OSS, recce-cloud-infra)
3. **Tertiary:** Reduce code duplication, establish single source of truth

## Design Decisions

### Approach: Optional Fallbacks

@datarecce/ui hooks must work **with or without** `RecceProvider`:

- **Inside RecceProvider** (recce-cloud-infra): Uses context directly
- **Outside RecceProvider** (Recce OSS with next-themes): Falls back to DOM class detection

This allows both consumers to use the same hooks without architectural changes.

### Phased Migration

- **Phase 1 (This PR):** Hooks migration - quick wins with clear boundaries
- **Phase 2 (Future):** Context unification - requires adapter layer design

---

## Phase 1: Hooks Migration

### Audit Results

| Category | Count | Files |
|----------|-------|-------|
| **MIGRATABLE** | 2 | useIsDark, useThemeColors |
| **NOT_APPLICABLE** | 5 | RecceShareStateContext, useCheckEvents, useCountdownToast, useFeedbackCollectionToast, useGuideToast |

### Implementation Plan

#### Step 1: Add Tests for @datarecce/ui Hooks

**`useIsDark.test.ts`** should cover:
- Returns `false` during SSR (hydration safety)
- Returns `true` when `.dark` class is on `<html>`
- Returns `false` when `.dark` class is absent
- Reacts to class changes (MutationObserver)

**`useThemeColors.test.ts`** should cover:
- Returns correct colors for light mode
- Returns correct colors for dark mode
- Works without RecceProvider (fallback path)
- Works with RecceProvider (context path)

#### Step 2: Update useThemeColors with Fallback Pattern

Current implementation requires RecceProvider:
```typescript
const { resolvedMode } = useRecceTheme(); // Throws if no provider
```

New implementation with fallback:
```typescript
const themeContext = useRecceThemeOptional(); // Returns null if no provider
const isDarkFallback = useIsDark(); // Already has DOM fallback

// Use context if available, otherwise use fallback
const isDark = themeContext ? themeContext.resolvedMode === "dark" : isDarkFallback;
```

Add documentation explaining the dual-context support.

#### Step 3: Switch OSS Imports

```typescript
// Before (OSS local)
import { useIsDark } from "@/lib/hooks/useIsDark";
import { useThemeColors } from "@/lib/hooks/useThemeColors";

// After (from @datarecce/ui)
import { useIsDark, useThemeColors } from "@datarecce/ui/hooks";
```

#### Step 4: Delete OSS Local Files

Remove after migration:
- `js/src/lib/hooks/useIsDark.ts`
- `js/src/lib/hooks/useThemeColors.ts`

#### Step 5: Document NOT_APPLICABLE Files

Add header comment to each file:

```typescript
/**
 * @recce-migration NOT_APPLICABLE
 *
 * This file is specific to Recce OSS and should not be migrated to @datarecce/ui.
 *
 * Reason: [specific reason]
 *
 * If this changes in the future, consider:
 * - [what would need to change]
 */
```

**Files to document:**

| File | Reason |
|------|--------|
| `RecceShareStateContext.tsx` | OSS-specific share/export functionality tied to local state management |
| `useCheckEvents.ts` | Cloud-only feature - check timeline/comments require Recce Cloud backend |
| `useCountdownToast.tsx` | OSS-specific - server lifetime countdown for local dev server |
| `useFeedbackCollectionToast.tsx` | OSS-specific - feedback collection UI with localStorage persistence |
| `useGuideToast.tsx` | OSS-specific - onboarding guide toasts tied to OSS feature flags |

---

## Phase 1 Implementation Summary

**Completed:** 2026-01-04

### Commits
1. `test(ui): add tests for useIsDark hook` - 6 tests covering hydration, DOM detection, MutationObserver
2. `test(ui): add tests for useThemeColors hook` - 7 tests covering context and fallback paths
3. `feat(ui): add fallback pattern to useThemeColors` - Dual-context support added
4. `refactor: switch useIsDark imports to @datarecce/ui/hooks` - 23 files
5. `refactor: switch useThemeColors imports to @datarecce/ui/hooks` - 5 files
6. `refactor: remove local useIsDark and useThemeColors` - 188 lines deleted
7. `docs: add @recce-migration NOT_APPLICABLE documentation` - 5 files

### Verification
- All 1226 tests pass
- TypeScript type check passes
- Biome lint passes (371 files)

### Architecture Implemented
```
@datarecce/ui hooks work in TWO contexts:

1. With RecceProvider (recce-cloud-infra):
   └── useRecceThemeOptional() → ThemeContext → resolvedMode

2. Without RecceProvider (Recce OSS with next-themes):
   └── useIsDark() → MutationObserver → .dark class on <html>
```

---

## Phase 2: Context Unification (Future)

### Current State

| OSS Context | @datarecce/ui Counterpart | Architecture |
|-------------|---------------------------|--------------|
| `RecceInstanceContext` | `contexts/instance` | Similar |
| `IdleTimeoutContext` | `contexts/idle` | Similar |
| `LineageGraphContext` | `contexts/lineage` | **Different** - OSS fetches, @datarecce/ui is props-driven |
| `RecceActionContext` | `contexts/action` | Similar structure |
| `RecceCheckContext` | `providers/contexts/CheckContext` | OSS minimal, @datarecce/ui richer |
| `RecceQueryContext` | `providers/contexts/QueryContext` | Similar |
| `ApiConfigContext` | `providers/contexts/ApiContext` | Similar |

### Architectural Difference

**OSS contexts:** Internal data fetching via React Query
```typescript
const { data } = useQuery({ queryKey: ['lineage'], queryFn: fetchLineage });
```

**@datarecce/ui contexts:** Props-driven (headless)
```typescript
<LineageGraphProvider lineageGraph={data} onRefetch={refetch}>
```

### Recommended Approach for Phase 2

Create adapter layer in OSS:
1. OSS creates thin "fetcher" components using React Query
2. Pass fetched data as props to @datarecce/ui providers
3. Achieves single source of truth for context logic

### Scope Considerations

- Larger refactor than hooks migration
- Requires careful testing of data flow
- May impact performance if not done carefully
- Should be separate PR with thorough review

### Recommended Next Steps for Phase 2

1. **Design adapter pattern** - Document how OSS fetcher components will wrap @datarecce/ui providers
2. **Start with LineageGraphContext** - Most architectural difference, good test case
3. **Create interface contracts** - Define shared types between OSS fetchers and @datarecce/ui providers
4. **Incremental migration** - One context at a time with full test coverage

---

## Success Criteria

### Phase 1 (Complete)
- [x] Tests exist for useIsDark and useThemeColors in @datarecce/ui
- [x] useThemeColors works without RecceProvider (falls back to useIsDark with DOM class detection)
- [x] OSS imports hooks from @datarecce/ui (27 files updated)
- [x] Local OSS hook files deleted (useIsDark.ts, useThemeColors.ts)
- [x] NOT_APPLICABLE files documented (5 files with @recce-migration marker)

### Phase 2 (Future)
- [ ] Adapter layer design documented
- [ ] Context implementations unified
- [ ] Shared types/interfaces exported

---

## References

- [Component Library Audit](./2026-01-03-component-library-audit.md)
- [@datarecce/ui RecceProvider](../../js/packages/ui/src/providers/RecceProvider.tsx)
- [OSS RecceContextProvider](../../js/src/lib/hooks/RecceContextProvider.tsx)
