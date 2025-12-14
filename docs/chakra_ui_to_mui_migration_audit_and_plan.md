# Chakra UI to MUI Migration Audit & Plan

Owner: Jared Scott
Last edited time: December 14, 2025 9:43 AM

**Project:** Unify React UI Framework Across Recce Products

**Issue:** DRC-2305

**Date:** December 13, 2025

**Author:** Jared Scott

---

## Executive Summary

This document provides a comprehensive audit of Chakra UI usage in Recce OSS and outlines a migration plan to MUI (Material UI). The migration is necessary to unify the UI framework across Recce Web, Recce Cloud, and Recce OSS, as Recce Web and Cloud already use MUI.

**Current State:** Chakra UI v3 (based on `createSystem` API usage)

**Target State:** MUI Material UI

---

## 1. Complete Inventory of Chakra UI Components

### 1.1 Layout Components

| Chakra Component | Usage Count | Files Using |
| --- | --- | --- |
| `Box` | High | 40+ files |
| `Flex` | High | 35+ files |
| `Grid` / `GridItem` | Medium | 8+ files |
| `Center` | Medium | 10+ files |
| `VStack` | Medium | 15+ files |
| `HStack` | Medium | 12+ files |
| `Stack` | Low | 5+ files |
| `Spacer` | Medium | 10+ files |
| `Wrap` / `WrapItem` | Low | 3+ files |

### 1.2 Typography & Text

| Chakra Component | Usage Count | Files Using |
| --- | --- | --- |
| `Text` | High | 50+ files |
| `Heading` | Medium | 8+ files |
| `Code` | Low | 5+ files |
| `Highlight` | Low | 2+ files |
| `Link` | Medium | 15+ files |

### 1.3 Form Components

| Chakra Component | Usage Count | Files Using |
| --- | --- | --- |
| `Button` | High | 40+ files |
| `IconButton` | High | 25+ files |
| `Input` | Medium | 12+ files |
| `Textarea` | Medium | 6+ files |
| `Checkbox` | Medium | 8+ files |
| `Switch` | Low | 3+ files |
| `Field` (FormControl) | Medium | 8+ files |
| `NativeSelect` | Low | 2+ files |
| `InputGroup` | Low | 3+ files |

### 1.4 Overlay & Modal Components

| Chakra Component | Usage Count | Files Using |
| --- | --- | --- |
| `Dialog` | High | 15+ files |
| `Popover` | Medium | 10+ files |
| `Menu` | High | 15+ files |
| `Portal` | High | 20+ files |
| `Tooltip` | Medium | Custom wrapper |

### 1.5 Feedback Components

| Chakra Component | Usage Count | Files Using |
| --- | --- | --- |
| `Alert` | Low | 3+ files |
| `Toast` / `Toaster` | Medium | Custom wrapper |
| `Spinner` | Medium | 8+ files |
| `ProgressCircle` | Medium | 5+ files |

### 1.6 Data Display Components

| Chakra Component | Usage Count | Files Using |
| --- | --- | --- |
| `Badge` | Low | 4+ files |
| `Tag` | Medium | 8+ files |
| `Avatar` | Low | 3+ files |
| `List` | Low | 3+ files |
| `Icon` | High | 30+ files |

### 1.7 Navigation Components

| Chakra Component | Usage Count | Files Using |
| --- | --- | --- |
| `Tabs` | Medium | 6+ files |
| `Breadcrumb` | Low | 2+ files |

### 1.8 Disclosure Components

| Chakra Component | Usage Count | Files Using |
| --- | --- | --- |
| `CloseButton` | Medium | 12+ files |

### 1.9 Third-Party Chakra Integrations

| Library | Usage | Files Using |
| --- | --- | --- |
| `chakra-react-select` | Multi-select dropdowns | `ValueDiffForm.tsx`, `ProfileDiffForm.tsx` |

---

## 2. Chakra Component → MUI Equivalent Mapping

