import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

const root = "/iframe.html?id=semantics-colorsemanticsmatrix";

test("uses production grid and direction renderers", async ({ page }) => {
  await page.goto(`${root}--light&viewMode=story`);
  await page.waitForSelector("#storybook-root", { state: "visible" });

  const matrix = page.locator("#storybook-root");
  const query = matrix.locator('[data-production-surface="query"]');
  const profile = matrix.locator('[data-production-surface="profile"]');
  const directions = matrix.locator('[data-production-directions="row-count"]');

  await expect(query.locator(".ag-root")).toBeVisible();
  await expect(query.locator(".structural-row-added").first()).toBeVisible();
  await expect(query.locator(".structural-row-removed").first()).toBeVisible();
  await expect(query.locator(".structural-row-modified").first()).toBeVisible();
  await expect(query.locator(".comparison-cell-base").first()).toBeVisible();
  await expect(query.locator(".comparison-cell-current").first()).toBeVisible();
  await expect(profile.locator(".ag-root")).toBeVisible();
  await expect(
    profile.locator(".structural-row-modified").first(),
  ).toBeVisible();
  await expect(
    directions.locator(
      '[data-production-direction="increase"] [data-row-count-direction="increase"]',
    ),
  ).toBeVisible();
  await expect(
    directions.locator(
      '[data-production-direction="decrease"] [data-row-count-direction="decrease"]',
    ),
  ).toBeVisible();
  await expect(
    directions.locator('[data-production-direction="equal"]'),
  ).toContainText("No Change");

  for (const label of ["increase", "decrease", "equal"] as const) {
    const cue = directions.locator(`[data-production-direction="${label}"]`);
    const renderer = cue.locator(`[data-row-count-direction="${label}"]`);
    const cueStyles = await cue.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        color: style.color,
      };
    });
    const rendererStyles = await renderer.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        color: style.color,
      };
    });
    expect(rendererStyles).toEqual(cueStyles);
  }
});

test("grayscale charts retain visible series roles", async ({ page }) => {
  await page.goto(`${root}--grayscale&viewMode=story`);
  await page.waitForSelector("#storybook-root", { state: "visible" });

  const matrix = page.locator("#storybook-root");
  const histogram = matrix.locator('[data-production-chart="histogram"]');
  const topK = matrix.locator('[data-production-chart="top-k"]');

  await expect(histogram.locator("canvas")).toBeVisible();
  await expect(
    histogram.getByRole("img", {
      name: /Histogram comparing Base and Current series/,
    }),
  ).toBeVisible();
  await expect(topK.locator("canvas")).toBeVisible();
  await expect(
    topK.getByRole("img", {
      name: /Top-K chart comparing Base and Current series/,
    }),
  ).toBeVisible();
});

for (const story of ["light", "dark", "grayscale"] as const) {
  test(story, async ({ page }) => {
    await page.goto(`${root}--${story}&viewMode=story`);
    await page.waitForSelector("#storybook-root", { state: "visible" });
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      `${story}.png`,
    );
  });
}
