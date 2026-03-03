// packages/storybook/stories/query/QueryResultView.stories.tsx
import { QueryResultView } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { fullscreenDecorator } from "../decorators";
import {
  createQueryBaseRun,
  createQueryRun,
  createTruncatedDataFrame,
  largeDataFrame,
  wideDataFrame,
} from "./fixtures";

const meta: Meta<typeof QueryResultView> = {
  title: "Visualizations/Query/QueryResultView",
  component: QueryResultView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Result view for single-environment query results. Displays query output in a data grid format.

## Usage

\`\`\`tsx
import { QueryResultView } from '@datarecce/ui/components';

<QueryResultView
  run={{
    run_id: '1',
    type: 'query',
    run_at: '2024-01-15T10:30:00Z',
    params: { sql_template: 'SELECT * FROM orders' },
    result: { columns: [...], data: [...] }
  }}
  viewOptions={{ pinned_columns: ['id'] }}
  onViewOptionsChanged={setViewOptions}
/>
\`\`\`

**Note:** For query comparisons (base vs current), use \`QueryDiffResultView\` instead.`,
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    run: {
      description: "Query run data with result DataFrame",
      control: "object",
    },
    viewOptions: {
      description: "View options (pinned columns, render modes)",
      control: "object",
    },
    onViewOptionsChanged: {
      description: "Callback when view options change",
      action: "viewOptionsChanged",
    },
    onAddToChecklist: {
      description: "Callback to add run to checklist (shows button when set)",
      action: "addToChecklist",
    },
  },
  decorators: [fullscreenDecorator],
};

export default meta;
type Story = StoryObj<typeof QueryResultView>;

export const Default: Story = {
  args: {
    run: createQueryRun(),
  },
};

export const WithAddToChecklist: Story = {
  name: "With Add to Checklist Button",
  args: {
    run: createQueryRun(),
    onAddToChecklist: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows the "Add to Checklist" button in the toolbar when the callback is provided.',
      },
    },
  },
};

export const QueryBaseRun: Story = {
  name: "Query Base Run (Single Environment)",
  args: {
    run: createQueryBaseRun(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Single-environment query run (query_base type). Displays results from the base environment only.",
      },
    },
  },
};

export const TruncatedResults: Story = {
  name: "Truncated Results (Warning)",
  args: {
    run: createQueryRun({
      result: createTruncatedDataFrame(),
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

export const ManyRows: Story = {
  name: "Many Rows (100)",
  args: {
    run: createQueryRun({
      result: largeDataFrame,
    }),
  },
  parameters: {
    docs: {
      description: {
        story: "Query result with 100 rows to test vertical scrolling.",
      },
    },
  },
};

export const WideTable: Story = {
  name: "Wide Table (20+ Columns)",
  args: {
    run: createQueryRun({
      result: wideDataFrame,
    }),
  },
  parameters: {
    docs: {
      description: {
        story: "Query result with 20+ columns to test horizontal scrolling.",
      },
    },
  },
};

export const NoData: Story = {
  name: "No Data",
  args: {
    run: createQueryRun({
      result: undefined,
    }),
  },
};