### 2.1 Layout Components

| Chakra | MUI Equivalent | Notes |
| --- | --- | --- |
| `Box` | `Box` | Direct equivalent |
| `Flex` | `Box` with `display="flex"` or `Stack` | Use `sx` prop for flex properties |
| `Grid` / `GridItem` | `Grid` / `Grid item` | Similar API |
| `Center` | `Box` with centering styles | Use `sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}` |
| `VStack` | `Stack` with `direction="column"` |  |
| `HStack` | `Stack` with `direction="row"` |  |
| `Stack` | `Stack` | Direct equivalent |
| `Spacer` | `Box` with `flexGrow: 1` | No direct equivalent |
| `Wrap` / `WrapItem` | `Box` with `flexWrap` | No direct equivalent |
| `StackSeparator` | `Divider` in Stack | Use `divider` prop |

### 2.2 Typography & Text

| Chakra | MUI Equivalent | Notes |
| --- | --- | --- |
| `Text` | `Typography` | Use `variant` prop |
| `Heading` | `Typography` with variant | `variant="h1"` through `variant="h6"` |
| `Code` | `Typography` with `component="code"` | Or custom styled component |
| `Highlight` | Custom component | No direct equivalent |
| `Link` | `Link` from `@mui/material` | Similar API |

### 2.3 Form Components

| Chakra | MUI Equivalent | Notes |
| --- | --- | --- |
| `Button` | `Button` | Use `variant` and `color` props |
| `IconButton` | `IconButton` | Direct equivalent |
| `Input` | `TextField` or `Input` | `TextField` recommended |
| `Textarea` | `TextField` with `multiline` |  |
| `Checkbox` | `Checkbox` + `FormControlLabel` |  |
| `Switch` | `Switch` + `FormControlLabel` |  |
| `Field.Root` | `FormControl` |  |
| `Field.Label` | `InputLabel` or `FormLabel` |  |
| `NativeSelect` | `Select` with `native` | Or use `NativeSelect` |
| `InputGroup` | `TextField` with `InputAdornment` |  |

### 2.4 Overlay & Modal Components

| Chakra | MUI Equivalent | Notes |
| --- | --- | --- |
| `Dialog.Root` | `Dialog` | Similar compound component pattern |
| `Dialog.Header` | `DialogTitle` |  |
| `Dialog.Body` | `DialogContent` |  |
| `Dialog.Footer` | `DialogActions` |  |
| `Dialog.CloseTrigger` | Custom `IconButton` |  |
| `Popover` | `Popover` | Direct equivalent |
| `Menu.Root` | `Menu` |  |
| `Menu.Trigger` | `Button` or custom trigger | Use `anchorEl` pattern |
| `Menu.Content` | Implicit in `Menu` |  |
| `Menu.Item` | `MenuItem` |  |
| `Menu.Separator` | `Divider` |  |
| `Portal` | `Portal` | Direct equivalent |

### 2.5 Feedback Components

| Chakra | MUI Equivalent | Notes |
| --- | --- | --- |
| `Alert` | `Alert` | Direct equivalent |
| `Toast/Toaster` | `Snackbar` + `Alert` | Or use `notistack` library |
| `Spinner` | `CircularProgress` |  |
| `ProgressCircle` | `CircularProgress` |  |

### 2.6 Data Display Components

| Chakra | MUI Equivalent | Notes |
| --- | --- | --- |
| `Badge` | `Badge` or `Chip` | Context-dependent |
| `Tag` | `Chip` |  |
| `Avatar` | `Avatar` | Direct equivalent |
| `List` | `List` + `ListItem` |  |
| `Icon` | `SvgIcon` or icon components | Use `@mui/icons-material` |

### 2.7 Navigation Components

| Chakra | MUI Equivalent | Notes |
| --- | --- | --- |
| `Tabs` | `Tabs` + `Tab` |  |
| `Tabs.Content` | `TabPanel` (custom) | MUI doesn’t have built-in panel |
| `Breadcrumb` | `Breadcrumbs` |  |

