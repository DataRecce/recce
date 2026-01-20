# Component Usage Analysis - js/packages/ui

**Generated:** 2026-01-20
**Analysis:** Comprehensive verification of component imports (excluding tests)

---

## ✅ ALL UNUSED COMPONENTS REMOVED

These 7 components were found unused and have been **DELETED**:

| Component | File Path | Status |
|-----------|-----------|--------|
| **LineageControls** | `js/packages/ui/src/components/lineage/controls/LineageControls.tsx` | ✅ Deleted |
| **RecceLayout** | `js/packages/ui/src/components/views/RecceLayout.tsx` | ✅ Deleted |
| **RunsView** | `js/packages/ui/src/components/views/RunsView.tsx` | ✅ Deleted |
| **SchemaTable** | `js/packages/ui/src/components/schema/SchemaTable.tsx` | ✅ Deleted |
| **StatusBadge** | `js/packages/ui/src/components/ui/StatusBadge.tsx` | ✅ Deleted + test |
| **SummaryView** | `js/packages/ui/src/components/summary/SummaryView.tsx` | ✅ Deleted |
| **ErrorButton** | `js/packages/ui/src/components/errorboundary/ErrorBoundary.tsx` | ✅ Deleted |

**Test files deleted:**
- js/packages/ui/src/components/ui/__tests__/StatusBadge.test.tsx

**Exports removed from:**
- js/packages/ui/src/components/lineage/controls/index.ts
- js/packages/ui/src/components/views/index.ts
- js/packages/ui/src/components/schema/index.ts
- js/packages/ui/src/components/ui/index.ts
- js/packages/ui/src/components/summary/index.ts
- js/packages/ui/src/components/index.ts
- js/packages/ui/src/primitives.ts
- js/packages/ui/src/types/index.ts
- js/packages/ui/src/index.ts

---

## PREVIOUSLY REMOVED THIS SESSION ✅

| Component | File Path | Status |
|-----------|-----------|--------|
| **ModelRowCount** | `js/packages/ui/src/components/lineage/NodeTag.tsx:110-137` | ✅ Deleted from NodeTag.tsx |
| **ProfileTable** | `js/packages/ui/src/components/data/ProfileTable.tsx` | ✅ Deleted (380 lines) |
| **ProfileTable test** | `js/packages/ui/src/components/data/__tests__/ProfileTable.test.tsx` | ✅ Deleted |
| **RunStatusAndDate test** | `js/src/components/run/__tests__/RunStatusAndDate.test.tsx` | ✅ Deleted (orphaned test) |

**Total removed this session:** 11 components/tests deleted

---

## EXPORTED BUT ONLY USED INTERNALLY ⚠️

These components are in the public API but only used within js/packages/ui (not in js/app or js/src):

### Data Components

| Component | Where Used | External Usage | Recommendation |
|-----------|------------|----------------|----------------|
| **SingleBarChart** | TopKBarChart.tsx (3 times) | ❌ None | Consider removing from exports |
| **TopKSummaryList** | TopKBarChart.tsx | ❌ None | Consider removing from exports |
| **DiffTextWithToast** | ui/dataGrid/inlineRenderCell.tsx | ❌ None | Consider removing from exports |
| **EmptyRowsRenderer** | ScreenshotDataGrid.tsx, createResultView.tsx | ❌ None | Maybe keep (factory pattern) |

### App Components (All Internal Only)

None of these are imported outside js/packages/ui:

| Component | Where Used |
|-----------|------------|
| DisplayModeToggleOss | TopBarOss.tsx |
| RecceVersionBadgeOss | TopBarOss.tsx |
| NavBarOss | MainLayout.tsx |
| TopBarOss | MainLayout.tsx |
| StateSynchronizer | NavBarOss.tsx |
| AuthModal | Internal components |
| AvatarDropdown | TopBarOss.tsx |
| EnvInfo | TopBarOss.tsx |
| Filename | Internal components |
| SetupConnectionPopover | Multiple internal |
| StateExporter | TopBarOss.tsx |
| StateImporter | TopBarOss.tsx |
| TopLevelShare | StateSharing.tsx |
| Main, MainLayout | Internal composition |

**Exception:** Only **Providers** is actually used externally in `js/app/layout.tsx`

---

## COMPONENTS USED EXTERNALLY ✅

These are the ONLY components imported outside js/packages/ui:

### Direct App Imports (js/app/)

| Component | Import Location |
|-----------|----------------|
| **Providers** | `js/app/layout.tsx` |
| **CheckPageContentOss** | `js/app/checks/page.tsx` |
| **CheckPageLoadingOss** | `js/app/checks/page.tsx` |
| **LineagePageOss** | `js/app/@lineage/default.tsx`, `js/app/@lineage/page.tsx` |
| **QueryPageOss** | `js/app/query/page.tsx` |

