# ResultView Factory Migration Notes

## Migration Status

### Phase 2 - Component Migrations

#### Task 2.1: RowCountDiffResultView - ✅ COMPLETE
- Migrated successfully using `screenshotWrapper: "grid"`
- Simple grid rendering with no additional UI
- All 13 tests passing

#### Task 2.2: ValueDiffResultView - ⏸️ BLOCKED

**Status:** Cannot migrate with current factory API

**Reason:** Component requires a summary header BEFORE the grid that the factory doesn't support.

**Current Implementation:**
```tsx
<Box>
  <Box sx={{ px: "16px" }}>
    Model: {params.model}, {result.summary.total} total (
    {common} common, {added} added, {removed} removed)
  </Box>

  <Box sx={{ borderTop, borderBottom }}>
    <ScreenshotDataGrid ... />
  </Box>
</Box>
```

**Factory Limitation:**
The factory's `screenshotWrapper: "grid"` option (lines 112-129 in createResultView.tsx) renders the grid directly without any provision for:
- Header content above the grid
- Footer content below the grid
- Custom container styling around the grid

**What's Needed for Migration:**

### Option A: Extend ResultViewData (Recommended)
Add optional header/footer fields to `ResultViewData`:

```typescript
export interface ResultViewData {
  columns?: unknown[];
  rows?: unknown[];
  content?: ReactNode;
  isEmpty?: boolean;

  // NEW: Support for headers/footers
  header?: ReactNode;      // Rendered above grid/content
  footer?: ReactNode;      // Rendered below grid/content
  containerSx?: SxProps;   // Custom styling for wrapper
}
```

Then in createResultView.tsx:
```tsx
if (screenshotWrapper === "grid") {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", ...data.containerSx }}>
      {data.header}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <ScreenshotDataGrid ... />
      </Box>
      {data.footer}
    </Box>
  );
}
```

### Option B: New Wrapper Type
Add a new `screenshotWrapper: "grid-with-header"` option:

```typescript
export type ScreenshotWrapperType = "grid" | "box" | "grid-with-header";
```

Then handle this case separately in createResultView.tsx.

**Cons:** Less flexible, would need more variants for other layouts.

### Option C: Keep Manual (Current Approach)
Don't migrate ValueDiffResultView yet. Document it as requiring Phase 3 enhancement.

**Pros:**
- No factory changes needed now
- Component continues working as-is
- Clear signal of what features are missing

**Cons:**
- Less code reuse
- Component doesn't benefit from factory patterns

## Recommendation

Implement **Option A** in Phase 3. This provides maximum flexibility for:
- ValueDiffResultView (summary header)
- Future components that need toolbars
- Components with pagination controls
- Components with action buttons above/below content

Until then, ValueDiffResultView should remain manually implemented.

## Other Components to Assess

The following components may have similar requirements:
- [ ] ProfileDiffResultView - May have filters/controls
- [ ] QueryResultView - May have SQL display
- [ ] TopKDiffResultView - May have sorting controls
- [ ] SchemaDiffResultView - May have filters

Each should be assessed for header/footer needs before migration attempts.

## Testing Requirements for Phase 3

When implementing header/footer support:
1. Verify header renders above grid
2. Verify footer renders below grid
3. Verify grid sizing with fixed headers (flex: 1, minHeight: 0)
4. Verify screenshot capture includes header+grid
5. Verify empty state behavior with headers
6. Verify ref forwarding still works with grid
7. Test with various header content types (text, buttons, filters)

## Related Files

- Factory: `/js/packages/ui/src/components/result/createResultView.tsx`
- Types: `/js/packages/ui/src/components/result/types.ts`
- ValueDiff: `/js/src/components/valuediff/ValueDiffResultView.tsx`
- RowCount: `/js/src/components/rowcount/RowCountDiffResultView.tsx` (example of successful migration)