### 2.8 Disclosure Components

| Chakra | MUI Equivalent | Notes |
| --- | --- | --- |
| `CloseButton` | `IconButton` with `CloseIcon` |  |

---

## 3. Custom Theme Tokens Mapping

### 3.1 Current Chakra Theme Structure

The Recce OSS theme is defined in `js/src/components/ui/theme.ts` using Chakra’s `createSystem` API:

```tsx
// Current Chakra theme structure
export const system = createSystem(defaultConfig, {
  preflight: { scope: ".chakra-style-reset" },
  theme: {
    tokens: {
      colors: {
        iochmara: { 50-950 color scale },
        cyan: { 50-950 color scale },
        neutral: { 50-950 color scale },
        amber: { 50-950 color scale },
        green: { 50-950 color scale },
        red: { 50-950 color scale },
        rose: { 50-950 color scale },
        brand: { 50-950 color scale },
      }
    },
    semanticTokens: {
      colors: {
        iochmara: { solid, contrast, fg, subtle, muted, emphasized, focusRing },
        // ... similar for other colors
        success: { value: "{colors.green}" },
        warning: { value: "{colors.amber}" },
        danger: { value: "{colors.red}" },
        envBase: { value: "{colors.amber.500}" },
        envCurrent: { value: "{colors.iochmara.500}" },
      }
    }
  }
});
```

### 3.2 MUI Theme Equivalent

```tsx
// Recommended MUI theme structure
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#3182CE', // iochmara.500
      light: '#5599D8',
      dark: '#2A6CA7',
      contrastText: '#fff',
    },
    secondary: {
      main: '#06B6D4', // cyan.500
    },
    success: {
      main: '#22C55E', // green.500
    },
    warning: {
      main: '#F59E0B', // amber.500
    },
    error: {
      main: '#EF4444', // red.500
    },
    grey: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      // ... neutral scale
    },
    // Custom colors
    brand: {
      main: '#FD541E',
      light: '#FF6E42',
      dark: '#F04104',
    },
    envBase: {
      main: '#F59E0B', // amber.500
    },
    envCurrent: {
      main: '#3182CE', // iochmara.500
    },
  },
  components: {
    // Component-specific overrides
  },
});
```

### 3.3 Custom Color Palette: `iochmara`

The custom `iochmara` color (blue variant) is used extensively as the primary brand color. MUI mapping:

| Chakra Token | MUI Equivalent |
| --- | --- |
| `colorPalette="iochmara"` | `color="primary"` |
| `colorPalette="blue"` | `color="primary"` (aliased) |
| `colorPalette="gray"` | `color="inherit"` or custom |

---

## 4. Chakra-Specific Patterns Requiring Alternative Approaches

### 4.1 Style Props (System Props)

**Chakra Pattern:**

```tsx
<Box p="4" m="2" bg="gray.100" borderRadius="md" _hover={{ bg: "gray.200" }}>
```

**MUI Equivalent:**

```tsx
<Box sx={{ p: 2, m: 1, bgcolor: 'grey.100', borderRadius: 1, '&:hover': { bgcolor: 'grey.200' } }}>
```

### 4.2 Pseudo-Selectors (`_hover`, `_focus`, `_active`)

**Chakra Pattern:**

```tsx
<Button _hover={{ bg: "blue.600" }} _active={{ bg: "blue.700" }}>
```

**MUI Equivalent:**

```tsx
<Button sx={{ '&:hover': { bgcolor: 'primary.dark' }, '&:active': { bgcolor: 'primary.darker' } }}>
```

### 4.3 Group Selectors (`className="group"`, `_groupHover`)

**Chakra Pattern:**

```tsx
<Box className="group">
  <Icon _groupHover={{ color: "blue.500" }} />
</Box>
```

**MUI Equivalent:**

