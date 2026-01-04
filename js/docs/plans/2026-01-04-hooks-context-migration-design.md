# Hooks and Context Migration Design

**Status:** Complete
**Date:** 2026-01-04
**Author:** Claude Code

## Overview

This document describes the migration of hooks and context from the OSS application (`src/lib/hooks/`) to the shared `@datarecce/ui` package (`packages/ui/src/hooks/`).

## Phase 1: Theme Hooks Migration

### Goals

Migrate theme-related hooks that have no external dependencies to `@datarecce/ui`:

1. `useIsDark` - Dark mode detection hook
2. `useThemeColors` - Theme color provider hook

### Success Criteria

All criteria met:

- [x] Tests exist for `useIsDark` and `useThemeColors` in `packages/ui/src/hooks/`
- [x] `useThemeColors` works without `RecceProvider` (falls back to `useIsDark` with DOM class detection)
- [x] OSS imports hooks from `@datarecce/ui/hooks`
- [x] Local OSS hook files (`src/lib/hooks/useIsDark.ts`, `src/lib/hooks/useThemeColors.ts`) deleted
- [x] NOT_APPLICABLE files documented with `@recce-migration NOT_APPLICABLE` marker

### Migration Summary

#### Migrated Hooks

| Hook | Source | Destination | Tests |
|------|--------|-------------|-------|
| `useIsDark` | `src/lib/hooks/useIsDark.ts` | `packages/ui/src/hooks/useIsDark.ts` | `useIsDark.test.tsx` |
| `useThemeColors` | `src/lib/hooks/useThemeColors.ts` | `packages/ui/src/hooks/useThemeColors.ts` | `useThemeColors.test.tsx` |

#### OSS Files Updated

27 files in `src/` updated to import from `@datarecce/ui/hooks` instead of local paths.

#### NOT_APPLICABLE Hooks

The following hooks remain in `src/lib/hooks/` and are marked with `@recce-migration NOT_APPLICABLE`:

1. `RecceShareStateContext.tsx` - Deep OSS integration with share state management
2. `useCountdownToast.tsx` - Toast UI specific to OSS
3. `useFeedbackCollectionToast.tsx` - Feedback collection specific to OSS
4. `useGuideToast.tsx` - Guide toast specific to OSS
5. `useCheckEvents.ts` - Cloud-only feature for check events

These hooks are intentionally excluded from migration because they:
- Depend on OSS-specific context providers
- Use cloud-only APIs
- Are tightly coupled to OSS-specific features

## Verification Results

| Check | Result |
|-------|--------|
| Type check | PASS |
| Tests | PASS (1226 tests, 42 suites) |
| Lint | PASS (371 files) |
| Hooks exported | YES (`useIsDark`, `useThemeColors`, `ThemeColors`) |
| OSS imports count | 27 |
| Local files deleted | YES |
| NOT_APPLICABLE docs | 5 files |

## Future Phases

### Phase 2: useAppLocation Hook

Migrate `useAppLocation` which provides location-aware navigation.

### Phase 3: Context Providers

Evaluate migration of context providers that could be shared across applications.

## Notes

- The migration follows the established pattern of using workspace protocol imports
- TypeScript path mappings are configured in `tsconfig.json`
- Package exports are configured in `packages/ui/package.json`
