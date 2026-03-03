import { expect, test } from "@playwright/test";

// UI stories to test
const uiStoryPaths = [
  "ui-squareicon",
  "ui-toggleswitch",
  "ui-emptystate",
  "ui-runstatusbadge",
  "ui-diffdisplaymodeswitch",
  "ui-changedonlycheckbox",
  "ui-markdowncontent",
  "ui-screenshotbox",
  "ui-difftext",
  "ui-difftextwithtoast",
  "ui-dropdownvaluesinput",
  "ui-split",
  "ui-externallinkconfirmdialog",
  "ui-toaster",
];

test.describe("UI Component Stories Verification", () => {
  for (const storyPath of uiStoryPaths) {
    test(`${storyPath} stories load without errors`, async ({ page }) => {
      const errors: string[] = [];

      // Capture console errors
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(`Console: ${msg.text()}`);
        }
      });

      // Capture page errors
      page.on("pageerror", (err) => {
        errors.push(`Page error: ${err.message}`);
      });

      // Navigate to the story's docs page (shows all variants)
      await page.goto(`http://localhost:6006/?path=/docs/${storyPath}--docs`);

      // Wait for Storybook to load
      await page.waitForLoadState("networkidle");

      // Wait a bit for any lazy-loaded content
      await page.waitForTimeout(2000);

      // Check that the page loaded
      const title = await page.title();
      expect(title).toContain("Storybook");

      // Verify no errors occurred
      if (errors.length > 0) {
        console.error(`Errors in ${storyPath}:`, errors);
      }
      expect(errors).toHaveLength(0);
    });
  }
});

test.describe("Individual Story Smoke Tests", () => {
  // Test a few representative stories in detail
  const testStories = [
    { id: "ui-squareicon--blue", name: "SquareIcon - Blue" },
    { id: "ui-toggleswitch--interactive", name: "ToggleSwitch - Interactive" },
    {
      id: "ui-emptystate--with-primary-action",
      name: "EmptyState - With Action",
    },
    { id: "ui-difftext--green", name: "DiffText - Green" },
    { id: "ui-split--horizontal-split", name: "Split - Horizontal" },
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
