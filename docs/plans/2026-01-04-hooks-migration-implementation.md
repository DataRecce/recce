# Hooks Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Recce OSS to consume useIsDark and useThemeColors from @datarecce/ui, with proper tests and documentation.

**Architecture:** Update @datarecce/ui hooks to use optional fallback pattern (works with or without RecceProvider), then switch all OSS imports to @datarecce/ui/hooks, delete local copies, and document NOT_APPLICABLE files.

**Tech Stack:** TypeScript, React, Jest, @testing-library/react

---

## Task 1: Add useIsDark Tests to @datarecce/ui

**Files:**
- Create: `js/packages/ui/src/hooks/useIsDark.test.tsx`

**Step 1: Write the test file**

```typescript
/**
 * @file useIsDark.test.tsx
 * @description Tests for useIsDark hook
 *
 * Tests verify:
 * - Returns false during SSR (hydration safety)
 * - Returns true when .dark class is on <html>
 * - Returns false when .dark class is absent
 * - Works without RecceProvider (fallback path)
 * - Works with RecceProvider (context path)
 */

import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { useIsDark } from "./useIsDark";
import { ThemeProvider } from "../providers/contexts/ThemeContext";

// Helper to toggle dark class on document
const setDarkClass = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

describe("useIsDark", () => {
  beforeEach(() => {
    // Reset to light mode before each test
    document.documentElement.classList.remove("dark");
  });

  describe("without RecceProvider (fallback mode)", () => {
    it("returns false initially (hydration safety)", () => {
      const { result } = renderHook(() => useIsDark());
      // First render should be false to prevent hydration mismatch
      expect(result.current).toBe(false);
    });

    it("returns false when .dark class is absent", async () => {
      setDarkClass(false);
      const { result } = renderHook(() => useIsDark());

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current).toBe(false);
    });

    it("returns true when .dark class is present", async () => {
      setDarkClass(true);
      const { result } = renderHook(() => useIsDark());

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current).toBe(true);
    });

    it("reacts to class changes via MutationObserver", async () => {
      setDarkClass(false);
      const { result } = renderHook(() => useIsDark());

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(result.current).toBe(false);

      // Toggle to dark
      await act(async () => {
        setDarkClass(true);
        // MutationObserver is async, give it time
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current).toBe(true);
    });
  });

  describe("with RecceProvider (context mode)", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ThemeProvider defaultMode="dark">{children}</ThemeProvider>
    );

    it("returns true when ThemeProvider is in dark mode", async () => {
      const { result } = renderHook(() => useIsDark(), { wrapper });

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current).toBe(true);
    });

    it("returns false when ThemeProvider is in light mode", async () => {
      const lightWrapper = ({ children }: { children: ReactNode }) => (
        <ThemeProvider defaultMode="light">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useIsDark(), { wrapper: lightWrapper });

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it works**

Run: `npx jest packages/ui/src/hooks/useIsDark.test.tsx`
Expected: PASS (all tests should pass since useIsDark already has fallback)

**Step 3: Verify assumption - confirm useIsDark already has fallback**

Run: `grep -n "useRecceThemeOptional" packages/ui/src/hooks/useIsDark.ts`
Expected: Should find the optional hook usage

**Step 4: Commit**

```bash
git add packages/ui/src/hooks/useIsDark.test.tsx
git commit -s -m "test(ui): add tests for useIsDark hook

Tests verify:
- Hydration safety (returns false initially)
- DOM class detection without RecceProvider
- MutationObserver reactivity
- Context mode with RecceProvider"
```

---

## Task 2: Add useThemeColors Tests to @datarecce/ui

**Files:**
- Create: `js/packages/ui/src/hooks/useThemeColors.test.tsx`

**Step 1: Write the test file**

```typescript
/**
 * @file useThemeColors.test.tsx
 * @description Tests for useThemeColors hook
 *
 * Tests verify:
 * - Returns correct colors for light mode
 * - Returns correct colors for dark mode
 * - Works without RecceProvider (fallback path) - AFTER we add fallback
 * - Works with RecceProvider (context path)
 */

import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { useThemeColors } from "./useThemeColors";
import { ThemeProvider } from "../providers/contexts/ThemeContext";
import { colors } from "../theme/colors";

// Mock MUI theme hook
jest.mock("@mui/material/styles", () => ({
  useTheme: () => ({
    palette: { mode: "light" },
  }),
}));

// Helper to toggle dark class on document
const setDarkClass = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

