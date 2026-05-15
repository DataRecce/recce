# Whole-model Treatment Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the panel-wash + labeled-bar treatment in `NodeView` with a title-chip that wraps the model name, mirroring the per-column row chip language (`!` for downstream impact, `~` for whole-model change).

**Architecture:** A single React component file (`NodeView.tsx`) is the primary surface. The wash, labeled bar, and in-header `[ALL]` chip are removed; a new chip wraps the model-name `<Typography>` when `treatment` is non-null. Tokens come from the existing `wholeModelTreatmentTokens(kind)` helper without any shape change. Storybook fixture mirrors the change. Behavior is verified with Vitest component tests, Storybook visual coverage, and a manual dev-server check.

**Tech Stack:** React 19 + TypeScript 5.9, MUI 7, Vitest + React Testing Library, Storybook 9, Biome 2.4. Run from `js/` directory with `pnpm`.

**Spec:** `docs/superpowers/specs/2026-05-14-whole-model-treatment-redesign-design.md`

---

## File Structure

| Action | File | Responsibility |
|---|---|---|
| Modify | `js/packages/ui/src/components/lineage/NodeView.tsx` | Drop wash + labeled bar + in-header [ALL] chip. Add title chip. |
| Modify | `js/packages/ui/src/components/lineage/wholeModelTreatment.ts` | Update file-header docstring (no behavior change). |
| Modify | `js/packages/ui/src/components/lineage/__tests__/NodeView.test.tsx` | Add tests asserting title chip renders + old surfaces are gone. |
| Modify | `js/packages/storybook/stories/lineage/WholeModelImpact.stories.tsx` | Update `PanelFixture` to render new chip. Add long-name story. |

`LineageNode.tsx` and `LineageNode.test.tsx` are **not touched** — the graph-node `[ALL]` badge stays as-is.

---

## Task 1 — Add failing tests for the title chip and removed surfaces

**Files:**
- Modify: `js/packages/ui/src/components/lineage/__tests__/NodeView.test.tsx`

The current test file already has fixtures (`createNode`, `createModelDetail`, `MockSchemaView`, `renderNodeView`). Read it first to match patterns. We add a new `describe("whole-model treatment", ...)` block.

- [ ] **Step 1: Read the existing test file to confirm fixture shapes**

Run: `cat js/packages/ui/src/components/lineage/__tests__/NodeView.test.tsx`

Confirm: `renderNodeView(node, columns?)` exists and accepts a node object. We need a small variant that also passes the new `isBreakingSource` / `isWholeModelImpactedDownstream` props. The existing `renderNodeView` does not, so we extend it with an optional third argument.

- [ ] **Step 2: Write the failing tests**

