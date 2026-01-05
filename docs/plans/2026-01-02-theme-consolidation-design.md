# Theme Consolidation Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** ✅ Complete (2026-01-03) - Theme migrated to packages/ui/src/theme/

**Goal:** Make packages/ui the single source of truth for theming, eliminating duplication with Recce OSS.

**Architecture:** Migrate complete MUI theme from Recce OSS (`src/components/ui/mui-theme.ts`) to packages/ui (`src/theme/`), converting to MUI 7 CSS Variables mode. Recce OSS becomes a consumer.

**Tech Stack:** MUI 7, TypeScript, CSS Variables mode with `.dark` class toggle

---

## Context

### Current State

**packages/ui theme** (~460 lines)
- `colors.ts`: Color palette definitions (10 scales)
- `theme.ts`: MUI 7 with CSS Variables mode, Button/Chip variants for 2 colors (brand, iochmara)

**Recce OSS theme** (`mui-theme.ts`, ~1040 lines)
- Duplicates all color definitions
- 9 custom colors with variants for Button, Chip, Badge, CircularProgress
- 21 component overrides
- Separate light/dark theme objects (older pattern)
- Extra utilities: `token()`, `semanticColors`, `colorAliases`

### Current Usage in Recce OSS

```
colors         - 9 files
token()        - 4 files
lightTheme     - 5 files (including MuiProvider)
```

---

## Migration Scope

### Moves to packages/ui

| Item | Description |
|------|-------------|
| Color palette | All 10 color scales (verify completeness) |
| `colorAliases` | `orange→amber`, `gray→neutral` mappings |
| Button variants | 9 colors × 3 variants = 27 |
| Chip variants | 9 colors × 2 variants = 18 |
| Badge variants | 9 colors |
| CircularProgress variants | 9 colors |
| Component overrides | 21 components total |
| Module augmentations | All custom color types |

### Stays in Recce OSS

| Item | Reason |
|------|--------|
| `token()` function | Chakra migration utility |
| `semanticColors` | App-specific (envBase, envCurrent) |
| `semanticVariantMap` | Chakra migration utility |
| `MuiProvider` | App-level provider (updated to consume packages/ui) |

---

## File Structure (After Migration)

### packages/ui/src/theme/

```
theme/
├── index.ts          # Re-exports
├── colors.ts         # Complete color palette + colorAliases
└── theme.ts          # Full MUI theme with CSS Variables mode
```

### Recce OSS (Becomes Thin Wrapper)

**mui-theme.ts:**
- Imports `colors`, `theme` from `@datarecce/ui`
- Keeps only `token()`, `semanticColors`, `semanticVariantMap`
- Re-exports for backward compatibility

**mui-provider.tsx:**
- Uses single `theme` from `@datarecce/ui`
- Toggles `.dark` class instead of swapping theme objects

---

## Implementation Tasks

### Phase 1: Expand colors.ts (3 tasks)

#### Task 1: Verify color scales match
**Files:** `packages/ui/src/theme/colors.ts`, `src/components/ui/mui-theme.ts`

Compare all 10 color scales between files:
- brand, iochmara, neutral, cyan, amber, yellow, green, red, rose, fuchsia

Verify every shade (50-950) matches exactly.

**Validation:** Manual diff comparison, document any discrepancies

#### Task 2: Add colorAliases export
**Files:** `packages/ui/src/theme/colors.ts`

Add after color definitions:
```typescript
export const colorAliases: Record<string, keyof typeof colors> = {
  orange: "amber",
  gray: "neutral",
};
```

**Validation:** `pnpm type:check` in packages/ui

#### Task 3: Update theme/index.ts exports
**Files:** `packages/ui/src/theme/index.ts`

Ensure `colorAliases` is exported.

**Validation:** `pnpm type:check` in packages/ui

---

### Phase 2: Expand theme.ts - Module Augmentations (2 tasks)

#### Task 4: Add module augmentations for all custom colors
**Files:** `packages/ui/src/theme/theme.ts`

Expand existing augmentations to include all 9 colors:
- Palette: brand, iochmara, cyan, amber, green, red, rose, fuchsia, neutral
- Button color overrides: all 9
- Chip color overrides: all 9
- Add Badge color overrides: all 9
- Add CircularProgress color overrides: all 9

**Validation:** `pnpm type:check` in packages/ui

#### Task 5: Add neutral to palette type
**Files:** `packages/ui/src/theme/theme.ts`

Ensure `neutral` is in Palette interface (may already be there as alias to grey).

**Validation:** `pnpm type:check` in packages/ui

---

### Phase 3: Expand theme.ts - Variant Generators (4 tasks)

#### Task 6: Add createBadgeColorVariant helper
**Files:** `packages/ui/src/theme/theme.ts`

```typescript
function createBadgeColorVariant(
  colorName: CustomColorName,
  colorScale: typeof colors.brand,
) {
  return {
    props: { color: colorName },
    style: {
      "& .MuiBadge-badge": {
        backgroundColor: colorScale[500],
        color: "#ffffff",
      },
    },
  };
}
```

**Validation:** `pnpm type:check` in packages/ui

#### Task 7: Add createProgressColorVariant helper
**Files:** `packages/ui/src/theme/theme.ts`

```typescript
function createProgressColorVariant(
  colorName: CustomColorName,
  colorScale: typeof colors.brand,
) {
  return {
    props: { color: colorName },
    style: {
      color: colorScale[500],
    },
  };
}
```