describe("useThemeColors", () => {
  beforeEach(() => {
    // Reset to light mode before each test
    document.documentElement.classList.remove("dark");
  });

  describe("with RecceProvider", () => {
    it("returns light mode colors when ThemeProvider is in light mode", async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ThemeProvider defaultMode="light">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useThemeColors(), { wrapper });

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.isDark).toBe(false);
      expect(result.current.background.default).toBe(colors.white);
      expect(result.current.text.primary).toBe(colors.neutral[900]);
    });

    it("returns dark mode colors when ThemeProvider is in dark mode", async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ThemeProvider defaultMode="dark">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useThemeColors(), { wrapper });

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.isDark).toBe(true);
      expect(result.current.background.default).toBe(colors.neutral[900]);
      expect(result.current.text.primary).toBe(colors.neutral[50]);
    });
  });

  describe("without RecceProvider (fallback mode)", () => {
    it("returns light mode colors when .dark class is absent", async () => {
      setDarkClass(false);
      const { result } = renderHook(() => useThemeColors());

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.isDark).toBe(false);
      expect(result.current.background.default).toBe(colors.white);
    });

    it("returns dark mode colors when .dark class is present", async () => {
      setDarkClass(true);
      const { result } = renderHook(() => useThemeColors());

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.isDark).toBe(true);
      expect(result.current.background.default).toBe(colors.neutral[900]);
    });
  });

  describe("color structure", () => {
    it("returns all expected color categories", async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ThemeProvider defaultMode="light">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useThemeColors(), { wrapper });

      // Wait for mounted state
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Verify structure
      expect(result.current).toHaveProperty("isDark");
      expect(result.current).toHaveProperty("theme");
      expect(result.current).toHaveProperty("background");
      expect(result.current).toHaveProperty("text");
      expect(result.current).toHaveProperty("border");
      expect(result.current).toHaveProperty("status");
      expect(result.current).toHaveProperty("interactive");

      // Verify nested structure
      expect(result.current.background).toHaveProperty("default");
      expect(result.current.background).toHaveProperty("paper");
      expect(result.current.background).toHaveProperty("subtle");
      expect(result.current.background).toHaveProperty("emphasized");
    });
  });
});
```

**Step 2: Run test to see which tests fail (fallback tests should fail)**

Run: `npx jest packages/ui/src/hooks/useThemeColors.test.tsx`
Expected: FAIL - "without RecceProvider" tests should fail (useThemeColors currently requires context)

**Step 3: Document the failure**

Note: The fallback tests fail because useThemeColors currently uses `useRecceTheme()` which throws. This confirms we need to add the fallback pattern in Task 3.

**Step 4: Commit the test file (tests will pass after Task 3)**

```bash
git add packages/ui/src/hooks/useThemeColors.test.tsx
git commit -s -m "test(ui): add tests for useThemeColors hook

Tests verify:
- Light/dark mode color values
- Color structure (background, text, border, status, interactive)
- Context mode with RecceProvider
- Fallback mode without RecceProvider (will pass after implementation)"
```

---

## Task 3: Update useThemeColors with Fallback Pattern

**Files:**
- Modify: `js/packages/ui/src/hooks/useThemeColors.ts`

**Step 1: Read current implementation**

Run: `cat packages/ui/src/hooks/useThemeColors.ts`
Expected: See current implementation using `useRecceTheme()`

**Step 2: Update to use optional fallback pattern**

Replace the entire file with:

```typescript
"use client";

import { useTheme as useMuiTheme } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { useRecceThemeOptional } from "../providers/contexts/ThemeContext";
import { colors } from "../theme/colors";
import { useIsDark } from "./useIsDark";

/**
 * Theme-aware color utility hook
 *
 * Returns a consistent set of colors based on the current theme mode.
 *
 * **Dual-Context Support:**
 * This hook works in two contexts:
 * 1. **With RecceProvider** (recce-cloud-infra): Uses ThemeContext for theme detection
 * 2. **Without RecceProvider** (Recce OSS with next-themes): Falls back to useIsDark
 *    which uses DOM class detection (.dark on <html>)
 *
 * This allows @datarecce/ui components to work in both environments without
 * requiring the host application to wrap everything in RecceProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isDark, background, text, border } = useThemeColors();
 *
 *   return (
 *     <Box sx={{
 *       bgcolor: background.paper,
 *       color: text.primary,
 *       borderColor: border.default,
 *     }}>
 *       Content
 *     </Box>
 *   );
 * }
 * ```
 */