```tsx
<Box sx={{ '&:hover .icon': { color: 'primary.main' } }}>
  <Icon className="icon" />
</Box>
```

### 4.4 `colorPalette` Prop

**Chakra Pattern:**

```tsx
<Button colorPalette="iochmara">Submit</Button>
```

**MUI Equivalent:**

```tsx
<Button color="primary">Submit</Button>
```

### 4.5 Compound Components Pattern

Chakra uses compound components extensively:

**Chakra Pattern:**

```tsx
<Dialog.Root open={isOpen}>
  <Dialog.Header><Dialog.Title>Title</Dialog.Title></Dialog.Header>
  <Dialog.Body>Content</Dialog.Body>
  <Dialog.Footer>Actions</Dialog.Footer>
  <Dialog.CloseTrigger><CloseButton /></Dialog.CloseTrigger>
</Dialog.Root>
```

**MUI Equivalent:**

```tsx
<Dialog open={isOpen}>
  <DialogTitle>Title</DialogTitle>
  <DialogContent>Content</DialogContent>
  <DialogActions>Actions</DialogActions>
  <IconButton onClick={onClose}><CloseIcon /></IconButton>
</Dialog>
```

### 4.6 `useDisclosure` Hook

**Chakra Pattern:**

```tsx
const { open, onOpen, onClose } = useDisclosure();
```

**MUI Equivalent:**

```tsx
const [open, setOpen] = useState(false);
const onOpen = () => setOpen(true);
const onClose = () => setOpen(false);
// Or create a custom hook
```

### 4.7 Toaster System

**Chakra Pattern:**

```tsx
import { toaster } from "@/components/ui/toaster";
toaster.create({ description: "Success!", type: "success" });
```

**MUI Equivalent:**
Use `notistack` library or custom Snackbar context:

```tsx
import { useSnackbar } from 'notistack';
const { enqueueSnackbar } = useSnackbar();
enqueueSnackbar("Success!", { variant: "success" });
```

### 4.8 Menu Positioning

**Chakra Pattern:**

```tsx
<Menu.Root positioning={{ placement: "bottom-end" }}>
```

**MUI Equivalent:**

```tsx
<Menu anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
```

### 4.9 Custom Tooltip Wrapper

Current: `js/src/components/ui/tooltip.tsx` wraps Chakra’s Tooltip.

**Migration:** Create equivalent MUI wrapper maintaining the same API.

---

## 5. Effort Estimation by Component Category

| Category | Components | Effort | Risk | Priority |
| --- | --- | --- | --- | --- |
| **Layout** | Box, Flex, Grid, Stack variants | Low | Low | P1 - Foundation |
| **Typography** | Text, Heading, Code, Link | Low | Low | P1 - Foundation |
| **Buttons** | Button, IconButton | Medium | Low | P2 - Core |
| **Form Inputs** | Input, Textarea, Checkbox, Switch, Select | Medium | Medium | P2 - Core |
| **Dialogs** | Dialog compound component | High | Medium | P3 - Complex |
| **Menus** | Menu compound component | High | Medium | P3 - Complex |
| **Popover** | Popover with positioning | High | Medium | P3 - Complex |
| **Tabs** | Tabs compound component | Medium | Low | P2 - Core |
| **Toast/Snackbar** | Custom toaster system | High | High | P4 - Custom |
| **Theme** | Color system, tokens | High | High | P0 - Critical |
| **Third-party** | chakra-react-select | Medium | Medium | P3 - Complex |

### Total Effort Estimate

| Phase | Description | Estimated Time |
| --- | --- | --- |
| P0 | Theme setup & design tokens | 2-3 days |
| P1 | Foundation (Layout, Typography) | 3-4 days |
| P2 | Core components (Forms, Buttons, Tabs) | 4-5 days |
| P3 | Complex components (Dialogs, Menus, Popovers) | 5-7 days |
| P4 | Custom systems (Toaster, Select) | 2-3 days |
| Testing & QA | Visual regression, functional testing | 3-4 days |
| **Total** |  | **19-26 days** |

