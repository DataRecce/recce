import { test } from "@playwright/test";

test.describe("Individual Story Smoke Tests", () => {
  // Test a few representative stories in detail
  const testStories = [
    { id: "primitives-squareicon--default", name: "SquareIcon - Default" },
    {
      id: "primitives-toggleswitch--interactive",
      name: "ToggleSwitch - Interactive",
    },
    {
      id: "primitives-emptystate--default",
      name: "EmptyState - Default",
    },
    { id: "primitives-difftext--default", name: "DiffText - Default" },
    { id: "primitives-split--horizontal-split", name: "Split - Horizontal" },
  ];

  for (const story of testStories) {
    test(`${story.name} renders correctly`, async ({ page }) => {
      await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);

      await page.waitForSelector("#storybook-root", { state: "visible" });

      await page.screenshot({
        path: `test-results/${story.id}.png`,
        fullPage: false,
      });
    });
  }
});
