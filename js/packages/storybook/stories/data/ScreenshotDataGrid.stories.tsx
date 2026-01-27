// packages/storybook/stories/data/ScreenshotDataGrid.stories.tsx

import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CellClassParams } from "ag-grid-community";
import {
  createGridColumn,
  createGridRow,
  generateGridRows,
  gridRowsWithDiff,
  sampleGridColumns,
} from "./fixtures";

// Consistent style pattern used in production
const STANDARD_GRID_STYLE = {
  blockSize: "auto",
  maxHeight: "100%",
  overflow: "auto",
  fontSize: "0.875rem",
  borderWidth: 1,
} as const;

const meta: Meta<typeof ScreenshotDataGrid> = {
  title: "Visualizations/Data/ScreenshotDataGrid",
  component: ScreenshotDataGrid,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `AG Grid wrapper with screenshot support, automatic theme switching, and backward compatibility with react-data-grid API. Provides default configurations for cell focus and hover behavior.

## Usage

\`\`\`tsx
import { ScreenshotDataGrid } from '@datarecce/ui/primitives';

// Basic usage with AG Grid API
<ScreenshotDataGrid
  style={{
    blockSize: 'auto',
    maxHeight: '100%',
    overflow: 'auto',
    fontSize: '0.875rem',
    borderWidth: 1,
  }}
  columnDefs={[
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'value', headerName: 'Value', width: 120 },
  ]}
  rowData={[
    { id: 1, name: 'Item 1', value: 100 },
    { id: 2, name: 'Item 2', value: 200 },
  ]}
/>

// Legacy react-data-grid API (backward compatible)
<ScreenshotDataGrid
  columns={columns}
  rows={rows}
  rowHeight={35}
/>

// With diff styling
<ScreenshotDataGrid
  columnDefs={columns}
  rowData={rows.map(row => ({
    ...row,
    __status: 'added' // 'added', 'removed', 'modified', 'unchanged'
  }))}
/>
\`\`\``,
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
    (Story, context) => {
      const isDocsView = context.viewMode === "docs";
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: isDocsView ? "100px" : "100vh",
            minHeight: isDocsView ? "300px" : "600px",
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
type Story = StoryObj<typeof ScreenshotDataGrid>;

// ============================================
// Primary Use Cases
// ============================================

export const Default: Story = {
  args: {
    style: STANDARD_GRID_STYLE,
    columnDefs: sampleGridColumns,
    rowData: generateGridRows(20),
  },
};

export const LegacyAPI: Story = {
  name: "Legacy react-data-grid API",
  args: {
    style: STANDARD_GRID_STYLE,
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
    style: STANDARD_GRID_STYLE,
    columnDefs: [
      // Primary key column with diff-header styling
      createGridColumn({
        field: "id",
        headerName: "ID",
        width: 80,
        pinned: "left",
        cellClass: (params: CellClassParams) => {
          if (params.data?.__status) {
            return `diff-header-${params.data.__status}`;
          }
          return undefined;
        },
      }),
      // Regular columns with diff-cell styling
      createGridColumn({
        field: "name",
        headerName: "Name",
        width: 200,
        cellClass: (params: CellClassParams) => {
          if (params.data?.__status && params.data.__status !== "unchanged") {
            return `diff-cell-${params.data.__status}`;
          }
          return undefined;
        },
      }),
      createGridColumn({
        field: "value",
        headerName: "Value",
        width: 120,
        cellClass: (params: CellClassParams) => {
          if (params.data?.__status && params.data.__status !== "unchanged") {
            return `diff-cell-${params.data.__status}`;
          }
          return undefined;
        },
      }),
      createGridColumn({
        field: "status",
        headerName: "Status",
        width: 120,
        cellClass: (params: CellClassParams) => {
          if (params.data?.__status && params.data.__status !== "unchanged") {
            return `diff-cell-${params.data.__status}`;
          }
          return undefined;
        },
      }),
      createGridColumn({
        field: "created_at",
        headerName: "Created",
        width: 180,
        cellClass: (params: CellClassParams) => {
          if (params.data?.__status && params.data.__status !== "unchanged") {
            return `diff-cell-${params.data.__status}`;
          }
          return undefined;
        },
      }),
    ],
    rowData: gridRowsWithDiff,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Grid with diff cell styling: added (green background), removed (red background), modified (red background - currently shares styling with removed due to component bug). The ID column uses diff-header styling (bold colors), while data columns use diff-cell styling (lighter colors).",
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
    style: STANDARD_GRID_STYLE,
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
    style: STANDARD_GRID_STYLE,
    columnDefs: [
      createGridColumn({
        field: "id",
        headerName: "ID",
        width: 80,
      }),
      createGridColumn({
        field: "name",
        headerName: "Name",
        width: 200,
        pinned: "left",
      }),
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
    style: STANDARD_GRID_STYLE,
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
    style: STANDARD_GRID_STYLE,
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
    style: STANDARD_GRID_STYLE,
    columnDefs: sampleGridColumns,
    rowData: [],
    renderers: {
      noRowsFallback: (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--mui-palette-text-secondary)",
          }}
        >
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
    style: STANDARD_GRID_STYLE,
    columnDefs: sampleGridColumns,
    rowData: [createGridRow(0, { created_at: new Date().toISOString() })],
  },
};

export const ManyRows: Story = {
  name: "Many Rows (1000+)",
  args: {
    style: STANDARD_GRID_STYLE,
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
    style: STANDARD_GRID_STYLE,
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
    style: STANDARD_GRID_STYLE,
    columnDefs: [],
    rowData: generateGridRows(20),
  },
};

export const WideColumns: Story = {
  name: "Wide Columns",
  args: {
    style: STANDARD_GRID_STYLE,
    columnDefs: [
      createGridColumn({ field: "id", headerName: "ID", width: 400 }),
      createGridColumn({ field: "name", headerName: "Name", width: 400 }),
      createGridColumn({ field: "value", headerName: "Value", width: 400 }),
    ],
    rowData: generateGridRows(20),
  },
};
