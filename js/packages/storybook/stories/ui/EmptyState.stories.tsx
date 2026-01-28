import { EmptyState } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TbFolderOpen, TbInbox, TbSearch } from "react-icons/tb";
import { expect, fn, userEvent, within } from "storybook/test";

const meta: Meta<typeof EmptyState> = {
  title: "UI/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A pure presentation component for displaying empty states with optional icon, actions, and custom content. Used when a list, grid, or view has no data to display.",
      },
    },
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
    className: {
      description: "Optional CSS class name",
      control: "text",
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

// ============================================
// Basic States
// ============================================

export const Default: Story = {
  name: "Default",
  args: {
    title: "No data available",
  },
};

export const WithDescription: Story = {
  name: "With Description",
  args: {
    title: "No checks yet",
    description: "Create your first check to get started with data validation",
  },
};

export const WithIcon: Story = {
  name: "With Icon",
  args: {
    title: "No files found",
    description: "Upload files to see them here",
    icon: <TbFolderOpen />,
  },
};

// ============================================
// With Actions
// ============================================

export const WithPrimaryAction: Story = {
  name: "With Primary Action",
  args: {
    title: "No search results",
    description: "Try adjusting your search criteria or filters",
    icon: <TbSearch />,
    actionLabel: "Clear Filters",
    onAction: fn(),
  },
};

export const WithBothActions: Story = {
  name: "With Both Actions",
  args: {
    title: "No checks configured",
    description:
      "Set up your first data validation check to start monitoring quality",
    icon: <TbInbox />,
    actionLabel: "Create Check",
    onAction: fn(),
    secondaryActionLabel: "View Examples",
    onSecondaryAction: fn(),
  },
};

export const ActionsOnly: Story = {
  name: "Actions Only (No Description)",
  args: {
    title: "Empty workspace",
    actionLabel: "Get Started",
    onAction: fn(),
    secondaryActionLabel: "Learn More",
    onSecondaryAction: fn(),
  },
};

// ============================================
// Theme Variants
// ============================================

export const LightTheme: Story = {
  name: "Light Theme",
  args: {
    title: "No items",
    description: "Light theme is the default appearance",
    icon: <TbInbox />,
    theme: "light",
  },
};

export const DarkTheme: Story = {
  name: "Dark Theme",
  parameters: {
    docs: {
      description: {
        story:
          "Dark theme variant uses adjusted colors for better contrast on dark backgrounds.",
      },
    },
    backgrounds: { default: "dark" },
  },
  args: {
    title: "No items",
    description: "Optimized colors for dark mode interfaces",
    icon: <TbInbox />,
    theme: "dark",
  },
};

// ============================================
// Custom Content
// ============================================

export const WithCustomContent: Story = {
  name: "With Custom Content",
  parameters: {
    docs: {
      description: {
        story:
          "Additional content can be provided via the children prop for custom help text or links.",
      },
    },
  },
  args: {
    title: "No connection configured",
    description: "Connect your database to start validating data",
    icon: <TbInbox />,
    actionLabel: "Setup Connection",
    onAction: fn(),
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

// ============================================
// Layout Variants
// ============================================

export const CompactPadding: Story = {
  name: "Compact Padding",
  parameters: {
    docs: {
      description: {
        story: "Reduced vertical padding for constrained spaces.",
      },
    },
  },
  args: {
    title: "No results",
    description: "Try a different query",
    paddingY: 4,
  },
};

export const SpacousPadding: Story = {
  name: "Spacious Padding",
  args: {
    title: "Welcome to your workspace",
    description: "Create your first project to get started",
    paddingY: 12,
  },
};

// ============================================
// Real-World Examples
// ============================================

export const NoChecksExample: Story = {
  name: "No Checks Example",
  args: {
    title: "No checks yet",
    description:
      "Checks help you validate data quality and catch regressions. Create your first check to get started.",
    icon: <TbInbox />,
    actionLabel: "Create Check",
    onAction: fn(),
    secondaryActionLabel: "Browse Templates",
    onSecondaryAction: fn(),
  },
};

export const SearchNoResults: Story = {
  name: "Search No Results",
  args: {
    title: "No results found",
    description: 'No checks match your search for "analytics"',
    icon: <TbSearch />,
    actionLabel: "Clear Search",
    onAction: fn(),
  },
};

export const EmptyFolder: Story = {
  name: "Empty Folder",
  args: {
    title: "This folder is empty",
    description: "Add files to this folder to see them here",
    icon: <TbFolderOpen />,
    actionLabel: "Upload Files",
    onAction: fn(),
  },
};

// ============================================
// Interactive Tests
// ============================================

export const PrimaryActionClick: Story = {
  name: "Primary Action Click Test",
  args: {
    title: "No data",
    actionLabel: "Load Data",
    onAction: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Click primary action button
    const actionButton = canvas.getByRole("button", { name: /load data/i });
    await userEvent.click(actionButton);

    // Verify callback was called
    expect(args.onAction).toHaveBeenCalled();
  },
};

export const SecondaryActionClick: Story = {
  name: "Secondary Action Click Test",
  args: {
    title: "No items",
    actionLabel: "Create Item",
    onAction: fn(),
    secondaryActionLabel: "Import",
    onSecondaryAction: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Click secondary action button
    const secondaryButton = canvas.getByRole("button", { name: /import/i });
    await userEvent.click(secondaryButton);

    // Verify callback was called
    expect(args.onSecondaryAction).toHaveBeenCalled();
  },
};

// ============================================
// Edge Cases
// ============================================

export const VeryLongTitle: Story = {
  name: "Very Long Title",
  args: {
    title:
      "This is a very long title that demonstrates how the component handles extended text content",
    description: "The title should wrap naturally within the container",
  },
};

export const VeryLongDescription: Story = {
  name: "Very Long Description",
  args: {
    title: "Empty state",
    description:
      "This is a very long description that provides extensive context about why this state is empty and what users should do next. It demonstrates how the component handles longer text content while maintaining readability with a maximum width constraint of 400px.",
  },
};

export const LongActionLabels: Story = {
  name: "Long Action Labels",
  args: {
    title: "No configuration",
    actionLabel: "Configure Advanced Settings",
    onAction: fn(),
    secondaryActionLabel: "View Documentation and Examples",
    onSecondaryAction: fn(),
  },
};
