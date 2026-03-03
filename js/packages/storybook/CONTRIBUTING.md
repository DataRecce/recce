# Contributing to @datarecce/storybook

This guide explains how to add stories, tests, and documentation for components.

## Creating a New Story

### 1. Choose the Category

Stories are organized by functional category:

| Category    | Components                                   |
| ----------- | -------------------------------------------- |
| `timeline/` | TimelineEvent, CommentInput                  |
| `data/`     | HistogramChart, TopKBarChart                 |
| `lineage/`  | LineageNode, LineageView, LineageEdge        |
| `ui/`       | Split, MarkdownContent                       |

### 2. Create the Story File

```typescript
// stories/<category>/<ComponentName>.stories.tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComponentName } from "@datarecce/ui/primitives";

const meta: Meta<typeof ComponentName> = {
  title: "Category/ComponentName",
  component: ComponentName,
  tags: ["autodocs"], // Auto-generate documentation
  parameters: {
    docs: {
      description: {
        component: "Brief description of the component.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ComponentName>;

export const Default: Story = {
  args: {
    // Default props
  },
};
```

### 3. Add Variants

Create stories for each meaningful variant:

```typescript
export const WithIcon: Story = {
  args: {
    icon: <SomeIcon />,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
```

## Writing Interaction Tests

### Using Play Functions

Play functions run in the browser and can test interactions:

```typescript
import { expect, userEvent, within } from "storybook/test";

export const Interactive: Story = {
  args: {
    /* ... */
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Interact with the component
    await userEvent.click(canvas.getByRole("button"));

    // Assert the result
    expect(canvas.getByText("Clicked!")).toBeInTheDocument();
  },
};
```

### Using Portable Stories

Create a test file to run stories with Vitest:

```typescript
// stories/<category>/<ComponentName>.test.ts
import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./<ComponentName>.stories";

const { Default, WithIcon } = composeStories(stories);

describe("ComponentName", () => {
  it("renders default state", () => {
    render(<Default />);
    expect(screen.getByText("Expected text")).toBeInTheDocument();
  });
});
```

## Adding Visual Regression Tests

### Create Visual Test File

```typescript
// stories/<category>/<ComponentName>.visual.ts
import { expect, test } from "@playwright/test";

const STORY_URL = "/iframe.html?id=category-componentname";

test.describe("ComponentName visual", () => {
  test("default - light mode", async ({ page }) => {
    await page.goto(`${STORY_URL}--default&viewMode=story`);
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default-light.png",
    );
  });

  test("default - dark mode", async ({ page }) => {
    await page.goto(`${STORY_URL}--default&viewMode=story&globals=theme:dark`);
    await expect(page.locator("#storybook-root")).toHaveScreenshot(
      "default-dark.png",
    );
  });
});
```

### Generate Baselines

```bash
pnpm test:visual:update
```

### Update Baselines

When intentional visual changes are made:

```bash
pnpm test:visual:update
git add stories/<category>/<ComponentName>.visual.ts-snapshots/
```

## Best Practices

### Story Organization

- One story file per component
- Group related stories with comments
- Use descriptive story names

### Args and Controls

- Define `argTypes` for better controls in Storybook UI
- Use `fn()` from `storybook/test` for action callbacks

### Documentation

- Add `tags: ["autodocs"]` for auto-generated docs
- Write `description` in `parameters.docs` for context
- Document edge cases with story-level descriptions

### Testing

- Test happy paths in portable stories
- Test interactions with play functions
- Test visual appearance with Playwright
- Cover light and dark modes
