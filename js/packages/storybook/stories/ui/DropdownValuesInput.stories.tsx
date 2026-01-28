import { DropdownValuesInput } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

const meta: Meta<typeof DropdownValuesInput> = {
  title: "UI/DropdownValuesInput",
  component: DropdownValuesInput,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A multi-select dropdown input component with filtering and custom value support. Features include dropdown menu with suggestions, chip-based value display, keyboard navigation (Enter, comma, Backspace), and custom value addition.",
      },
    },
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
    className: {
      description: "Optional CSS class name",
      control: "text",
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

// ============================================
// Basic Examples
// ============================================

export const Default: Story = {
  name: "Default",
  args: {
    unitName: "item",
    suggestionList: ["Option 1", "Option 2", "Option 3", "Option 4"],
    onValuesChange: fn(),
    placeholder: "Select items",
    width: 240,
  },
};

export const WithDefaultValues: Story = {
  name: "With Default Values",
  args: {
    unitName: "column",
    suggestionList: ["id", "name", "email", "created_at", "updated_at"],
    defaultValues: ["id", "email"],
    onValuesChange: fn(),
    width: 240,
  },
};

export const WithPlaceholder: Story = {
  name: "With Placeholder",
  args: {
    unitName: "key",
    suggestionList: ["id", "user_id", "product_id", "order_id"],
    placeholder: "Select or type to add keys",
    onValuesChange: fn(),
    width: 240,
  },
};

// ============================================
// Size Variants
// ============================================

export const Size2XS: Story = {
  name: "Size 2XS",
  args: {
    unitName: "tag",
    suggestionList: ["tag1", "tag2", "tag3"],
    size: "2xs",
    width: 200,
    onValuesChange: fn(),
  },
};

export const SizeXS: Story = {
  name: "Size XS",
  args: {
    unitName: "tag",
    suggestionList: ["tag1", "tag2", "tag3"],
    size: "xs",
    width: 200,
    onValuesChange: fn(),
  },
};

export const SizeSM: Story = {
  name: "Size SM",
  args: {
    unitName: "tag",
    suggestionList: ["tag1", "tag2", "tag3"],
    size: "sm",
    width: 200,
    onValuesChange: fn(),
  },
};

export const SizeMD: Story = {
  name: "Size MD",
  args: {
    unitName: "tag",
    suggestionList: ["tag1", "tag2", "tag3"],
    size: "md",
    width: 200,
    onValuesChange: fn(),
  },
};

// ============================================
// Width Variants
// ============================================

export const NarrowWidth: Story = {
  name: "Narrow Width (180px)",
  args: {
    unitName: "item",
    suggestionList: ["Short", "Medium", "Long"],
    width: 180,
    onValuesChange: fn(),
  },
};

export const WideWidth: Story = {
  name: "Wide Width (400px)",
  args: {
    unitName: "column",
    suggestionList: [
      "customer_id",
      "order_date",
      "total_amount",
      "shipping_address",
    ],
    width: 400,
    onValuesChange: fn(),
  },
};

// ============================================
// Interactive Examples
// ============================================

export const Interactive: Story = {
  name: "Interactive",
  parameters: {
    docs: {
      description: {
        story:
          "Fully interactive example. Click to open dropdown, filter by typing, and select values. Selected values appear as chips.",
      },
    },
  },
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

// ============================================
// Real-World Examples
// ============================================

export const PrimaryKeySelector: Story = {
  name: "Primary Key Selector",
  parameters: {
    docs: {
      description: {
        story:
          "Example for selecting primary key columns in a data validation context.",
      },
    },
  },
  args: {
    unitName: "key",
    suggestionList: [
      "id",
      "user_id",
      "customer_id",
      "order_id",
      "product_id",
      "transaction_id",
    ],
    defaultValues: ["id"],
    placeholder: "Select primary keys",
    width: 280,
    size: "sm",
    onValuesChange: fn(),
  },
};

export const ColumnFilter: Story = {
  name: "Column Filter",
  parameters: {
    docs: {
      description: {
        story:
          "Example for filtering which columns to include in a comparison.",
      },
    },
  },
  args: {
    unitName: "column",
    suggestionList: [
      "customer_name",
      "email",
      "phone",
      "address",
      "city",
      "state",
      "postal_code",
      "country",
      "registration_date",
      "last_purchase_date",
      "total_spent",
      "loyalty_points",
    ],
    defaultValues: ["customer_name", "email"],
    placeholder: "Filter columns",
    width: 300,
    onValuesChange: fn(),
  },
};

export const TagSelector: Story = {
  name: "Tag Selector",
  args: {
    unitName: "tag",
    suggestionList: [
      "urgent",
      "bug",
      "feature",
      "enhancement",
      "documentation",
      "testing",
      "performance",
      "security",
    ],
    placeholder: "Add tags",
    width: 260,
    size: "sm",
    onValuesChange: fn(),
  },
};

// ============================================
// States
// ============================================

export const Disabled: Story = {
  name: "Disabled",
  args: {
    unitName: "item",
    suggestionList: ["Option 1", "Option 2", "Option 3"],
    defaultValues: ["Option 1"],
    disabled: true,
    width: 240,
    onValuesChange: fn(),
  },
};

export const EmptyState: Story = {
  name: "Empty State",
  parameters: {
    docs: {
      description: {
        story: "Shows placeholder when no values are selected.",
      },
    },
  },
  args: {
    unitName: "value",
    suggestionList: ["Value 1", "Value 2", "Value 3"],
    placeholder: "No values selected",
    width: 240,
    onValuesChange: fn(),
  },
};

export const ManySelections: Story = {
  name: "Many Selections",
  parameters: {
    docs: {
      description: {
        story:
          'When multiple values are selected, displays "X {unitName}s selected" format.',
      },
    },
  },
  args: {
    unitName: "column",
    suggestionList: ["col1", "col2", "col3", "col4", "col5", "col6"],
    defaultValues: ["col1", "col2", "col3", "col4"],
    width: 240,
    onValuesChange: fn(),
  },
};

// ============================================
// Filtering Examples
// ============================================

export const LargeList: Story = {
  name: "Large Suggestion List",
  parameters: {
    docs: {
      description: {
        story:
          "With a large list of suggestions, filtering becomes essential. Try typing to filter.",
      },
    },
  },
  args: {
    unitName: "column",
    suggestionList: [
      "customer_id",
      "customer_name",
      "customer_email",
      "customer_phone",
      "order_id",
      "order_date",
      "order_total",
      "order_status",
      "product_id",
      "product_name",
      "product_category",
      "product_price",
      "shipping_address",
      "shipping_city",
      "shipping_state",
      "shipping_zip",
      "billing_address",
      "billing_city",
      "billing_state",
      "billing_zip",
    ],
    placeholder: "Type to filter columns",
    width: 300,
    onValuesChange: fn(),
  },
};