export function useThemeColors() {
  const muiTheme = useMuiTheme();
  // Try context first (returns null if not in RecceProvider)
  const themeContext = useRecceThemeOptional();
  // Fallback to useIsDark which has DOM class detection
  const isDarkFallback = useIsDark();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine dark mode: prefer context if available, otherwise use fallback
  const isDark = mounted
    ? themeContext
      ? themeContext.resolvedMode === "dark"
      : isDarkFallback
    : false;

  return {
    /** Whether the current theme is dark mode */
    isDark,

    /** MUI theme object for direct access when needed */
    theme: muiTheme,

    /** Background colors */
    background: {
      /** Default page background */
      default: isDark ? colors.neutral[900] : colors.white,
      /** Paper/card background */
      paper: isDark ? colors.neutral[800] : colors.white,
      /** Subtle background for slight elevation (e.g., hover states, inputs) */
      subtle: isDark ? colors.neutral[800] : colors.neutral[50],
      /** Emphasized background for higher contrast areas */
      emphasized: isDark ? colors.neutral[700] : colors.neutral[100],
    },

    /** Text colors */
    text: {
      /** Primary text color */
      primary: isDark ? colors.neutral[50] : colors.neutral[900],
      /** Secondary/muted text color */
      secondary: isDark ? colors.neutral[400] : colors.neutral[600],
      /** Disabled text color */
      disabled: isDark ? colors.neutral[500] : colors.neutral[400],
      /** Inverted text (for use on dark backgrounds in light mode, etc.) */
      inverted: isDark ? colors.neutral[900] : colors.neutral[50],
    },

    /** Border colors */
    border: {
      /** Light border for subtle separations */
      light: isDark ? colors.neutral[700] : colors.neutral[200],
      /** Default border color */
      default: isDark ? colors.neutral[600] : colors.neutral[300],
      /** Strong border for emphasis */
      strong: isDark ? colors.neutral[500] : colors.neutral[400],
    },

    /** Status/semantic colors */
    status: {
      /** Added/success backgrounds */
      added: {
        bg: isDark ? colors.green[900] : colors.green[100],
        text: isDark ? colors.neutral[50] : colors.neutral[900],
      },
      /** Removed/error backgrounds */
      removed: {
        bg: isDark ? colors.red[950] : colors.red[200],
        text: isDark ? colors.neutral[50] : colors.neutral[900],
      },
      /** Modified/warning backgrounds */
      modified: {
        bg: isDark ? colors.yellow[900] : colors.amber[100],
        text: isDark ? colors.neutral[50] : colors.neutral[900],
      },
    },

    /** Interactive element colors */
    interactive: {
      /** Hover state background */
      hover: isDark ? colors.neutral[700] : colors.neutral[100],
      /** Active/pressed state background */
      active: isDark ? colors.neutral[600] : colors.neutral[200],
      /** Focus ring color */
      focus: colors.iochmara[500],
    },
  };
}

export type ThemeColors = ReturnType<typeof useThemeColors>;
```

**Step 3: Run tests to verify all pass**

Run: `npx jest packages/ui/src/hooks/useThemeColors.test.tsx`
Expected: PASS - all tests including fallback tests should now pass

**Step 4: Run useIsDark tests to ensure no regression**

Run: `npx jest packages/ui/src/hooks/useIsDark.test.tsx`
Expected: PASS

**Step 5: Run type check**

Run: `pnpm type:check`
Expected: No errors

**Step 6: Commit**

```bash
git add packages/ui/src/hooks/useThemeColors.ts
git commit -s -m "feat(ui): add fallback pattern to useThemeColors

useThemeColors now works in two contexts:
1. With RecceProvider: Uses ThemeContext (recce-cloud-infra)
2. Without RecceProvider: Falls back to useIsDark DOM detection (Recce OSS)

This enables OSS to consume @datarecce/ui/hooks without needing RecceProvider."
```

---

## Task 4: Switch OSS useIsDark Imports to @datarecce/ui

**Files:**
- Modify: 16+ files in `js/src/components/` that import useIsDark

**Step 1: Find all files to update**

Run: `grep -rl "from \"@/lib/hooks/useIsDark\"" src/`
Expected: List of ~16 files

**Step 2: Update imports using sed**

Run:
```bash
find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "from \"@/lib/hooks/useIsDark\"" | while read file; do
  sed -i '' 's|from "@/lib/hooks/useIsDark"|from "@datarecce/ui/hooks"|g' "$file"
  echo "Updated: $file"
