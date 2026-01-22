import { expect, test } from "@playwright/test";

const STORY_URL =
  "/iframe.html?id=visualizations-histogram-histogramresultview";

test.describe("HistogramResultView visual", () => {
  test("default story", async ({ page }) => {
    await page.goto(`${STORY_URL}--default&viewMode=story`);
    await page.waitForSelector("#storybook-root", {
      state: "visible",
    });

    // Wait for chart to render
    await page.waitForTimeout(1000);

    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default.png",
    );
  });

  test("datetime column - bars should overlay not stripe", async ({ page }) => {
    await page.goto(`${STORY_URL}--datetime-column&viewMode=story`);
    await page.waitForSelector("#storybook-root", {
      state: "visible",
    });

    // Wait for chart to render
    await page.waitForTimeout(1000);

    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "datetime-column.png",
    );
  });
});
