import { MarkdownContent } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, within } from "storybook/test";

const meta: Meta<typeof MarkdownContent> = {
  title: "Primitives/MarkdownContent",
  component: MarkdownContent,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    content: {
      description: "The markdown content to render",
      control: "text",
    },
    fontSize: {
      description: "Font size for the rendered content",
      control: "text",
    },
    internalDomains: {
      description:
        "Additional domains to treat as internal (not showing confirmation dialog)",
      control: "object",
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "800px" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MarkdownContent>;

export const Default: Story = {
  args: {
    content: `# Markdown Sample

**Bold**, *italic*, ~~strikethrough~~, and inline \`code\`.

## Lists
- Unordered item
- Another item
  - Nested

1. Ordered item
2. Another

## Code
\`\`\`sql
SELECT customer_id, COUNT(*) FROM orders GROUP BY customer_id;
\`\`\`

## Table
| Metric | Base | Current | Status |
|--------|------|---------|--------|
| Row Count | 1,234 | 1,250 | ✅ |
| Nulls | 0 | 2 | ⚠️ |

## Links
[Internal route](/dashboard) — no confirmation.
[External](https://docs.example.com) — shows confirmation dialog.

## Task list
- [x] Schema validation
- [ ] Data quality rules

> Edit the \`content\` control to test arbitrary markdown.`,
  },
};

export const ExternalLinkConfirmation: Story = {
  args: {
    content: "Visit [GitHub](https://github.com) for more information.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: /GitHub ↗/ });
    await userEvent.click(link);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(
      screen.getByText(/You are about to visit an external site/),
    ).toBeInTheDocument();
  },
};
