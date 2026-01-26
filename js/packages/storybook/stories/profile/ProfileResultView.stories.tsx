// packages/storybook/stories/profile/ProfileResultView.stories.tsx
import { ProfileResultView } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createEmptyProfileDataFrame,
  createLargeProfileDataFrame,
  createProfileRun,
} from "./fixtures";

// ============================================
// ProfileResultView (Single Environment)
// ============================================

const meta: Meta<typeof ProfileResultView> = {
  title: "Visualizations/Profile/ProfileResultView",
  component: ProfileResultView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Result view for single environment profile statistics. Displays column-level metrics (data types, null proportions, distinct counts, etc.) for a dbt model in a data grid format.",
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    run: {
      description: "Profile run data containing column statistics",
      control: "object",
    },
    viewOptions: {
      description: "View options for customizing the display",
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
type Story = StoryObj<typeof ProfileResultView>;

export const Default: Story = {
  args: {
    run: createProfileRun(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default profile view showing column statistics for a single environment. Proportion columns (not_null_proportion, distinct_proportion) are displayed as percentages by default for better readability.",
      },
    },
  },
};

export const ManyColumns: Story = {
  name: "Many Columns (50+)",
  args: {
    run: createProfileRun({
      result: {
        current: createLargeProfileDataFrame(),
      },
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Profile view with 50+ columns to test scrolling performance and grid behavior with large datasets.",
      },
    },
  },
};

export const NoData: Story = {
  name: "No Data",
  args: {
    run: createProfileRun({
      result: {
        current: createEmptyProfileDataFrame(),
      },
    }),
  },
  parameters: {
    docs: {
      description: {
        story: "Empty state when no profile data is available.",
      },
    },
  },
};

export const WithPinnedColumns: Story = {
  name: "With Pinned Columns",
  args: {
    run: createProfileRun({
      result: {
        current: createLargeProfileDataFrame(),
      },
    }),
    viewOptions: {
      pinned_columns: ["column_name"],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Profile view with the column_name column pinned to the left for easier navigation when scrolling horizontally.",
      },
    },
  },
};

export const DecimalDisplay: Story = {
  name: "Decimal Display Mode",
  args: {
    run: createProfileRun(),
    viewOptions: {
      columnsRenderMode: {
        not_null_proportion: 2,
        distinct_proportion: 2,
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Profile view with proportion columns displayed as raw decimals (0.997) instead of the default percentage format (99.7%). This overrides the default percentage display.",
      },
    },
  },
};
