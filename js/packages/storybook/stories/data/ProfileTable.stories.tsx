// packages/storybook/stories/data/ProfileTable.stories.tsx
import { ProfileTable } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
  createProfileColumn,
  createProfileRow,
  sampleProfileColumns,
  sampleProfileRows,
} from "./fixtures";

const meta: Meta<typeof ProfileTable> = {
  title: "Visualizations/Data/ProfileTable",
  component: ProfileTable,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Displays data profile statistics in a tabular format using AG Grid. Supports inline and side-by-side diff display modes with pinned columns and custom rendering.",
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    columns: {
      description: "Column definitions for the table",
      control: "object",
    },
    rows: {
      description: "Row data to display",
      control: "object",
    },
    displayMode: {
      description: "Display mode for diff view",
      control: "select",
      options: ["inline", "side-by-side"],
    },
    onDisplayModeChange: {
      description: "Callback when display mode changes",
      action: "displayModeChanged",
    },
    showDisplayModeToggle: {
      description: "Show display mode toggle in toolbar",
      control: "boolean",
    },
    rowHeight: {
      description: "Row height in pixels",
      control: "number",
    },
    theme: {
      description: "Theme mode (light or dark)",
      control: "select",
      options: ["light", "dark"],
    },
  },
  decorators: [
    (Story, context) => {
      // Only apply padding in Canvas view, not in Docs view
      const isDocsView = context.viewMode === "docs";
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: isDocsView ? "600px" : "100vh",
            minHeight: "600px",
            width: "100%",
            padding: isDocsView ? "0" : "20px",
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof ProfileTable>;

// ============================================
// Primary Use Cases
// ============================================

export const Default: Story = {
  args: {
    columns: [
      createProfileColumn({
        field: "column",
        headerName: "Column",
        width: 200,
        pinned: "left",
      }),
      createProfileColumn({ field: "dtype", headerName: "Type", width: 120 }),
      createProfileColumn({
        field: "count",
        headerName: "Count",
        width: 120,
        isMetric: true,
      }),
      createProfileColumn({
        field: "nulls",
        headerName: "Nulls",
        width: 120,
        isMetric: true,
      }),
      createProfileColumn({
        field: "distinct",
        headerName: "Distinct",
        width: 120,
        isMetric: true,
      }),
    ],
    rows: [
      createProfileRow({
        column: "user_id",
        dtype: "INTEGER",
        count: 1000,
        nulls: 0,
        distinct: 1000,
      }),
      createProfileRow({
        column: "username",
        dtype: "VARCHAR",
        count: 1000,
        nulls: 5,
        distinct: 995,
      }),
      createProfileRow({
        column: "email",
        dtype: "VARCHAR",
        count: 1000,
        nulls: 0,
        distinct: 1000,
      }),
      createProfileRow({
        column: "age",
        dtype: "INTEGER",
        count: 1000,
        nulls: 50,
        distinct: 70,
      }),
      createProfileRow({
        column: "created_at",
        dtype: "TIMESTAMP",
        count: 1000,
        nulls: 0,
        distinct: 1000,
      }),
    ],
  },
};

export const WithDiffData: Story = {
  name: "Diff Display - Inline",
  args: {
    columns: sampleProfileColumns,
    rows: sampleProfileRows,
    displayMode: "inline",
    showDisplayModeToggle: true,
    onDisplayModeChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Profile table showing base vs current comparison with inline display mode. Rows are color-coded by diff status (added=green, removed=red, modified=yellow).",
      },
    },
  },
};

export const SideBySideMode: Story = {
  name: "Diff Display - Side by Side",
  args: {
    columns: sampleProfileColumns,
    rows: sampleProfileRows,
    displayMode: "side-by-side",
    showDisplayModeToggle: true,
    onDisplayModeChange: fn(),
  },
};

// ============================================
// Theme Variants
// ============================================

