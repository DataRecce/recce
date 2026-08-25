import { expect, test } from "@playwright/test";

const story =
  "/iframe.html?id=primitives-runstatusbadge--surface-contexts&viewMode=story";

test.describe("RunStatusBadge production surfaces", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`${theme} mode`, async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-08-24T08:01:00.000Z"));
      await page.goto(`${story}&globals=theme:${theme}`);
      await page.waitForSelector("#storybook-root", { state: "visible" });

      const html = page.locator("html");
      const root = page.locator("#storybook-root");
      await expect(root.locator(`[data-theme="${theme}"]`)).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await expect(html).toHaveClass(new RegExp(theme));

      for (const surface of [
        "run-list",
        "run-progress",
        "cloud-contract",
        "oss-result-pane",
      ]) {
        await expect(
          root.locator(`[data-status-surface="${surface}"]`),
        ).toContainText("Last computed");
      }

      await expect(root).not.toContainText("Finished");
      await expect(root).toHaveScreenshot(`status-surfaces-${theme}.png`);
    });
  }
});