### Through Composition

These 5 entry points compose many other components internally, so those components ARE used but indirectly:
- CheckPageContentOss → CheckListOss → CheckList → CheckCard (and many more)
- LineagePageOss → LineageViewOss → LineageNode, GraphEdge, etc.
- QueryPageOss → QueryForm → SqlEditor, etc.

### Result View Registry

These are registered in createResultView.tsx and loaded dynamically:
- ProfileDiffResultView, ProfileResultView
- RowCountResultView, RowCountDiffResultView
- HistogramDiffResultView
- TopKDiffResultView
- ValueDiffResultView, ValueDiffDetailResultView
- QueryDiffResultView, QueryResultView
- SchemaView
- RunView

---

## ✅ INTERNAL-ONLY COMPONENTS REMOVED FROM PUBLIC API

These components were exported but only used within js/packages/ui. They have been **removed from public exports** (but kept as internal components):

### Data Components (3 removed)
| Component | Where Used | Status |
|-----------|------------|--------|
| **SingleBarChart** | TopKBarChart.tsx | ✅ Removed from exports |
| **TopKSummaryList** | TopKBarChart.tsx | ✅ Removed from exports |
| **DiffTextWithToast** | ui/dataGrid/inlineRenderCell.tsx | ✅ Removed from exports |

### App Components (10 removed)
| Component | Where Used | Status |
|-----------|------------|--------|
| **AuthModal** | Internal app components | ✅ Removed from exports |
| **AvatarDropdown** | TopBarOss.tsx | ✅ Removed from exports |
| **EnvInfo** | TopBarOss.tsx | ✅ Removed from exports |
| **Filename** | Internal components | ✅ Removed from exports |
| **Main** | MainLayout.tsx | ✅ Removed from exports |
| **MainLayout** | Internal composition | ✅ Removed from exports |
| **SetupConnectionPopover** | Multiple internal | ✅ Removed from exports |
| **StateExporter** | TopBarOss.tsx | ✅ Removed from exports |
| **StateImporter** | TopBarOss.tsx | ✅ Removed from exports |
| **TopLevelShare** | StateSharing.tsx | ✅ Removed from exports |

**Note:** These components still exist and work internally, they're just no longer part of the public API.

**Exports removed from:**
- js/packages/ui/src/components/data/index.ts
- js/packages/ui/src/components/ui/index.ts
- js/packages/ui/src/components/index.ts
- js/packages/ui/src/primitives.ts
- js/packages/ui/src/types/index.ts

---

## SUMMARY

### Components Deleted (11 total):
```
✅ LineageControls.tsx
✅ RecceLayout.tsx
✅ RunsView.tsx
✅ SchemaTable.tsx
✅ StatusBadge.tsx
✅ SummaryView.tsx
✅ ModelRowCount (from NodeTag.tsx)
✅ ProfileTable.tsx
✅ ProfileTable.test.tsx
✅ RunStatusAndDate.test.tsx
✅ ErrorButton (from ErrorBoundary.tsx) - testing-only component
```

### Components Removed from Public Exports (13 total):
- Data: SingleBarChart, TopKSummaryList, DiffTextWithToast
- App: AuthModal, AvatarDropdown, EnvInfo, Filename, Main, MainLayout, SetupConnectionPopover, StateExporter, StateImporter, TopLevelShare

---

## VERIFICATION METHODOLOGY

For each component, checked:
1. ✅ grep for `import.*ComponentName` in js/packages/ui/src (excluding tests/index/primitives)
2. ✅ grep for `import.*ComponentName` in js/app and js/src (excluding tests)
3. ✅ grep for usage via `@datarecce/ui` package imports
4. ✅ Verified no dynamic imports or registry lookups

**Confidence:** High - verified through multiple search patterns.

---

## ADDITIONAL VERIFICATION (Follow-up Analysis)

### Candidates Investigated

| Component | File | Verdict |
|-----------|------|---------|
| **ErrorButton** | `errorboundary/ErrorBoundary.tsx` | **DELETED** - Test-only component, never used |
| DiffTextWithToast | `ui/DiffTextWithToast.tsx` | KEPT - Used internally in dataGrid |
| Toaster | `ui/Toaster.tsx` | KEPT - Heavily used (7+ hooks) |
| LearnHowLink | `onboarding-guide/Notification.tsx` | KEPT - Used in OSS components |
| RecceNotification | `onboarding-guide/Notification.tsx` | KEPT - Used in OSS components |

### Storybook Documentation Cleanup

Removed references to deleted components from Storybook docs:
- `js/packages/storybook/CONTRIBUTING.md` - Removed ProfileTable, StatusBadge from category table
- `js/packages/storybook/stories/README.md` - Removed ProfileTable, StatusBadge from component lists
