// packages/storybook/stories/query/QueryDiffResultView.stories.tsx
import { QueryDiffResultView } from "@datarecce/ui/components";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { fullscreenDecorator } from "../decorators";
import {
  createDiffDataFrame,
  createQueryDiffRunJoin,
  createQueryDiffRunNonJoin,
  queryDiffNoChanges,
} from "./fixtures";

const meta: Meta<typeof QueryDiffResultView> = {
  title: "Visualizations/Query/QueryDiffResultView",
  component: QueryDiffResultView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Diff result view for comparing query results between base and current environments.

Supports two modes:
- **JOIN mode:** Server computes the diff, result has \`run.result.diff\`
- **Non-JOIN mode:** Client-side diff, result has \`run.result.base\` and \`run.result.current\`

## Features
- Row-level diff highlighting (added, removed, modified)
- "Changed only" filter toggle
- Side-by-side vs inline display mode
- Column pinning support
- Primary key selection (non-JOIN mode)
- Truncation and primary key uniqueness warnings

## Usage

\`\`\`tsx
import { QueryDiffResultView } from '@datarecce/ui/components';

<QueryDiffResultView
  run={queryDiffRun}
  viewOptions={{ changed_only: true, display_mode: 'inline' }}
  onViewOptionsChanged={setViewOptions}
/>
\`\`\``,
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    run: {
      description: "Query diff run data",
      control: "object",
    },
    viewOptions: {
      description:
        "View options (changed_only, display_mode, pinned_columns, primary_keys)",
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
type Story = StoryObj<typeof QueryDiffResultView>;

// ============================================
// JOIN Mode Stories
// ============================================

export const JoinMode: Story = {
  name: "JOIN Mode (Default)",
  args: {
    run: createQueryDiffRunJoin(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Server-side diff (JOIN mode). The diff is computed server-side and returned as a single DataFrame with __status markers.",
      },
    },
  },
};

export const JoinModeChangedOnly: Story = {
  name: "JOIN Mode — Changed Only",
  args: {
    run: createQueryDiffRunJoin(),
    viewOptions: { changed_only: true },
  },
  parameters: {
    docs: {
      description: {
        story:
          'JOIN mode with "changed only" filter enabled, showing only added/removed/modified rows.',
      },
    },
  },
};

export const JoinModeNoChanges: Story = {
  name: "JOIN Mode — No Changes",
  args: {
    run: queryDiffNoChanges,
    viewOptions: { changed_only: true },
  },
  parameters: {
    docs: {
      description: {
        story:
          'JOIN mode with "changed only" enabled but no changed rows — displays "No change" empty state.',
      },
    },
  },
};

export const JoinModeSideBySide: Story = {
  name: "JOIN Mode — Side by Side",
  args: {
    run: createQueryDiffRunJoin(),
    viewOptions: { display_mode: "side_by_side" },
  },
  parameters: {
    docs: {
      description: {
        story:
          "JOIN mode with side-by-side display showing base and current values in separate columns.",
      },
    },
  },
};

export const JoinModeTruncated: Story = {
  name: "JOIN Mode — Truncated",
  args: {
    run: createQueryDiffRunJoin({
      result: {
        diff: createDiffDataFrame({ limit: 500, more: true }),
      },
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "JOIN mode with truncated results, showing the amber limit warning.",
      },
    },
  },
};

// ============================================
// Non-JOIN Mode Stories
// ============================================

export const NonJoinMode: Story = {
  name: "Non-JOIN Mode",
  args: {
    run: createQueryDiffRunNonJoin(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Client-side diff (non-JOIN mode). Base and current DataFrames are compared client-side.",
      },
    },
  },
};

export const NoData: Story = {
  name: "No Data",
  args: {
    run: {
      run_id: "run-querydiff-empty",
      type: "query_diff",
      run_at: "2024-01-15T10:30:00.000Z",
      params: { sql_template: "SELECT 1" },
      result: undefined,
    },
  },
};