---

## 6. High-Risk Areas

### 6.1 Complex Components with Heavy Customization

1. **Custom Toaster System** (`js/src/components/ui/toaster.tsx`)
    - Wrapped Chakra’s toaster with custom API
    - Requires migration to `notistack` or custom Snackbar context
2. **Tooltip Wrapper** (`js/src/components/ui/tooltip.tsx`)
    - Custom wrapper around Chakra Tooltip
    - Maintains consistent API across codebase
3. **Color Mode System** (`js/src/components/ui/color-mode.tsx`)
    - Integrates `next-themes` with Chakra
    - MUI has different dark mode approach
4. **Menu Components** (various files)
    - Heavy use of compound component pattern
    - Complex positioning requirements
    - Context menus in LineageView
5. **chakra-react-select Integration**
    - Used in ValueDiffForm, ProfileDiffForm
    - Need to find MUI equivalent (react-select with MUI styling or Autocomplete)

### 6.2 Files with Most Chakra Imports

1. `CheckDetail.tsx` - 25+ Chakra imports
2. `LineageView.tsx` - 15+ Chakra imports
3. `LineageViewTopBar.tsx` - 15+ Chakra imports
4. `NodeView.tsx` - 15+ Chakra imports
5. `RunResultPane.tsx` - 12+ Chakra imports

### 6.3 Potential Breaking Changes

1. **Style Props → `sx` Prop:** All inline Chakra style props must migrate to MUI’s `sx` prop
2. **Color System:** `colorPalette` doesn’t exist in MUI; requires mapping to `color` prop
3. **Compound Components:** Different API patterns for Dialog, Menu, Tabs
4. **useDisclosure:** No MUI equivalent; need custom hook or useState

---

## 7. Recommended Migration Order

### Phase 0: Setup (Week 1)

1. Set up MUI theme with Recce color tokens
2. Create migration utilities/helpers
3. Set up component testing infrastructure
4. Create custom hooks (`useDisclosure` equivalent)

### Phase 1: Foundation Components (Week 1-2)

1. `Box`, `Flex` → MUI `Box`, `Stack`
2. `Text`, `Heading` → MUI `Typography`
3. `Icon` wrapper for react-icons
4. Layout primitives (Center, Spacer, Grid)

### Phase 2: Core Interaction Components (Week 2-3)

1. `Button`, `IconButton`
2. Form components (Input, Textarea, Checkbox, Switch)
3. `Tabs` component
4. `Badge`, `Tag` → MUI `Chip`

### Phase 3: Complex Overlay Components (Week 3-4)

1. `Dialog` compound component
2. `Menu` compound component
3. `Popover` component
4. `Tooltip` wrapper

### Phase 4: Custom Systems & Third-Party (Week 4-5)

1. Toaster system → `notistack`
2. Color mode integration
3. `chakra-react-select` → MUI Autocomplete
4. Provider setup

### Phase 5: Testing & Polish (Week 5-6)

1. Visual regression testing
2. Functional testing
3. Performance testing
4. Documentation updates

---

## 8. Migration Utilities to Create

```tsx
// Suggested utility functions

// 1. Style prop converter
const chakraToMuiSx = (chakraProps: ChakraStyleProps): SxProps => {
  // Convert Chakra style props to MUI sx format
};

// 2. Color palette mapper
const chakraColorToMui = (chakraColor: string): string => {
  const colorMap = {
    'iochmara': 'primary',
    'blue': 'primary',
    'cyan': 'secondary',
    'green': 'success',
    'amber': 'warning',
    'red': 'error',
  };
  return colorMap[chakraColor] || chakraColor;
};

// 3. useDisclosure hook
const useDisclosure = (defaultOpen = false) => {
  const [open, setOpen] = useState(defaultOpen);
  return {
    open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    onToggle: () => setOpen(!open),
  };
};
```

