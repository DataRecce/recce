import { expect, test } from "@playwright/test";

const root = "/iframe.html?id=semantics-colorsemanticsmatrix";

for (const story of ["light", "dark", "grayscale"] as const) {
  test(story, async ({ page }) => {
    await page.goto(`${root}--${story}&viewMode=story`);
    await page.waitForSelector("#storybook-root", { state: "visible" });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      `${story}.png`,
    );
  });
}
