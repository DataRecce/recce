import { expect, test } from "@playwright/test";

const STORY_URL = "/iframe.html?id=timeline-timelineevent";

test.describe("TimelineEvent visual", () => {
  test.describe("state change events", () => {
    test("check created - light mode", async ({ page }) => {
      await page.goto(`${STORY_URL}--check-created&viewMode=story`);
      await page.waitForSelector('[data-testid="storybook-root"]', {
        state: "visible",
      });
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "check-created-light.png",
      );
    });

    test("check created - dark mode", async ({ page }) => {
      await page.goto(
        `${STORY_URL}--check-created&viewMode=story&globals=theme:dark`,
      );
      await page.waitForSelector('[data-testid="storybook-root"]', {
        state: "visible",
      });
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "check-created-dark.png",
      );
    });

    test("approved", async ({ page }) => {
      await page.goto(`${STORY_URL}--approved&viewMode=story`);
      await page.waitForSelector('[data-testid="storybook-root"]', {
        state: "visible",
      });
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "approved.png",
      );
    });

    test("unapproved", async ({ page }) => {
      await page.goto(`${STORY_URL}--unapproved&viewMode=story`);
      await page.waitForSelector('[data-testid="storybook-root"]', {
        state: "visible",
      });
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "unapproved.png",
      );
    });
  });

  test.describe("comment events", () => {
    test("comment", async ({ page }) => {
      await page.goto(`${STORY_URL}--comment&viewMode=story`);
      await page.waitForSelector('[data-testid="storybook-root"]', {
        state: "visible",
      });
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "comment.png",
      );
    });

    test("comment edited", async ({ page }) => {
      await page.goto(`${STORY_URL}--comment-edited&viewMode=story`);
      await page.waitForSelector('[data-testid="storybook-root"]', {
        state: "visible",
      });
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "comment-edited.png",
      );
    });

    test("comment deleted", async ({ page }) => {
      await page.goto(`${STORY_URL}--comment-deleted&viewMode=story`);
      await page.waitForSelector('[data-testid="storybook-root"]', {
        state: "visible",
      });
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "comment-deleted.png",
      );
    });

    test("comment with actions hover", async ({ page }) => {
      await page.goto(`${STORY_URL}--comment-with-actions&viewMode=story`);
      await page.waitForSelector('[data-testid="storybook-root"]', {
        state: "visible",
      });

      // Hover to reveal action buttons
      await page.hover("text=My own comment");
      await page.waitForTimeout(300); // Wait for hover animation

      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "comment-actions-hover.png",
      );
    });
  });

  test.describe("dark mode", () => {
    test("comment - dark mode", async ({ page }) => {
      await page.goto(
        `${STORY_URL}--comment&viewMode=story&globals=theme:dark`,
      );
      await page.waitForSelector('[data-testid="storybook-root"]', {
        state: "visible",
      });
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "comment-dark.png",
      );
    });

    test("comment with actions - dark mode", async ({ page }) => {
      await page.goto(
        `${STORY_URL}--comment-with-actions&viewMode=story&globals=theme:dark`,
      );
      await page.waitForSelector('[data-testid="storybook-root"]', {
        state: "visible",
      });

      await page.hover("text=My own comment");
      await page.waitForTimeout(300);

      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "comment-actions-dark.png",
      );
    });
  });
});