done
```

**Step 3: Verify all imports updated**

Run: `grep -r "from \"@/lib/hooks/useIsDark\"" src/`
Expected: No matches

**Step 4: Verify new imports exist**

Run: `grep -r "from \"@datarecce/ui/hooks\"" src/ | grep useIsDark | wc -l`
Expected: ~16 files

**Step 5: Run type check to verify imports resolve**

Run: `pnpm type:check`
Expected: No errors

**Step 6: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/
git commit -s -m "refactor: switch useIsDark imports to @datarecce/ui/hooks

Updated ~16 files to import useIsDark from @datarecce/ui/hooks
instead of local @/lib/hooks/useIsDark."
```

---

## Task 5: Switch OSS useThemeColors Imports to @datarecce/ui

**Files:**
- Modify: 4+ files in `js/src/components/` that import useThemeColors

**Step 1: Find all files to update**

Run: `grep -rl "from \"@/lib/hooks/useThemeColors\"" src/`
Expected: List of ~4 files

**Step 2: Update imports using sed**

Run:
```bash
find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "from \"@/lib/hooks/useThemeColors\"" | while read file; do
  sed -i '' 's|from "@/lib/hooks/useThemeColors"|from "@datarecce/ui/hooks"|g' "$file"
  echo "Updated: $file"
done
```

**Step 3: Verify all imports updated**

Run: `grep -r "from \"@/lib/hooks/useThemeColors\"" src/`
Expected: No matches

**Step 4: Run type check**

Run: `pnpm type:check`
Expected: No errors

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/
git commit -s -m "refactor: switch useThemeColors imports to @datarecce/ui/hooks

Updated ~4 files to import useThemeColors from @datarecce/ui/hooks
instead of local @/lib/hooks/useThemeColors."
```

---

## Task 6: Delete OSS Local Hook Files

**Files:**
- Delete: `js/src/lib/hooks/useIsDark.ts`
- Delete: `js/src/lib/hooks/useThemeColors.ts`

**Step 1: Verify no remaining imports**

Run: `grep -r "@/lib/hooks/useIsDark\|@/lib/hooks/useThemeColors" src/`
Expected: No matches (except possibly test mocks)

**Step 2: Delete the files**

Run:
```bash
rm src/lib/hooks/useIsDark.ts
rm src/lib/hooks/useThemeColors.ts
```

**Step 3: Run type check to confirm no broken references**

Run: `pnpm type:check`
Expected: No errors

**Step 4: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -s -m "refactor: remove local useIsDark and useThemeColors

These hooks are now consumed from @datarecce/ui/hooks.
OSS no longer maintains local copies."
```

---

## Task 7: Document NOT_APPLICABLE Files

**Files:**
- Modify: `js/src/lib/hooks/RecceShareStateContext.tsx`
- Modify: `js/src/lib/hooks/useCheckEvents.ts`
- Modify: `js/src/lib/hooks/useCountdownToast.tsx`
- Modify: `js/src/lib/hooks/useFeedbackCollectionToast.tsx`
- Modify: `js/src/lib/hooks/useGuideToast.tsx`

**Step 1: Add documentation to RecceShareStateContext.tsx**

Add at the top of the file (after any "use client" directive):

```typescript
/**
 * @recce-migration NOT_APPLICABLE
 *
 * This context is specific to Recce OSS and should not be migrated to @datarecce/ui.
 *
 * Reason: Share state functionality is tied to OSS-specific local state management
 * and export features. It manages the share URL generation and state serialization
 * that is unique to the OSS deployment model.
 *
 * If this changes in the future, consider:
 * - Moving to @datarecce/ui if share functionality becomes cross-platform
 * - Creating an abstract interface for different share backends
 */
```

**Step 2: Add documentation to useCheckEvents.ts**

Add at the top of the file:

```typescript
/**
 * @recce-migration NOT_APPLICABLE
 *
 * This hook is specific to Recce Cloud and should not be migrated to @datarecce/ui.
 *
 * Reason: Check events (timeline, comments, approvals) are a Cloud-only feature
 * that requires the Recce Cloud backend API. OSS does not have this functionality.
 *
 * If this changes in the future, consider:
 * - Moving to @datarecce/ui if check events become available in OSS
 * - Creating an abstract interface if multiple backends need to support events
 */
```

**Step 3: Add documentation to useCountdownToast.tsx**

Add at the top of the file:

```typescript
/**
 * @recce-migration NOT_APPLICABLE
 *
 * This hook is specific to Recce OSS and should not be migrated to @datarecce/ui.
 *
 * Reason: Server lifetime countdown is an OSS-specific feature for local
 * development servers. It shows remaining time before auto-shutdown.
 * Cloud deployments do not have this concept.
 *
 * If this changes in the future, consider:
 * - This is unlikely to be needed in cloud/shared contexts
 */
```

