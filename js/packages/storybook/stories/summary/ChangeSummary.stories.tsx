// packages/storybook/stories/summary/ChangeSummary.stories.tsx
import { ChangeSummary } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  additionsOnlyGraph,
  createChangeSummaryGraph,
  manyChangesGraph,
  noChangesGraph,
} from "./fixtures";

const meta: Meta<typeof ChangeSummary> = {
  title: "Visualizations/Summary/ChangeSummary",
  component: ChangeSummary,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Displays a summary of changes detected in a lineage graph, split into two sections:
- **Code Changes:** Added, removed, and modified nodes (models/sources)
- **Column Changes:** Added, removed, and modified columns across all changed nodes

Each change type is shown with its corresponding icon and count.

## Usage

\`\`\`tsx
import { ChangeSummary } from '@datarecce/ui/components';

<ChangeSummary lineageGraph={lineageGraph} />
\`\`\``,
      },
    },
    layout: "centered",
  },
  argTypes: {
    lineageGraph: {
      description: "The lineage graph to analyze for changes",
      control: "object",
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: "800px", padding: "20px" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ChangeSummary>;

export const Default: Story = {
  args: {
    lineageGraph: createChangeSummaryGraph(),
  },
};

export const NoChanges: Story = {
  name: "No Changes",
  args: {
    lineageGraph: noChangesGraph,
  },
  parameters: {
    docs: {
      description: {
        story: "Lineage graph with no modifications — all counts are zero.",
      },
    },
  },
};

export const AdditionsOnly: Story = {
  name: "Additions Only",
  args: {
    lineageGraph: additionsOnlyGraph,
  },
  parameters: {
    docs: {
      description: {
        story: "Only new models added, no removals or modifications.",
      },
    },
  },
};

export const ManyChanges: Story = {
  name: "Many Changes (15 Models)",
  args: {
    lineageGraph: manyChangesGraph,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Large project with 15 changed models across all change types, including column changes.",
      },
    },
  },
};