Append the following block to `js/packages/ui/src/components/lineage/__tests__/NodeView.test.tsx` (just before the final `});` of the outermost `describe`, or at file-end inside its own `describe` — keep style consistent with what's already there).

Add this helper at the top of the file (near `renderNodeView`):

```tsx
function renderNodeViewWithTreatment(
  node: NodeViewNodeData,
  treatment: { isBreakingSource?: boolean; isWholeModelImpactedDownstream?: boolean },
  columns?: Record<string, NodeColumnData>,
) {
  return render(
    <NodeView
      node={node}
      modelDetail={createModelDetail(columns)}
      onCloseNode={vi.fn()}
      isSingleEnv={false}
      SchemaView={MockSchemaView}
      isBreakingSource={treatment.isBreakingSource ?? false}
      isWholeModelImpactedDownstream={treatment.isWholeModelImpactedDownstream ?? false}
    />,
  );
}
```

Add this `describe` block (place it after the existing tests but inside the top-level `describe` in the file — or as a sibling top-level `describe`, matching the file's convention):

```tsx
describe("whole-model treatment", () => {
  test("downstream-impact: renders title chip with ! glyph wrapping the model name", () => {
    renderNodeViewWithTreatment(
      createNode("model", testColumns),
      { isWholeModelImpactedDownstream: true },
      testColumns,
    );

    const chip = screen.getByTestId("whole-model-impact-title-chip");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent("test_node");
    expect(chip).toHaveTextContent("!");
  });

  test("source: renders title chip with ~ glyph wrapping the model name", () => {
    renderNodeViewWithTreatment(
      createNode("model", testColumns),
      { isBreakingSource: true },
      testColumns,
    );

    const chip = screen.getByTestId("whole-model-source-title-chip");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent("test_node");
    expect(chip).toHaveTextContent("~");
  });

  test("downstream-impact: removed surfaces are not rendered", () => {
    renderNodeViewWithTreatment(
      createNode("model", testColumns),
      { isWholeModelImpactedDownstream: true },
      testColumns,
    );

    // Old wash, labeled bar, and in-header [ALL] chip must be gone.
    expect(screen.queryByTestId("whole-model-impact-wash")).not.toBeInTheDocument();
    expect(screen.queryByTestId("whole-model-impact-header")).not.toBeInTheDocument();
    expect(screen.queryByTestId("whole-model-impact-badge")).not.toBeInTheDocument();
  });

  test("source: removed surfaces are not rendered", () => {
    renderNodeViewWithTreatment(
      createNode("model", testColumns),
      { isBreakingSource: true },
      testColumns,
    );

    expect(screen.queryByTestId("whole-model-source-wash")).not.toBeInTheDocument();
    expect(screen.queryByTestId("whole-model-source-header")).not.toBeInTheDocument();
    expect(screen.queryByTestId("whole-model-source-badge")).not.toBeInTheDocument();
  });

  test("no treatment: title chip is absent", () => {
    renderNodeViewWithTreatment(
      createNode("model", testColumns),
      {},
      testColumns,
    );

    expect(screen.queryByTestId("whole-model-impact-title-chip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("whole-model-source-title-chip")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the new tests and verify they FAIL**

Run from the repo root:

```bash
cd js && pnpm --filter @datarecce/ui test --run NodeView.test
```

Expected:
- `downstream-impact: renders title chip ...` → **FAIL** (testid `whole-model-impact-title-chip` does not exist).
- `source: renders title chip ...` → **FAIL** (testid `whole-model-source-title-chip` does not exist).
- `downstream-impact: removed surfaces ...` → **FAIL** on at least one of the three queries (the wash/header/badge are still rendered today).
- `source: removed surfaces ...` → **FAIL** likewise.
- `no treatment: title chip is absent` → **PASS** (chip doesn't exist yet anyway).

If any of the failing tests instead pass, stop and re-read the existing implementation in `NodeView.tsx` lines 698-870 — the testids should be present in the current code.

- [ ] **Step 4: Commit the failing tests**

```bash
git add js/packages/ui/src/components/lineage/__tests__/NodeView.test.tsx
git commit -s -m "test(node-view): add failing tests for whole-model title chip

Asserts the new title-chip surface and that the old wash, labeled
header bar, and in-header [ALL] chip are removed. Implementation
follows in next commit.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2 — Implement the title chip in NodeView

**Files:**
- Modify: `js/packages/ui/src/components/lineage/NodeView.tsx`

Three edits in this file:
1. Drop `backgroundColor: treatment.washBg` from the outer `Box` `sx` (line ~707-710). Keep `boxShadow` and the `data-testid` block goes away.
2. Remove the in-header `[ALL]` chip block (lines ~753-784) and add the new title chip wrapping the model-name `<Typography>` (lines ~737-748).
3. Remove the labeled header bar (`{treatment && (<Box ...>{wholeModelHeaderText}</Box>)}` at lines ~851-870) and the `wholeModelHeaderText` variable (lines ~693-696).

- [ ] **Step 1: Drop the wash and the panel-level `data-testid`**

Read `NodeView.tsx` lines 698-720, then edit. Replace:

```tsx
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        // Wash covers the entire NodeView so the treatment spans every tab
        // (Lineage / Columns / Code). 6px inset accent on the left edge is
        // slightly more prominent than the 4px stripe used in v1.
        ...(treatment && {
          backgroundColor: treatment.washBg,
          boxShadow: `inset 6px 0 0 ${treatment.washAccent}`,
        }),
      }}
      data-testid={
        treatmentKind === "source"
          ? "whole-model-source-wash"
          : treatmentKind === "downstream"
            ? "whole-model-impact-wash"
            : undefined
      }
    >
```

With:

```tsx
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        // 6px left-edge accent stripe is the only panel-level signal that
        // survives the title-chip redesign. The wash and labeled bar were
        // dropped because the cumulative yellow read as a warning. See
        // docs/superpowers/specs/2026-05-14-whole-model-treatment-redesign-design.md
        ...(treatment && {
          boxShadow: `inset 6px 0 0 ${treatment.washAccent}`,
        }),
      }}
    >
```

- [ ] **Step 2: Replace the model-name + in-header [ALL] chip with the title chip**

Read `NodeView.tsx` lines 727-786, then edit. Replace the whole block:

```tsx
        <Box
          sx={{
            flex: "0 1 20%",
            p: 2,
            display: "flex",
            alignItems: "center",
            gap: 1,
            minWidth: 0,
          }}
        >
          <Typography
            variant="subtitle1"
            className="no-track-pii-safe"
            sx={{
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {node.data.name}
          </Typography>
          {/* "ALL" badge — same primitive as the LineageNode graph badge,
              colored brown for whole-model-changed sources and amber for
              downstream-only whole-model impact. Visible regardless of the
              currently active tab. */}
          {treatment && (
            <Box
              data-testid={
                treatmentKind === "source"
                  ? "whole-model-source-badge"
                  : "whole-model-impact-badge"
              }
              aria-label={
                treatmentKind === "source"
                  ? "whole-model change"
                  : "whole-model impact"
              }
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.65rem",
                fontWeight: 700,
                lineHeight: 1,
                height: 18,
                minWidth: 22,
                px: 0.5,
                borderRadius: "3px",
                color: treatment.fg,
                backgroundColor: treatment.badgeBg,
                border: `1px solid ${treatment.badgeBorder}`,
                flexShrink: 0,
              }}
            >
              ALL
            </Box>
          )}
        </Box>
```

With:

```tsx
        <Box
          sx={{
            flex: "0 1 20%",
            p: 2,
            display: "flex",
            alignItems: "center",
            gap: 1,
            minWidth: 0,
          }}
        >
          {treatment ? (
            // Title chip — wraps the model name with the same `!`/`~`
            // language used per-column in the schema grid. The chip is
            // the panel's only whole-model signal in the header area;
            // the wash and labeled bar were dropped (see spec
            // 2026-05-14-whole-model-treatment-redesign-design.md).
            <Box
              data-testid={
                treatmentKind === "source"
                  ? "whole-model-source-title-chip"
                  : "whole-model-impact-title-chip"
              }
              aria-label={
                treatmentKind === "source"
                  ? "whole-model change"
                  : "whole-model impact"
              }
              title={node.data.name}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                px: 1,
                py: 0.25,
                borderRadius: "6px",
                backgroundColor: treatment.washBg,
                border: `1px solid ${treatment.washAccent}`,
                color: treatment.fg,
                minWidth: 0,
                maxWidth: "100%",
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  backgroundColor: treatment.washAccent,
                  color: "#fff",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {treatmentKind === "source" ? "~" : "!"}
              </Box>
              <Typography
                variant="subtitle1"
                component="span"
                className="no-track-pii-safe"
                sx={{
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "inherit",
                }}
              >
                {node.data.name}
              </Typography>
            </Box>
          ) : (
            <Typography
              variant="subtitle1"
              className="no-track-pii-safe"
              sx={{
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {node.data.name}
            </Typography>
          )}
        </Box>
```

- [ ] **Step 3: Remove the `wholeModelHeaderText` variable and the labeled header bar**

Read `NodeView.tsx` lines 690-700 and 844-870.

First, delete the `wholeModelHeaderText` declaration (lines ~693-696):

```tsx
  const wholeModelHeaderText =
    treatmentKind === "source"
      ? "Whole-model change in this model"
      : "Whole-model impact";
```

Delete that whole assignment.

Then, delete the labeled header bar block (lines ~844-870):

```tsx
      {/* Whole-model header — sits above the Tabs strip so it spans every
          tab. Multi-ancestor list intentionally omitted in v1: it adds
          visual noise without clear value. The closest upstream causes are
          still computed and exposed via
          `LineageViewContext.wholeModelImpactCauseMap` for future use
          (e.g., a hover tooltip or expandable detail). See Q7 in the
          DRC-3341 spec. */}
      {treatment && (
        <Box
          data-testid={
            treatmentKind === "source"
              ? "whole-model-source-header"
              : "whole-model-impact-header"
          }
          sx={{
            px: 2,
            py: 0.75,
            fontSize: "0.75rem",
            fontWeight: 600,
            color: treatment.fg,
            borderTop: `1px solid ${treatment.washAccent}`,
            borderBottom: `1px solid ${treatment.washAccent}`,
          }}
        >
          {wholeModelHeaderText}
        </Box>
      )}
```

Delete that whole block.

- [ ] **Step 4: Run the failing tests and verify they now PASS**

```bash
cd js && pnpm --filter @datarecce/ui test --run NodeView.test
```

Expected: all five `whole-model treatment` tests PASS, plus the pre-existing tests still PASS. If any pre-existing test fails, you've damaged unrelated code — read the diff carefully.

- [ ] **Step 5: Run lint and type-check on the UI package**

```bash
cd js && pnpm lint:fix && pnpm type:check
```

Expected: no errors. Common gotcha: the `treatment` ternary may surface a TypeScript issue around the `Typography` `component` prop — if so, leave the prop and add a type-safe cast or use `Box component="span"` instead.

- [ ] **Step 6: Commit the implementation**

```bash
git add js/packages/ui/src/components/lineage/NodeView.tsx
git commit -s -m "feat(node-view): replace whole-model wash + bar with title chip

Wraps the model name in a chip carrying the same !/~ glyph used
per-column. Drops the panel wash, the labeled header bar above the
tabs, and the redundant in-header [ALL] chip. The 6px left-edge
stripe is preserved. The graph-node [ALL] badge is unchanged.

Addresses 'yellow bar reads as warning' feedback. See spec at
docs/superpowers/specs/2026-05-14-whole-model-treatment-redesign-design.md.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3 — Update the file-header docstring in `wholeModelTreatment.ts`

**Files:**
- Modify: `js/packages/ui/src/components/lineage/wholeModelTreatment.ts:1-19`

Pure documentation change. Today's docstring describes "panel wash, ALL badge, and header line." After the redesign, the panel surface is the title chip.

- [ ] **Step 1: Replace the file-header comment**

Read `js/packages/ui/src/components/lineage/wholeModelTreatment.ts:1-19` for the exact existing comment, then replace:

```ts
/**
 * Visual tokens for the DRC-3341 whole-model treatment and the adjacent
 * additive-change badge.
 *
 * - Brown family (`"source"`) — model is itself a whole-model-changed
 *   source. Renders the panel wash, "ALL" badge, and header line.
 * - Amber family (`"downstream"`) — model is downstream of a whole-model
 *   change. Same surfaces as source, amber-colored.
 * - Green family (`"additive"`) — model has an additive-only change
 *   (per spec §Vocabulary: `non_breaking`). Only renders a small green
 *   "ADD" badge on the lineage graph node; no sidebar wash or header
 *   (the per-column green `+` glyph already calls out the added column
 *   in the schema view).
 *
 * Per Q9 of the spec: "if you see a badge, look at color — brown is the
 * cause, amber is the effect." Green extends that: a safe local addition
 * that doesn't propagate. Every site that paints these badges sources
 * its colors from this helper.
 */
```

With:

```ts
/**
 * Visual tokens for the DRC-3341 whole-model treatment and the adjacent
 * additive-change badge.
 *
 * Surfaces (as of the 2026-05-14 redesign):
 * - Sidebar panel — the title chip in `NodeView` wraps the model name
 *   using `washBg`/`washAccent`/`fg` plus a `~` (source) or `!`
 *   (downstream) glyph. The earlier panel-wide wash and labeled header
 *   bar were dropped because the cumulative yellow read as a warning.
 * - Lineage graph — the per-node `[ALL]` badge (source/downstream) and
 *   `[ADD]` badge (additive) still use `badgeBg`/`badgeBorder`/`fg`.
 *
 * Families:
 * - Brown (`"source"`) — model is itself a whole-model-changed source.
 * - Amber (`"downstream"`) — model is downstream of a whole-model change.
 * - Green (`"additive"`) — additive-only change (`non_breaking`). Only
 *   the graph-node `[ADD]` badge renders; no sidebar surface today (the
 *   per-column green `+` glyph already calls out the added column).
 *
 * Per Q9 of the spec: "if you see a badge, look at color — brown is the
 * cause, amber is the effect." Green extends that: a safe local addition
 * that doesn't propagate. Every site that paints these tokens sources
 * its colors from this helper.
 */
```

- [ ] **Step 2: Verify nothing else broke**

```bash
cd js && pnpm --filter @datarecce/ui test --run NodeView.test
cd js && pnpm type:check
```

Expected: still all green. (No behavior change; this is comment-only.)

- [ ] **Step 3: Commit**

```bash
git add js/packages/ui/src/components/lineage/wholeModelTreatment.ts
git commit -s -m "docs(whole-model): refresh tokens helper docstring for title-chip surface

The panel-wide wash and labeled header bar were replaced with a
title chip in NodeView; update the helper's surface inventory to
match.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4 — Update the Storybook fixture and add a long-name story

**Files:**
- Modify: `js/packages/storybook/stories/lineage/WholeModelImpact.stories.tsx`

The current `PanelFixture` renders the wash + in-header `[ALL]` badge + labeled header bar. Replace with the new title-chip layout. Add a story that exercises a long model name to verify ellipsis behavior.

- [ ] **Step 1: Replace the `PanelFixture` body**

Read `js/packages/storybook/stories/lineage/WholeModelImpact.stories.tsx:70-191`, then replace the whole `PanelFixture` function with:

```tsx
function PanelFixture({ modelName, variant, rows }: PanelFixtureProps) {
  const isSource = variant === "source";
  const tokens = wholeModelTreatmentTokens(isSource ? "source" : "downstream");
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 480,
        width: 460,
        border: 1,
        borderColor: "divider",
        boxShadow: `inset 6px 0 0 ${tokens.washAccent}`,
      }}
    >
      {/* Panel header row — title chip wraps the model name */}
      <Stack direction="row" sx={{ alignItems: "center", px: 2, py: 1.5 }}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", gap: 1, minWidth: 0, flex: 1 }}
        >
          <Box
            data-testid={
              isSource
                ? "whole-model-source-title-chip"
                : "whole-model-impact-title-chip"
            }
            aria-label={isSource ? "whole-model change" : "whole-model impact"}
            title={modelName}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1,
              py: 0.25,
              borderRadius: "6px",
              backgroundColor: tokens.washBg,
              border: `1px solid ${tokens.washAccent}`,
              color: tokens.fg,
              minWidth: 0,
              maxWidth: "100%",
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                backgroundColor: tokens.washAccent,
                color: "#fff",
                fontSize: "0.7rem",
                fontWeight: 800,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {isSource ? "~" : "!"}
            </Box>
            <Typography
              variant="subtitle1"
              component="span"
              sx={{
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "inherit",
              }}
            >
              {modelName}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
      </Stack>

      {/* Mock action buttons row — placeholder so the chip sits in the
          right vertical position relative to the rest of the panel. */}
      <Box sx={{ pl: 2, py: 1, fontSize: "0.7rem", color: "text.secondary" }}>
        Diff (action buttons placeholder)
      </Box>

      {/* Mock tabs strip — non-functional, just for visual context. */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          px: 2,
          py: 1,
          fontSize: "0.7rem",
          color: "text.secondary",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <span>Lineage</span>
        <strong>Columns</strong>
        <span>Code</span>
      </Box>

      {/* Schema grid */}
      <SchemaLegend />
      <ScreenshotDataGrid
        style={GRID_STYLE}
        columns={schemaColumns}
        rows={rows}
        rowHeight={35}
        getRowClass={getRowClass}
        className="rdg-light no-track-pii-safe cll-experience"
      />
    </Box>
  );
}
```

Also update the JSDoc above `PanelFixture` (lines ~57-69) to reflect the new layout — replace it with:

```tsx
/**
 * Hand-built reproduction of NodeView's panel-level whole-model
 * treatment. Rendering an actual `<NodeView>` here would require mocking
 * a chunk of the lineage context graph; the title-chip + left stripe
 * combo is small enough that a hand-built mock stays in sync without
 * that cost.
 *
 * Layout mirrors NodeView post-redesign:
 * - 6px left-edge stripe on the outer Box.
 * - Title chip wrapping the model name, with !/~ glyph disc.
 * - No panel wash, no labeled header bar above the tabs.
 */
```

- [ ] **Step 2: Update the file-header `@description` to match the new surfaces**

Read lines ~13-34. Replace:

```tsx
/**
 * @file WholeModelImpact.stories.tsx
 * @description Visual coverage for the `--downstream-of-breaking` feature
 * (DRC-3341). Captain reviews these stories to verify each whole-model
 * treatment renders distinctly:
 *
 * - AC-1 — downstream-only whole-model impact (amber wash + amber "ALL"
 *   badge in the panel header + "Whole-model impact" header line).
 * - AC-2 — column-only impact vs whole-model impact, side by side, plus
 *   the both-apply case where the existing per-row `!` glyph stacks on
 *   top of the wash.
 * - AC-4 — whole-model-changed source (brown wash + brown "ALL" badge +
 *   "Whole-model change in this model" header), and the
 *   "source-also-downstream" case (Q11 — source wins; brown treatment
 *   dominates).
 *
 * The fixture mirrors NodeView's panel — wash on the broad container,
 * "ALL" badge in the panel header next to the model name, header line
 * sitting above the (mock) Tabs strip and a Schema grid below it.
 * Multi-ancestor list is intentionally not surfaced in v1 (Q7 punt;
 * see DRC-3341 spec).
 */
```

With:

```tsx
/**
 * @file WholeModelImpact.stories.tsx
 * @description Visual coverage for the `--downstream-of-breaking` feature
 * (DRC-3341, post 2026-05-14 redesign). Captain reviews these stories to
 * verify each whole-model treatment renders distinctly:
 *
 * - AC-1 — downstream-only whole-model impact: amber title chip ("! name")
 *   + amber left stripe + amber "ALL" badge on the lineage node.
 * - AC-2 — column-only impact vs whole-model impact, side by side, plus
 *   the both-apply case where the existing per-row `!` glyph stacks
 *   alongside the title chip.
 * - AC-4 — whole-model-changed source: brown title chip ("~ name") + brown
 *   left stripe + brown "ALL" badge, and the "source-also-downstream"
 *   case (Q11 — source wins; brown treatment dominates).
 *
 * The fixture mirrors NodeView's panel — title chip + left stripe, with a
 * (mock) tabs strip and Schema grid below it. The earlier wash + labeled
 * header bar were dropped (see spec
 * 2026-05-14-whole-model-treatment-redesign-design.md).
 * Multi-ancestor list is intentionally not surfaced in v1 (Q7 punt;
 * see DRC-3341 spec).
 */
```

- [ ] **Step 3: Update story copy that mentions wash/header explicitly**

Search the file for the strings "wash", "header line", and `"ALL" badge in the panel header` and adjust the surrounding `description.story` paragraphs to reference "title chip" instead. Specifically:

- `DownstreamOnly` story description (~lines 327-334): replace `"amber wash + amber \"ALL\" badge in the panel header + \"Whole-model impact\" header line above the tabs"` with `"amber title chip wrapping the model name (\"! fct_orders\") + amber left-edge stripe"`.
- `ColumnOnlyVsWholeModelVsBoth` description (~lines 362-370): replace `"wash + \"ALL\" badge + header"` (two occurrences) with `"title chip + left stripe"`. Replace `"different mechanisms (background vs row-glyph) compose without color collision"` with `"different mechanisms (title chip vs row-glyph) compose without conflict"`.
- `SourceAndSourceWins` description (~lines 458-462): replace `"brown badge on the node + brown wash + brown \"ALL\" badge in the panel header + \"Whole-model change in this model\" header"` with `"brown title chip wrapping the model name (\"~ stg_orders\") + brown left stripe + brown \"ALL\" badge on the lineage node"`. Same pattern in the Q11 paragraph for `fct_orders`.
- The top-level `meta.parameters.docs.description.component` paragraph (~lines 303-311) — replace `"The wash + \"ALL\" badge + header line live on the NodeView panel, so the treatment spans every sidebar tab"` with `"The title chip + left stripe live on the NodeView panel; the chip stays anchored to the model name, and the stripe runs the full height so the treatment is identifiable on any tab"`.

- [ ] **Step 4: Add a long-model-name story to verify ellipsis**

Append the following story to the bottom of the file (after `AdditiveBadge`):

```tsx
// ============================================================================
// Long model name — verifies title-chip ellipsis behavior
// ============================================================================

export const LongModelName: Story = {
  name: "Edge: long model name truncates inside the chip",
  parameters: {
    docs: {
      description: {
        story: `Edge case for the title-chip surface. A very long model name must truncate with ellipsis inside the chip and expose the full name via the chip's tooltip (\`title\` attribute). Both the impact and source variants are shown; the chip width is bounded by the panel header layout.`,
      },
    },
  },
  render: () => (
    <Stack
      direction="row"
      spacing={3}
      sx={{ alignItems: "flex-start", flexWrap: "wrap" }}
    >
      <Stack spacing={1}>
        <Typography variant="subtitle2">Long name — downstream impact</Typography>
        <PanelFixture
          modelName="fct_extremely_long_model_name_with_many_segments_to_force_truncation"
          variant="impacted"
          rows={baseRows}
        />
      </Stack>
      <Stack spacing={1}>
        <Typography variant="subtitle2">Long name — source</Typography>
        <PanelFixture
          modelName="stg_extremely_long_model_name_with_many_segments_to_force_truncation"
          variant="source"
          rows={sourceRows}
        />
      </Stack>
    </Stack>
  ),
};
```

- [ ] **Step 5: Lint and type-check the storybook package**

```bash
cd js && pnpm lint:fix && pnpm type:check
```

Expected: no errors.

- [ ] **Step 6: Boot Storybook and visually verify the stories**

```bash
cd js && pnpm --filter storybook run storybook
```

Storybook will auto-pick a port. Read the dev server output for the URL. Open it and navigate to **Lineage / Whole-Model Impact (DRC-3341)**.

Verify by eye:
- `AC-1: Downstream whole-model impact` — title chip wraps the model name with a `!` disc; the panel has a left amber stripe; no labeled bar above the tabs; no `[ALL]` chip in the panel header.
- `AC-2: Column-only vs whole-model vs both` — middle and right panels have the title chip + left stripe; the right panel additionally shows the per-row `!` glyph on the impacted column.
- `AC-4: Source-only and source-also-downstream` — title chip uses `~` and brown coloring; left stripe is brown.
- `Additive: green ADD badge on the graph` — unchanged from before (no panel surface).
- `Edge: long model name truncates inside the chip` — model name truncates with ellipsis inside the chip; hovering the chip shows the full name in a native tooltip.

If any story shows the old wash or labeled bar, you've missed an edit — re-read the diff and fix.

- [ ] **Step 7: Commit**

```bash
git add js/packages/storybook/stories/lineage/WholeModelImpact.stories.tsx
git commit -s -m "story(whole-model): update fixture for title-chip surface