**Step 4: Add documentation to useFeedbackCollectionToast.tsx**

Add at the top of the file:

```typescript
/**
 * @recce-migration NOT_APPLICABLE
 *
 * This hook is specific to Recce OSS and should not be migrated to @datarecce/ui.
 *
 * Reason: Feedback collection UI with emoji reactions and localStorage persistence
 * is an OSS-specific engagement feature. It uses OSS-specific feature flags and
 * analytics endpoints.
 *
 * If this changes in the future, consider:
 * - Moving to @datarecce/ui if feedback collection becomes cross-platform
 * - Abstracting the storage and analytics backends
 */
```

**Step 5: Add documentation to useGuideToast.tsx**

Add at the top of the file:

```typescript
/**
 * @recce-migration NOT_APPLICABLE
 *
 * This hook is specific to Recce OSS and should not be migrated to @datarecce/ui.
 *
 * Reason: Onboarding guide toasts are tied to OSS-specific feature flags and
 * user onboarding flows. Cloud has different onboarding patterns.
 *
 * If this changes in the future, consider:
 * - Creating a generic toast system in @datarecce/ui
 * - Keeping onboarding logic in host applications
 */
```

**Step 6: Verify documentation added**

Run: `grep -l "@recce-migration NOT_APPLICABLE" src/lib/hooks/`
Expected: 5 files listed

**Step 7: Run linting to ensure no formatting issues**

Run: `pnpm lint`
Expected: No errors

**Step 8: Commit**

```bash
git add src/lib/hooks/RecceShareStateContext.tsx \
        src/lib/hooks/useCheckEvents.ts \
        src/lib/hooks/useCountdownToast.tsx \
        src/lib/hooks/useFeedbackCollectionToast.tsx \
        src/lib/hooks/useGuideToast.tsx
git commit -s -m "docs: add @recce-migration NOT_APPLICABLE documentation

Documented 5 hooks/contexts that should remain in OSS:
- RecceShareStateContext: OSS-specific share functionality
- useCheckEvents: Cloud-only check timeline feature
- useCountdownToast: OSS server lifetime countdown
- useFeedbackCollectionToast: OSS feedback collection
- useGuideToast: OSS onboarding guides"
```

---

## Task 8: Final Verification

**Step 1: Run full type check**

Run: `pnpm type:check`
Expected: No errors

**Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (should be 1200+ tests)

**Step 3: Run linting**

Run: `pnpm lint`
Expected: No errors

**Step 4: Verify hooks are exported from @datarecce/ui**

Run: `grep -A5 "export" packages/ui/src/hooks/index.ts`
Expected: See useIsDark and useThemeColors exported

**Step 5: Verify OSS imports from @datarecce/ui**

Run: `grep -r "from \"@datarecce/ui/hooks\"" src/ | wc -l`
Expected: ~20 imports

**Step 6: Verify local hook files deleted**

Run: `ls src/lib/hooks/useIsDark.ts src/lib/hooks/useThemeColors.ts 2>&1`
Expected: "No such file or directory" for both

**Step 7: Verify NOT_APPLICABLE docs added**

Run: `grep -c "@recce-migration NOT_APPLICABLE" src/lib/hooks/*.tsx src/lib/hooks/*.ts`
Expected: 5 files with this marker

**Step 8: Update design document status**

Modify `docs/plans/2026-01-04-hooks-context-migration-design.md`:
- Change status from "Approved" to "Complete"
- Check off all Phase 1 success criteria

**Step 9: Final commit**

```bash
git add docs/plans/2026-01-04-hooks-context-migration-design.md
git commit -s -m "docs: mark hooks migration design as complete

All Phase 1 success criteria met:
- Tests exist for useIsDark and useThemeColors
- useThemeColors works without RecceProvider
- OSS imports hooks from @datarecce/ui
- Local OSS hook files deleted
- NOT_APPLICABLE files documented"
```

---

## Summary

| Task | Description | Tests | Commits |
|------|-------------|-------|---------|
| 1 | Add useIsDark tests | 6 tests | 1 |
| 2 | Add useThemeColors tests | 8 tests | 1 |
| 3 | Update useThemeColors with fallback | Run existing | 1 |
| 4 | Switch useIsDark imports | Type check + suite | 1 |
| 5 | Switch useThemeColors imports | Type check + suite | 1 |
| 6 | Delete local hook files | Type check + suite | 1 |
| 7 | Document NOT_APPLICABLE files | Lint | 1 |
| 8 | Final verification | Full suite | 1 |

**Total: 8 tasks, 8 commits**
