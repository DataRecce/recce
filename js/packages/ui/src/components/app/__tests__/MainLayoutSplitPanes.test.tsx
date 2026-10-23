/**
 * Regression tests for DRC-3467: an empty result pane claiming half the
 * viewport below the lineage canvas.
 *
 * Unlike MainLayout.test.tsx, react-split is NOT mocked here — the bug lives in
 * how split.js sizes the DOM children of the VSplit container. split.js assigns
 * inline sizes to the element children present when it initializes. When a
 * Suspense boundary was a direct child of the split, swapping its fallback (or
 * the static-export `<template>` placeholder) for the real content replaced a
 * split-sized element with an unsized one, leaving both panes at their
 * `height: 100%` sx value — a 50/50 split with the empty result pane at the
 * bottom.
 */

import { act, render } from "@testing-library/react";
import { use } from "react";
import { vi } from "vitest";
import { Main } from "../MainLayout";

vi.mock("../../../contexts", () => ({
  useRecceActionContext: () => ({
    isRunResultOpen: false,
    isHistoryOpen: false,
    closeRunResult: vi.fn(),
  }),
  useRouteConfig: () => ({ basePath: "" }),
  useRecceServerFlag: () => ({ data: { single_env_onboarding: false } }),
}));

vi.mock("../../../hooks/useIsDark", () => ({
  useIsDark: () => true,
}));

vi.mock("../../run", () => ({
  RunListOss: () => <div>RunList</div>,
  RunResultPaneOss: () => <div>RunResultPane</div>,
}));

function getVSplitContainer(container: HTMLElement): HTMLElement {
  const vsplit = Array.from(container.querySelectorAll("div")).find(
    (el) => el.style.flexDirection === "column",
  );
  if (!vsplit) throw new Error("VSplit container not found");
  return vsplit;
}

/** Element children of the split container, excluding split.js gutters. */
function getPanes(vsplit: HTMLElement): HTMLElement[] {
  return Array.from(vsplit.children).filter(
    (el) => !el.classList.contains("gutter"),
  ) as HTMLElement[];
}

describe("Main - VSplit pane sizing survives Suspense resolution (DRC-3467)", () => {
  test("both panes keep split-assigned heights after suspended content resolves", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((r) => {
      resolve = r;
    });

    function SuspendingLineage() {
      use(pending);
      return <div>Lineage Content</div>;
    }

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(
        <Main isLineageRoute={true} lineage={<SuspendingLineage />}>
          <div>Children</div>
        </Main>,
      );
    });
    const { container, findByText } = result;

    await act(async () => {
      resolve();
      await pending;
    });
    await findByText("Lineage Content");

    const panes = getPanes(getVSplitContainer(container));
    expect(panes).toHaveLength(2);

    const [mainPane, resultPane] = panes;
    // split.js sizes with calc(<pct>% - <gutter>px); an unsized pane falls
    // back to its sx height of 100% and claims half the viewport.
    expect(mainPane.style.height).toContain("100%");
    expect(resultPane.style.height).toContain("0%");
    // The resolved content must live inside the split-sized pane.
    expect(mainPane).toHaveTextContent("Lineage Content");
  });

  test("the empty result pane is split-sized to 0% when closed", () => {
    const { container } = render(
      <Main isLineageRoute={true} lineage={<div>Lineage Content</div>}>
        <div>Children</div>
      </Main>,
    );

    const panes = getPanes(getVSplitContainer(container));
    expect(panes).toHaveLength(2);
    expect(panes[1]).toBeEmptyDOMElement();
    expect(panes[1].style.height).toContain("0%");
  });
});