---

## 9. Testing Strategy

1. **Unit Tests:** Update existing tests to use MUI components
2. **Visual Regression:** Use Chromatic or Percy for visual diff testing
3. **Integration Tests:** Verify component interactions work correctly
4. **Accessibility:** Ensure WCAG compliance maintained or improved

---

## 10. Appendix: Files Requiring Migration

- Full list of files with Chakra imports (click to expand)

  ### Components

    - `js/src/components/ui/provider.tsx`
    - `js/src/components/ui/color-mode.tsx`
    - `js/src/components/ui/theme.ts`
    - `js/src/components/ui/toaster.tsx`
    - `js/src/components/ui/tooltip.tsx`
    - `js/src/components/check/CheckDetail.tsx`
    - `js/src/components/check/CheckDescription.tsx`
    - `js/src/components/check/CheckBreadcrumb.tsx`
    - `js/src/components/check/CheckEmptyState.tsx`
    - `js/src/components/check/SchemaDiffView.tsx`
    - `js/src/components/check/timeline/CommentInput.tsx`
    - `js/src/components/check/timeline/TimelineEvent.tsx`
    - `js/src/components/lineage/LineageView.tsx`
    - `js/src/components/lineage/LineageViewTopBar.tsx`
    - `js/src/components/lineage/LineageViewContextMenu.tsx`
    - `js/src/components/lineage/NodeView.tsx`
    - `js/src/components/lineage/SandboxView.tsx`
    - `js/src/components/lineage/ActionControl.tsx`
    - `js/src/components/lineage/ActionTag.tsx`
    - `js/src/components/lineage/ChangeStatusLegend.tsx`
    - `js/src/components/lineage/ColumnLevelLineageControl.tsx`
    - `js/src/components/lineage/ServerDisconnectedModalContent.tsx`
    - `js/src/components/run/RunModal.tsx`
    - `js/src/components/run/RunView.tsx`
    - `js/src/components/run/RunToolbar.tsx`
    - `js/src/components/run/RunResultPane.tsx`
    - `js/src/components/schema/ColumnNameCell.tsx`
    - `js/src/components/profile/ProfileDiffForm.tsx`
    - `js/src/components/valuediff/ValueDiffForm.tsx`
    - `js/src/components/top-k/TopKDiffForm.tsx`
    - `js/src/components/query/QueryPage.tsx`
    - `js/src/components/query/ChangedOnlyCheckbox.tsx`
    - `js/src/components/summary/ChangeSummary.tsx`
    - `js/src/components/summary/SummaryView.tsx`
    - `js/src/components/app/AvatarDropdown.tsx`
    - `js/src/components/app/Filename.tsx`
    - `js/src/components/app/StateImporter.tsx`
    - `js/src/components/app/StateSynchronizer.tsx`
    - `js/src/components/app/SetupConnectionPopover.tsx`
    - `js/src/components/timeout/IdleTimeoutBadge.tsx`
    - `js/src/components/ui/dataGrid/*.tsx`
    - `js/src/components/ui/markdown/ExternalLinkConfirmDialog.tsx`
    - `js/src/utils/DropdownValuesInput.tsx`

  ### App Directory

    - `js/app/(mainComponents)/NavBar.tsx`
    - `js/app/(mainComponents)/RecceVersionBadge.tsx`

  ### Hooks

    - `js/src/lib/hooks/LineageGraphContext.tsx`
    - `js/src/lib/hooks/ScreenShot.tsx`

  ### Theme Files

    - `js/theme/components/Checkbox.ts`
    - `js/theme/components/Tooltip.ts`

---

## 11. Next Steps

1. ✅ Complete this audit document
- [ ]  Review with team for feedback
- [ ]  Create detailed sub-tasks in Linear for each migration phase
- [ ]  Set up MUI theme with Recce design tokens
- [ ]  Begin Phase 1 migration (Foundation components)

---

*Document generated as part of DRC-2305*