PanelFixture renders the title chip wrapping the model name with the
matching !/~ glyph; wash and labeled bar are gone. Adds a long-name
story to verify chip ellipsis + tooltip.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5 — End-to-end verification

**Files:** none modified; this is a verification pass.

The user's global guidance: "After a code change, verify it actually works — build, run tests, or check the dev server. If you can't verify, say so." For UI changes: "start the dev server and use the feature in a browser before reporting the task as complete."

- [ ] **Step 1: Run the full UI test suite**

```bash
cd js && pnpm --filter @datarecce/ui test --run
```

Expected: all tests pass. If a non-`whole-model` test fails, you've damaged unrelated code.

- [ ] **Step 2: Run the full storybook test suite (if configured)**

```bash
cd js && pnpm --filter storybook test --run 2>&1 | tail -40
```

If this command errors with "no test script," skip it — Storybook visual coverage was confirmed in Task 4.

- [ ] **Step 3: Run lint and type-check across the monorepo**

```bash
cd js && pnpm lint:fix && pnpm type:check
```

Expected: zero errors. Auto-fix is safe to run; if Biome rewrote anything, stage and amend the appropriate commit (`git add -p` then `git commit --amend --no-edit -s`).

- [ ] **Step 4: Build the frontend bundle**

```bash
cd js && pnpm run build
```

