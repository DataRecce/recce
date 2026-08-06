import { expect, test } from "@playwright/test";

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
});

test("grayscale charts retain visible series roles", async ({ page }) => {
  await page.goto(`${root}--grayscale&viewMode=story`);
  await page.waitForSelector("#storybook-root", { state: "visible" });

  const matrix = page.locator("#storybook-root");
  await expect(
    matrix.locator('[data-series-evidence="histogram"]'),
  ).toContainText("0–20 Base 12 Current 8");
  await expect(matrix.locator('[data-series-evidence="top-k"]')).toContainText(
    "Upper bar Current",
  );
  await expect(matrix.locator('[data-series-evidence="top-k"]')).toContainText(
    "Lower bar Base",
  );
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
