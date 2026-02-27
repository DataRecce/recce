// packages/storybook/stories/valuediff/ValueDiffDetailResultView.stories.tsx
import { ValueDiffDetailResultView } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { fullscreenDecorator } from "../decorators";
import {
  createValueDiffDetailRun,
  valueDiffDetailNoChanges,
  valueDiffDetailTruncated,
} from "./fixtures";

const meta: Meta<typeof ValueDiffDetailResultView> = {
  title: "Visualizations/ValueDiff/ValueDiffDetailResultView",
  component: ValueDiffDetailResultView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Row-level value diff detail view. Shows individual row differences with changed highlighting.

## Features
- Row-level diff with added/removed/modified highlighting
- "Changed only" filter to hide matching rows
- Inline vs side-by-side display mode toggle
- Column pinning support
- Truncation warning for large result sets

## Usage

\`\`\`tsx
import { ValueDiffDetailResultView } from '@datarecce/ui/components';

<ValueDiffDetailResultView
  run={valueDiffDetailRun}
  viewOptions={{ changed_only: true, display_mode: 'inline' }}
  onViewOptionsChanged={setViewOptions}
/>
\`\`\`

**Note:** For column-level summary statistics, use \`ValueDiffResultView\`.`,
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    run: {
      description: "Value diff detail run with row-level diff data",
      control: "object",
    },
    viewOptions: {
      description: "View options (changed_only, display_mode, pinned_columns)",
      control: "object",
    },
    onViewOptionsChanged: {
      description: "Callback when view options change",
      action: "viewOptionsChanged",
    },
  },
  args: {
    onViewOptionsChanged: fn(),
  },
  decorators: [fullscreenDecorator],
};

export default meta;
type Story = StoryObj<typeof ValueDiffDetailResultView>;

export const Default: Story = {
  args: {
    run: createValueDiffDetailRun(),
  },
};

export const ChangedOnly: Story = {
  name: "Changed Only",
  args: {
    run: createValueDiffDetailRun(),
    viewOptions: { changed_only: true },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows only rows with differences when "changed only" is enabled.',
      },
    },
  },
};

export const SideBySide: Story = {
  name: "Side by Side",
  args: {
    run: createValueDiffDetailRun(),
    viewOptions: { display_mode: "side_by_side" },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Side-by-side display showing base and current values in separate columns.",
      },
    },
  },
};

export const NoChanges: Story = {
  name: "No Changes (Changed Only)",
  args: {
    run: createValueDiffDetailRun({
      result: valueDiffDetailNoChanges,
    }),
    viewOptions: { changed_only: true },
  },
  parameters: {
    docs: {
      description: {
        story:
          'All rows match with "changed only" enabled — shows "No change" empty state with toolbar.',
      },
    },
  },
};

export const Truncated: Story = {
  name: "Truncated Results",
  args: {
    run: createValueDiffDetailRun({
      result: valueDiffDetailTruncated,
    }),
  },
  parameters: {
    docs: {
      description: {
        story: "Shows amber truncation warning when results exceed the limit.",
      },
    },
  },
};

export const CompositePrimaryKey: Story = {
  name: "Composite Primary Key",
  args: {
    run: createValueDiffDetailRun({
      params: {
        model: "order_items",
        primary_key: ["order_id", "item_id"],
      },
      result: {
        columns: [
          { key: "order_id", name: "order_id", type: "integer" },
          { key: "item_id", name: "item_id", type: "integer" },
          { key: "product_name", name: "product_name", type: "text" },
          { key: "quantity", name: "quantity", type: "integer" },
          { key: "price", name: "price", type: "number" },
          { key: "in_a", name: "in_a", type: "boolean" },
          { key: "in_b", name: "in_b", type: "boolean" },
        ],
        data: [
          [1, 1, "Widget A", 5, 10.0, true, true],
          [1, 2, "Widget B", 3, 15.0, true, true],
          [1, 2, "Widget B", 4, 15.0, true, true], // quantity changed
          [2, 1, "Gadget X", 1, 50.0, true, false], // removed
          [3, 1, "Gizmo Z", 2, 25.0, false, true], // added
        ],
      },
    }),
  },
  parameters: {
    docs: {
      description: {
        story: "Value diff detail with a composite (multi-column) primary key.",
      },
    },
  },
};

export const NoData: Story = {
  name: "No Data",
  args: {
    run: createValueDiffDetailRun({
      result: undefined,
    }),
  },
};