**Validation:** `pnpm type:check` in packages/ui

#### Task 8: Generate Button variants for all 9 colors
**Files:** `packages/ui/src/theme/theme.ts`

Expand `buttonColorVariants` to include all 9 colors.

**Validation:** `pnpm type:check` in packages/ui

#### Task 9: Generate Chip variants for all 9 colors
**Files:** `packages/ui/src/theme/theme.ts`

Expand `chipColorVariants` to include all 9 colors.

**Validation:** `pnpm type:check` in packages/ui

---

### Phase 4: Expand theme.ts - Component Overrides (4 tasks)

#### Task 10: Add form component overrides
**Files:** `packages/ui/src/theme/theme.ts`

Add overrides for:
- MuiIconButton
- MuiTextField
- MuiOutlinedInput
- MuiCheckbox
- MuiSwitch

Copy from Recce OSS mui-theme.ts, adapt for CSS Variables mode.

**Validation:** `pnpm type:check` in packages/ui

#### Task 11: Add dialog/menu component overrides
**Files:** `packages/ui/src/theme/theme.ts`

Add overrides for:
- MuiDialog
- MuiDialogTitle
- MuiMenu
- MuiMenuItem

**Validation:** `pnpm type:check` in packages/ui

#### Task 12: Add feedback component overrides
**Files:** `packages/ui/src/theme/theme.ts`

Add overrides for:
- MuiAlert
- MuiTabs
- MuiTab
- MuiAvatar
- MuiBadge (with variants)

**Validation:** `pnpm type:check` in packages/ui

#### Task 13: Add utility component overrides
**Files:** `packages/ui/src/theme/theme.ts`

Add overrides for:
- MuiCircularProgress (with variants)
- MuiLink
- MuiPopover
- MuiDivider
- MuiBreadcrumbs

**Validation:** `pnpm type:check` in packages/ui

---

### Phase 5: Expand theme.ts - Palette (2 tasks)

#### Task 14: Add custom colors to light color scheme
**Files:** `packages/ui/src/theme/theme.ts`

In `colorSchemes.light.palette`, add:
- cyan, amber, green, red, rose, fuchsia (brand, iochmara, neutral already present)

**Validation:** `pnpm type:check` in packages/ui

#### Task 15: Add custom colors to dark color scheme
**Files:** `packages/ui/src/theme/theme.ts`

In `colorSchemes.dark.palette`, add same colors with dark mode adjustments.

**Validation:** `pnpm type:check` and `pnpm build` in packages/ui

---

### Phase 6: Update Recce OSS (3 tasks)

#### Task 16: Update mui-theme.ts
**Files:** `src/components/ui/mui-theme.ts`

1. Import colors, theme from `@datarecce/ui`
2. Remove duplicate color definitions
3. Remove duplicate component overrides
4. Keep: `token()`, `semanticColors`, `semanticVariantMap`
5. Re-export `colors` for backward compatibility
6. Export `lightTheme` and `darkTheme` as aliases to `theme` for compatibility

**Validation:** `pnpm type:check` in js/ root

#### Task 17: Update mui-provider.tsx
**Files:** `src/components/ui/mui-provider.tsx`

1. Import single `theme` from `@datarecce/ui` (or from local mui-theme re-export)
2. Instead of swapping themes, toggle `.dark` class on document
3. Keep next-themes integration for detecting preference

**Validation:** `pnpm type:check` in js/ root

#### Task 18: Verify imports across codebase
**Files:** All files importing from mui-theme.ts

Verify these imports still work:
- `import { colors } from "@/components/ui/mui-theme"` (9 files)
- `import { token } from "@/components/ui/mui-theme"` (4 files)
- `import { lightTheme as theme } from "@/components/ui/mui-theme"` (4 files)

No changes needed if re-exports are correct in Task 16.

**Validation:** `pnpm type:check` in js/ root

---

### Phase 7: Verification (3 tasks)

#### Task 19: Full packages/ui verification
**Commands:**
```bash
cd js/packages/ui
pnpm type:check
pnpm lint
pnpm build
```

**Expected:** All pass

#### Task 20: Full Recce OSS verification
**Commands:**
```bash
cd js
pnpm type:check
pnpm lint
pnpm test
```

**Expected:** All pass (921 tests)

#### Task 21: Manual dark mode verification
**Steps:**
1. Start dev server: `cd js && pnpm dev`
2. Open browser to localhost:3000
3. Toggle dark mode
4. Verify colors change correctly
5. Check no flash of wrong theme

**Expected:** Smooth theme transition, correct colors in both modes

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| CSS Variables mode behaves differently | Task 21 manual verification |
| Missing color values cause runtime errors | Task 1 explicit verification |
| Import path changes break Recce OSS | Task 16 re-exports for compatibility |
| Module augmentation conflicts | Consolidate all in one block |

## Backward Compatibility

- `colors` re-exported from mui-theme.ts (no import changes needed)
- `lightTheme`/`darkTheme` exported as aliases to single `theme`
- `token()` stays in Recce OSS unchanged

---

## Commit Strategy

One commit per phase:
1. `feat(ui): expand colors.ts with colorAliases`
2. `feat(ui): add module augmentations for all custom colors`
3. `feat(ui): add variant generators for all custom colors`
4. `feat(ui): add complete component overrides`
5. `feat(ui): add all custom colors to palette`
6. `refactor: update Recce OSS to consume @datarecce/ui theme`
7. `test: verify theme consolidation`
