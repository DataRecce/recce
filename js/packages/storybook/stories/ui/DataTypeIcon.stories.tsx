import { DataTypeIcon } from "@datarecce/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";

const meta: Meta<typeof DataTypeIcon> = {
  title: "UI/DataTypeIcon",
  component: DataTypeIcon,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Displays a semantic icon for a database column type. Classifies raw type strings (e.g. VARCHAR(256), TIMESTAMP_NTZ) into categories and renders the appropriate icon with a tooltip showing the original type.",
      },
    },
    layout: "centered",
  },
  argTypes: {
    type: {
      description: "The raw database type string (e.g. INTEGER, VARCHAR(256))",
      control: "text",
    },
    size: {
      description: "Icon size in pixels",
      control: { type: "number", min: 12, max: 48 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DataTypeIcon>;

// ============================================
// All Categories Overview
// ============================================

const allCategories: Array<{ label: string; type: string }> = [
  { label: "Integer", type: "INTEGER" },
  { label: "Number", type: "DOUBLE" },
  { label: "Text", type: "VARCHAR(256)" },
  { label: "Boolean", type: "BOOLEAN" },
  { label: "Date", type: "DATE" },
  { label: "Datetime", type: "TIMESTAMP_NTZ" },
  { label: "Time", type: "TIME" },
  { label: "Binary", type: "BINARY" },
  { label: "JSON", type: "JSON" },
  { label: "Array", type: "ARRAY" },
  { label: "Geography", type: "GEOGRAPHY" },
  { label: "Unknown", type: "XYZTYPE" },
];

export const AllCategories: Story = {
  name: "All Categories",
  parameters: {
    docs: {
      description: {
        story: "Overview of all 12 type categories with example type strings.",
      },
    },
  },
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto auto",
        gap: "12px 24px",
        alignItems: "center",
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      <strong>Icon</strong>
      <strong>Category</strong>
      <strong>Type String</strong>
      {allCategories.map(({ label, type }) => (
        <React.Fragment key={type}>
          <DataTypeIcon type={type} />
          <span>{label}</span>
          <code style={{ color: "var(--schema-color-muted)" }}>{type}</code>
        </React.Fragment>
      ))}
    </div>
  ),
};

// ============================================
// Individual Type Stories
// ============================================

export const Integer: Story = {
  args: { type: "INTEGER" },
};

export const NumberType: Story = {
  name: "Number",
  args: { type: "NUMERIC(10,2)" },
};

export const Text: Story = {
  args: { type: "VARCHAR(256)" },
};

export const BooleanType: Story = {
  name: "Boolean",
  args: { type: "BOOLEAN" },
};

export const DateType: Story = {
  name: "Date",
  args: { type: "DATE" },
};

export const Datetime: Story = {
  args: { type: "TIMESTAMP_NTZ" },
};

export const Time: Story = {
  args: { type: "TIME" },
};

export const Geography: Story = {
  args: { type: "GEOGRAPHY" },
};

export const Unknown: Story = {
  args: { type: "XYZTYPE" },
};

// ============================================
// Size Variants
// ============================================

export const SmallSize: Story = {
  name: "Small Size (CLL)",
  parameters: {
    docs: {
      description: {
        story: "Compact 16px icon as used in the Column-Level Lineage view.",
      },
    },
  },
  args: { type: "VARCHAR", size: 16 },
};

// ============================================
// Real-World Database Types
// ============================================

interface TypeRow {
  platform: string;
  types: string[];
}

const realWorldTypes: TypeRow[] = [
  {
    platform: "Snowflake",
    types: ["NUMBER(38,0)", "VARIANT", "TIMESTAMP_NTZ", "VARCHAR(16777216)"],
  },
  {
    platform: "PostgreSQL",
    types: ["BIGINT", "JSONB", "TIMESTAMPTZ", "CHARACTER VARYING", "BYTEA"],
  },
  {
    platform: "BigQuery",
    types: ["INT64", "FLOAT64", "STRING", "BOOL", "STRUCT", "ARRAY"],
  },
  {
    platform: "DuckDB",
    types: ["INTEGER", "DOUBLE", "VARCHAR", "BOOLEAN", "LIST"],
  },
];

export const RealWorldTypes: Story = {
  name: "Real-World Types",
  parameters: {
    docs: {
      description: {
        story:
          "Verifies classification across Snowflake, PostgreSQL, BigQuery, and DuckDB type strings.",
      },
    },
  },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      {realWorldTypes.map(({ platform, types }) => (
        <div key={platform}>
          <strong style={{ marginBottom: 8, display: "block" }}>
            {platform}
          </strong>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto auto",
              gap: "8px 16px",
              alignItems: "center",
            }}
          >
            {types.map((t) => (
              <React.Fragment key={t}>
                <DataTypeIcon type={t} />
                <code style={{ color: "var(--schema-color-muted)" }}>{t}</code>
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};