export const DarkTheme: Story = {
  name: "Dark Theme",
  args: {
    columns: sampleProfileColumns,
    rows: sampleProfileRows,
    theme: "dark",
    showDisplayModeToggle: true,
    onDisplayModeChange: fn(),
  },
  parameters: {
    backgrounds: { default: "dark" },
  },
};

// ============================================
// Interactive Variants
// ============================================

export const PinnedColumns: Story = {
  name: "With Pinned Columns",
  args: {
    columns: [
      createProfileColumn({
        field: "column",
        headerName: "Column",
        width: 200,
        pinned: "left",
      }),
      createProfileColumn({ field: "dtype", headerName: "Type", width: 120 }),
      ...Array.from({ length: 10 }, (_, i) =>
        createProfileColumn({
          field: `metric_${i}`,
          headerName: `Metric ${i}`,
          width: 100,
          isMetric: true,
        }),
      ),
    ],
    rows: Array.from({ length: 20 }, (_, i) =>
      createProfileRow({
        column: `column_${i}`,
        dtype: i % 3 === 0 ? "INTEGER" : i % 3 === 1 ? "VARCHAR" : "TIMESTAMP",
        count: Math.floor(Math.random() * 10000),
        nulls: Math.floor(Math.random() * 100),
      }),
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Profile table with many columns. The first column is pinned for easy navigation.",
      },
    },
  },
};

export const CustomRowHeight: Story = {
  name: "Custom Row Height",
  args: {
    columns: sampleProfileColumns,
    rows: sampleProfileRows,
    rowHeight: 48,
  },
};

// ============================================
// Edge Cases
// ============================================

export const EmptyState: Story = {
  name: "Empty State",
  args: {
    columns: sampleProfileColumns,
    rows: [],
    emptyMessage: "No profile data available",
  },
};

export const NoColumns: Story = {
  name: "No Columns",
  args: {
    columns: [],
    rows: sampleProfileRows,
    emptyMessage: "No columns defined",
  },
};

export const SingleRow: Story = {
  name: "Single Row",
  args: {
    columns: sampleProfileColumns,
    rows: [sampleProfileRows[0]],
  },
};

export const ManyRows: Story = {
  name: "Many Rows (100+)",
  args: {
    columns: [
      createProfileColumn({
        field: "column",
        headerName: "Column",
        width: 200,
        pinned: "left",
      }),
      createProfileColumn({ field: "dtype", headerName: "Type", width: 120 }),
      createProfileColumn({
        field: "count",
        headerName: "Count",
        width: 120,
        isMetric: true,
      }),
      createProfileColumn({
        field: "nulls",
        headerName: "Nulls",
        width: 120,
        isMetric: true,
      }),
      createProfileColumn({
        field: "distinct",
        headerName: "Distinct",
        width: 120,
        isMetric: true,
      }),
    ],
    rows: Array.from({ length: 100 }, (_, i) =>
      createProfileRow({
        __rowKey: `row-${i}`,
        column: `column_${i}`,
        dtype: i % 3 === 0 ? "INTEGER" : i % 3 === 1 ? "VARCHAR" : "TIMESTAMP",
        count: Math.floor(Math.random() * 10000),
        nulls: Math.floor(Math.random() * 100),
        distinct: Math.floor(Math.random() * 10000),
      }),
    ),
  },
  parameters: {
    docs: {
      description: {
        story: "Profile table with 100+ rows to test scrolling performance.",
      },
    },
  },
};

export const AllDiffStatuses: Story = {
  name: "All Diff Statuses",
  args: {
    columns: sampleProfileColumns,
    rows: [
      { ...sampleProfileRows[0], __status: "added" },
      { ...sampleProfileRows[1], __status: "removed" },
      { ...sampleProfileRows[2], __status: "modified" },
      { ...sampleProfileRows[3], __status: "unchanged" },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows all possible diff statuses: added (green), removed (red), modified (yellow), unchanged.",
      },
    },
  },
};
