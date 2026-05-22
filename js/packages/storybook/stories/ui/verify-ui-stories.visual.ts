import { expect, test } from "@playwright/test";

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
      await page.goto(
        `http://localhost:6006/iframe.html?id=${story.id}&viewMode=story`,
      );

      // Wait for story to render
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      // Check that story root is visible
      const storyRoot = page.locator("#storybook-root");
      await expect(storyRoot).toBeVisible();

      // Take a screenshot for manual review if needed
      await page.screenshot({
        path: `test-results/${story.id}.png`,
        fullPage: false,
      });
    });
  }
});