Expected: build completes. Watch for warnings related to `NodeView.tsx` or `wholeModelTreatment.ts` — they should not appear.

- [ ] **Step 5: Boot the recce server against `jaffle_shop_duckdb` and verify in a browser**

The `/recce` slash command starts the recce server from `jaffle_shop_duckdb` using the worktree's venv. If that's not available, run manually:

```bash
cd /Users/danyel/code/Recce/recce/.claude/worktrees/downstream-of-breaking
source .venv/bin/activate 2>/dev/null || true
cd ../../jaffle_shop_duckdb 2>/dev/null && recce server --port 0 || \
  echo "⚠️ jaffle_shop_duckdb not present; manual verification skipped"
```

Open the URL the server prints. With the `--new-cll-experience` and `--downstream-of-breaking` flags (whichever the worktree gates on), select a whole-model-impacted node from the lineage graph. Verify in the NodeView panel:
- Title chip wraps the model name with a yellow `!` disc.
- Left amber stripe runs the full panel height.
- No yellow wash on the panel background.
- No labeled "Whole-model impact" bar above the tabs.
- No `[ALL]` chip in the panel header (the lineage-graph `[ALL]` badge is still there).
- Per-column `!` glyphs in the schema grid are unchanged.

Then select a whole-model-changed source node. Verify the same with `~` glyph and brown coloring, and the legend reads "Whole-model change in this model" → no, that text was removed; the chip alone carries the signal.

