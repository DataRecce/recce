import { ScreenshotDataGrid } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SchemaLegend } from "../../../ui/src/components/schema/SchemaView";
import {
  definitionChangedRows,
  generateWideSchema,
  getRowClass,
  mixedDiffRows,
  schemaColumns,
  unchangedRows,
} from "./fixtures";

const GRID_STYLE = {
  blockSize: "auto",
  maxHeight: "100%",
  overflow: "auto",
  fontSize: "10pt",
  borderWidth: 1,
} as const;

const meta: Meta<typeof ScreenshotDataGrid> = {
  title: "Schema/SchemaView",
  component: ScreenshotDataGrid,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story, context) => {
      const isDocsView = context.viewMode === "docs";
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: isDocsView ? "400px" : "100vh",
            minHeight: isDocsView ? "300px" : "600px",
            width: "100%",
            padding: isDocsView ? "0" : "20px",
          }}
        >
          <SchemaLegend />
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
  name: "With Changes (mixed diff)",
  args: {
    style: GRID_STYLE,
    columns: schemaColumns,
    rows: mixedDiffRows,
    rowHeight: 35,
    getRowClass,
    className: "rdg-light",
  },
};

export const NoChanges: Story = {
  args: {
    style: GRID_STYLE,
    columns: schemaColumns,
    rows: unchangedRows,
    rowHeight: 35,
    getRowClass,
    className: "rdg-light",
  },
};

export const DefinitionChanged: Story = {
  name: "Definition Changed (SQL expression changed)",
  args: {
    style: GRID_STYLE,
    columns: schemaColumns,
    rows: definitionChangedRows,
    rowHeight: 35,
    getRowClass,
    className: "rdg-light",
  },
};

// ============================================
// Edge Cases
// ============================================

export const Empty: Story = {
  args: {
    style: GRID_STYLE,
    columns: schemaColumns,
    rows: [],
    rowHeight: 35,
    className: "rdg-light",
  },
};

export const WideSchema: Story = {
  name: "Wide Schema (50 columns)",
  args: {
    style: GRID_STYLE,
    columns: schemaColumns,
    rows: generateWideSchema(50),
    rowHeight: 35,
    getRowClass,
    className: "rdg-light",
  },
};
