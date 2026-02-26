// packages/storybook/stories/valuediff/ValueDiffResultView.stories.tsx
import { ValueDiffResultView } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createValueDiffRun,
  valueDiffAllMatch,
  valueDiffManyColumns,
} from "./fixtures";

const meta: Meta<typeof ValueDiffResultView> = {
  title: "Visualizations/ValueDiff/ValueDiffResultView",
  component: ValueDiffResultView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Column-level value diff summary view. Shows match statistics per column between base and current environments.

## Usage

\`\`\`tsx
import { ValueDiffResultView } from '@datarecce/ui/components';

<ValueDiffResultView
  run={{
    run_id: '1',
    type: 'value_diff',
    run_at: '2024-01-15T10:30:00Z',
    params: { model: 'orders', primary_key: 'id' },
    result: {
      summary: { total: 1000, added: 50, removed: 30 },
      data: { columns: [...], data: [...] }
    }
  }}
/>
\`\`\`

Displays a summary header with total/common/added/removed row counts, followed by a data grid showing each column's match count and percentage.

**Note:** For row-level value diff details, use \`ValueDiffDetailResultView\`.`,
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    run: {
      description: "Value diff run with column-level match statistics",
      control: "object",
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
type Story = StoryObj<typeof ValueDiffResultView>;

export const Default: Story = {
  args: {
    run: createValueDiffRun(),
  },
};

export const AllColumnsMatch: Story = {
  name: "All Columns Match (100%)",
  args: {
    run: createValueDiffRun({
      result: valueDiffAllMatch,
    }),
  },
  parameters: {
    docs: {
      description: {
        story: "All columns have 100% match rate with no added/removed rows.",
      },
    },
  },
};

export const ManyColumns: Story = {
  name: "Many Columns (20+)",
  args: {
    run: createValueDiffRun({
      result: valueDiffManyColumns,
    }),
  },
  parameters: {
    docs: {
      description: {
        story: "Value diff with 20+ columns to test scrolling and layout.",
      },
    },
  },
};

export const NoResult: Story = {
  name: "No Result",
  args: {
    run: createValueDiffRun({
      result: undefined,
    }),
  },
};

export const NoParams: Story = {
  name: "No Params",
  args: {
    run: createValueDiffRun({
      params: undefined,
    }),
  },
};
