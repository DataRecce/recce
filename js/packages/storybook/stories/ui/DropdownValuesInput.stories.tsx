import { DropdownValuesInput } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

const meta: Meta<typeof DropdownValuesInput> = {
  title: "Primitives/DropdownValuesInput",
  component: DropdownValuesInput,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    unitName: {
      description:
        "Unit name for pluralization in 'X {unitName}s selected' display",
      control: "text",
    },
    suggestionList: {
      description: "List of suggested values to show in dropdown",
      control: "object",
    },
    defaultValues: {
      description: "Initial selected values",
      control: "object",
    },
    onValuesChange: {
      description: "Callback when selected values change",
      action: "valuesChanged",
    },
    size: {
      description: "Size variant for the input",
      control: "select",
      options: ["2xs", "xs", "sm", "md", "lg"],
    },
    width: {
      description: "Width of the input (CSS value or number in pixels)",
      control: "text",
    },
    placeholder: {
      description: "Placeholder text when no values are selected",
      control: "text",
    },
    disabled: {
      description: "Whether the input is disabled",
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof DropdownValuesInput>;

export const Default: Story = {
  args: {
    unitName: "column",
    suggestionList: ["id", "name", "email", "created_at", "updated_at"],
    defaultValues: ["id"],
    placeholder: "Select columns",
    width: 280,
    onValuesChange: fn(),
  },
};

export const Interactive: Story = {
  render: function InteractiveDropdown() {
    const [values, setValues] = useState<string[]>(["id"]);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <DropdownValuesInput
          unitName="column"
          suggestionList={[
            "id",
            "name",
            "email",
            "phone",
            "address",
            "city",
            "state",
            "zip",
            "country",
            "created_at",
            "updated_at",
          ]}
          defaultValues={values}
          onValuesChange={setValues}
          placeholder="Select columns"
          width={300}
        />
        <div style={{ fontSize: "12px", color: "#666" }}>
          Selected:{" "}
          <strong>{values.length > 0 ? values.join(", ") : "None"}</strong>
        </div>
      </div>
    );
  },
};

export const ManySelections: Story = {
  args: {
    unitName: "column",
    suggestionList: ["col1", "col2", "col3", "col4", "col5", "col6"],
    defaultValues: ["col1", "col2", "col3", "col4"],
    width: 240,
    onValuesChange: fn(),
  },
};