If you cannot start the server (missing data fixture, dbt-core mismatch, etc.), say so explicitly: "⚠️ Could not run live verification because <reason>; relying on Vitest + Storybook coverage." Do not claim live verification you didn't perform.

- [ ] **Step 6: Final state check**

```bash
git log --oneline -6
git status
```

Expected: 4 new commits (Task 1 test, Task 2 implementation, Task 3 docstring, Task 4 stories). `git status` shows a clean working tree (or only `.superpowers/` artifacts which are gitignored).

- [ ] **Step 7: Final commit if any auto-fixes landed since Task 4**

If `pnpm lint:fix` made changes after Task 4's commit, those need to ship in their own commit:

```bash
git status
# If files are modified:
git add -p   # interactively review what to stage
git commit -s -m "chore: apply biome auto-fixes from whole-model redesign

Co-Authored-By: Claude <noreply@anthropic.com>"
```

If nothing is dirty, skip this step.

---

## Self-review notes

- **Spec coverage** — every section of the spec maps to a task: visual treatment → Task 2; what's removed → Task 2; what's preserved (no-op or token shape unchanged) → Task 2 + Task 3 docstring; implementation surfaces → Task 2; tests → Task 1; storybook → Task 4; end-to-end → Task 5.
- **No placeholders** — every step lists the actual file path, the actual code, the actual command, and the expected result.
- **Type consistency** — new testids `whole-model-impact-title-chip` / `whole-model-source-title-chip` are used identically in NodeView (Task 2), tests (Task 1), and the storybook fixture (Task 4). Token field names (`washBg`, `washAccent`, `fg`) match `wholeModelTreatmentTokens` exactly.
- **Out of scope guarded** — DRC-3463 (sidebar declutter), per-row column treatment, graph-node `[ALL]`/`[ADD]` badges, and color tokens are explicitly untouched. The graph-node `whole-model-impact-badge` testid (in `LineageNode.tsx`) survives the in-header `[ALL]` removal because the testid string is no longer used by `NodeView.tsx`.
