// packages/storybook/stories/data/ScreenshotDataGrid.stories.tsx
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
  createGridColumn,
  createGridRow,
  generateGridRows,
  gridRowsWithDiff,
  sampleGridColumns,
} from "./fixtures";

const meta: Meta<typeof ScreenshotDataGrid> = {
  title: "Visualizations/Data/ScreenshotDataGrid",
  component: ScreenshotDataGrid,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "AG Grid wrapper with screenshot support, automatic theme switching, and backward compatibility with react-data-grid API. Provides default configurations for cell focus and hover behavior.",
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    columnDefs: {
      description: "Column definitions (AG Grid style)",
      control: "object",
    },
    rowData: {
      description: "Row data (AG Grid style)",
      control: "object",
    },
    columns: {
      description: "Column definitions (legacy react-data-grid style)",
      control: "object",
    },
    rows: {
      description: "Row data (legacy react-data-grid style)",
      control: "object",
    },
    rowHeight: {
      description: "Row height in pixels",
      control: "number",
    },
    headerHeight: {
      description: "Header height in pixels",
      control: "number",
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
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
type Story = StoryObj<typeof ScreenshotDataGrid>;

// ============================================
// Primary Use Cases
// ============================================

export const Default: Story = {
  args: {
    columnDefs: sampleGridColumns,
    rowData: generateGridRows(20),
  },
};

export const LegacyAPI: Story = {
  name: "Legacy react-data-grid API",
  args: {
    columns: sampleGridColumns,
    rows: generateGridRows(20),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Backward compatible with react-data-grid API using 'columns' and 'rows' props.",
      },
    },
  },
};

export const WithDiffCells: Story = {
  name: "With Diff Cell Styling",
  args: {
    columnDefs: sampleGridColumns,
    rowData: gridRowsWithDiff.map((row) => ({
      ...row,
      created_at: new Date().toISOString(),
    })),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Grid with diff cell styling: added (green), removed (red), modified (yellow).",
      },
    },
  },
};

// ============================================
// Interactive Variants
// ============================================

export const WithManyColumns: Story = {
  name: "Many Columns (15+)",
  args: {
    columnDefs: [
      createGridColumn({
        field: "id",
        headerName: "ID",
        width: 80,
        pinned: "left",
      }),
      ...Array.from({ length: 15 }, (_, i) =>
        createGridColumn({
          field: `col_${i}`,
          headerName: `Column ${i}`,
          width: 150,
        }),
      ),
    ],
    rowData: generateGridRows(50),
  },
  parameters: {
    docs: {
      description: {
        story: "Grid with many columns to test horizontal scrolling.",
      },
    },
  },
};

export const WithPinnedColumn: Story = {
  name: "With Pinned Column",
  args: {
    columnDefs: [
      createGridColumn({
        field: "id",
        headerName: "ID",
        width: 80,
        pinned: "left",
      }),
      createGridColumn({ field: "name", headerName: "Name", width: 200 }),
      createGridColumn({ field: "value", headerName: "Value", width: 120 }),
      createGridColumn({ field: "status", headerName: "Status", width: 120 }),
      ...Array.from({ length: 10 }, (_, i) =>
        createGridColumn({
          field: `extra_${i}`,
          headerName: `Extra ${i}`,
          width: 150,
        }),
      ),
    ],
    rowData: generateGridRows(30),
  },
};

export const CustomRowHeight: Story = {
  name: "Custom Row Height",
  args: {
    columnDefs: sampleGridColumns,
    rowData: generateGridRows(20),
    rowHeight: 48,
    headerHeight: 48,
  },
};

// ============================================
// Edge Cases
// ============================================

export const EmptyState: Story = {
  name: "Empty State",
  args: {
    columnDefs: sampleGridColumns,
    rowData: [],
    renderers: {
      noRowsFallback: <EmptyRowsRenderer emptyMessage="No data available" />,
    },
  },
};

export const EmptyStateCustom: Story = {
  name: "Empty State Custom",
  args: {
    columnDefs: sampleGridColumns,
    rowData: [],
    renderers: {
      noRowsFallback: (
        <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
          <h3>No Results Found</h3>
          <p>Try adjusting your filters or search criteria.</p>
        </div>
      ),
    },
  },
};

export const SingleRow: Story = {
  name: "Single Row",
  args: {
    columnDefs: sampleGridColumns,
    rowData: [createGridRow(0, { created_at: new Date().toISOString() })],
  },
};

export const ManyRows: Story = {
  name: "Many Rows (1000+)",
  args: {
    columnDefs: sampleGridColumns,
    rowData: generateGridRows(1000),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Grid with 1000+ rows to test scrolling performance and virtualization.",
      },
    },
  },
};

export const DynamicRowKey: Story = {
  name: "Dynamic Row Keys",
  args: {
    columnDefs: sampleGridColumns,
    rowData: Array.from({ length: 20 }, (_, i) => ({
      __rowKey: `dynamic-${i}-${Math.random()}`,
      id: i,
      name: `Dynamic Row ${i}`,
      value: Math.floor(Math.random() * 1000),
      status: i % 2 === 0 ? "active" : "inactive",
      created_at: new Date().toISOString(),
    })),
  },
  parameters: {
    docs: {
      description: {
        story: "Tests dynamic row key generation using __rowKey field.",
      },
    },
  },
};

export const NoColumns: Story = {
  name: "No Columns",
  args: {
    columnDefs: [],
    rowData: generateGridRows(20),
  },
};

export const WideColumns: Story = {
  name: "Wide Columns",
  args: {
    columnDefs: [
      createGridColumn({ field: "id", headerName: "ID", width: 400 }),
      createGridColumn({ field: "name", headerName: "Name", width: 400 }),
      createGridColumn({ field: "value", headerName: "Value", width: 400 }),
    ],
    rowData: generateGridRows(20),
  },
};
