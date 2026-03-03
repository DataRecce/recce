// packages/storybook/stories/profile/ProfileDiffResultView.stories.tsx
import { ProfileDiffResultView } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { createProfileDiffRun } from "./fixtures";

// ============================================
// ProfileDiffResultView (Base vs Current)
// ============================================

const meta: Meta<typeof ProfileDiffResultView> = {
  title: "Visualizations/Profile/ProfileDiffResultView",
  component: ProfileDiffResultView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Result view for comparing profile statistics between base and current environments. Displays column-level metrics from both environments in a data grid, with styling to highlight differences. Includes a display mode toggle to switch between inline and side-by-side views.",
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    run: {
      description:
        "Profile diff run data containing base and current statistics",
      control: "object",
    },
    viewOptions: {
      description: "View options including display mode and pinned columns",
      control: "object",
    },
    onViewOptionsChanged: {
      description: "Callback when view options change",
      action: "viewOptionsChanged",
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          height: "100vh",
          minHeight: "600px",
          width: "100%",
          padding: "20px",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProfileDiffResultView>;

export const Default: Story = {
  args: {
    run: createProfileDiffRun(),
    onViewOptionsChanged: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default profile diff view (inline mode) showing changes between base and current environments. Proportion columns display as percentages by default (99.7% instead of 0.997). Shows unchanged columns, modified columns (customer_lifetime_value with different stats), removed columns (deprecated_field highlighted in red), and added columns (net_customer_lifetime_value, net_value_segment highlighted in green).",
      },
    },
  },
};

export const SideBySideMode: Story = {
  name: "Side-by-Side Display Mode",
  args: {
    run: createProfileDiffRun(),
    viewOptions: {
      display_mode: "side_by_side",
    },
    onViewOptionsChanged: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Alternative display mode showing base and current environments in separate sections instead of inline.",
      },
    },
  },
};

export const DecimalDisplay: Story = {
  name: "Decimal Display Mode",
  args: {
    run: createProfileDiffRun(),
    viewOptions: {
      columnsRenderMode: {
        not_null_proportion: 2,
        distinct_proportion: 2,
      },
    },
    onViewOptionsChanged: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Profile diff with proportion columns displayed as raw decimals (0.997) instead of the default percentage format (99.7%). This overrides the default percentage display.",
      },
    },
  },
};

export const NoData: Story = {
  name: "No Data",
  args: {
    run: createProfileDiffRun({
      result: {
        base: {
          columns: [
            { key: "column_name", name: "column_name", type: "text" },
            { key: "data_type", name: "data_type", type: "text" },
            { key: "row_count", name: "row_count", type: "integer" },
          ],
          data: [],
        },
        current: {
          columns: [
            { key: "column_name", name: "column_name", type: "text" },
            { key: "data_type", name: "data_type", type: "text" },
            { key: "row_count", name: "row_count", type: "integer" },
          ],
          data: [],
        },
      },
    }),
    onViewOptionsChanged: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: "Empty state when no profile diff data is available.",
      },
    },
  },
};
