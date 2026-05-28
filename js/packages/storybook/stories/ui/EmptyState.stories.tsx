import { EmptyState } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TbInbox } from "react-icons/tb";
import { expect, fn, userEvent, within } from "storybook/test";

const meta: Meta<typeof EmptyState> = {
  title: "Primitives/EmptyState",
  component: EmptyState,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    title: {
      description: "Main title text displayed prominently",
      control: "text",
    },
    description: {
      description: "Optional description text providing more context",
      control: "text",
    },
    icon: {
      description: "Optional icon to display above the title",
      control: false,
    },
    actionLabel: {
      description: "Primary action button text",
      control: "text",
    },
    onAction: {
      description: "Primary action callback",
      action: "primaryAction",
    },
    secondaryActionLabel: {
      description: "Secondary action button text",
      control: "text",
    },
    onSecondaryAction: {
      description: "Secondary action callback",
      action: "secondaryAction",
    },
    theme: {
      description: 'Theme mode for the empty state ("light" or "dark")',
      control: "select",
      options: ["light", "dark"],
    },
    paddingY: {
      description: "Vertical padding in theme spacing units",
      control: "number",
    },
    children: {
      description: "Additional content below actions",
      control: false,
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: "600px", height: "400px" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: "No checks yet",
    description: "Create your first check to get started with data validation",
    actionLabel: "Create Check",
    secondaryActionLabel: "Browse Templates",
  },
};

export const WithIcon: Story = {
  args: {
    title: "No files found",
    description: "Upload files to see them here",
    icon: <TbInbox />,
    actionLabel: "Upload Files",
  },
};

export const WithCustomContent: Story = {
  args: {
    title: "No connection configured",
    description: "Connect your database to start validating data",
    icon: <TbInbox />,
    actionLabel: "Setup Connection",
    children: (
      <div style={{ fontSize: "12px", color: "#888" }}>
        Need help?{" "}
        <a href="#" style={{ color: "#3b82f6" }}>
          View documentation
        </a>
      </div>
    ),
  },
};

export const PrimaryActionClick: Story = {
  args: {
    title: "No data",
    actionLabel: "Load Data",
    onAction: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const actionButton = canvas.getByRole("button", { name: /load data/i });
    await userEvent.click(actionButton);
    expect(args.onAction).toHaveBeenCalled();
  },
};

export const SecondaryActionClick: Story = {
  args: {
    title: "No items",
    actionLabel: "Create Item",
    onAction: fn(),
    secondaryActionLabel: "Import",
    onSecondaryAction: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const secondaryButton = canvas.getByRole("button", { name: /import/i });
    await userEvent.click(secondaryButton);
    expect(args.onSecondaryAction).toHaveBeenCalled();
  },
};
