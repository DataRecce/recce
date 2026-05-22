import { DataTypeIcon } from "@datarecce/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";

const meta: Meta<typeof DataTypeIcon> = {
  title: "Primitives/DataTypeIcon",
  component: DataTypeIcon,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    type: {
      description: "The raw database type string (e.g. INTEGER, VARCHAR(256))",
      control: "text",
    },
    size: {
      description:
        'Icon size — "1em" (default, scales with font-size) or a number for explicit pixels',
      control: { type: "number" },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DataTypeIcon>;

export const Default: Story = {
  args: { type: "INTEGER" },
};

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
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto auto",
        gap: "12px 24px",
        alignItems: "center",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.875rem",
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
