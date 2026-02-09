import { DiffEditor } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof DiffEditor> = {
  title: "Editor/DiffEditor",
  component: DiffEditor,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A read-only diff viewer using CodeMirror's merge view. Supports SQL and YAML syntax highlighting with side-by-side or unified (inline) diff modes.",
      },
    },
    layout: "padded",
  },
  argTypes: {
    original: { description: "Base/original text content" },
    modified: { description: "Modified/current text content" },
    language: {
      description: "Syntax highlighting language",
      control: "select",
      options: ["sql", "yaml", "text"],
    },
    sideBySide: {
      description: "Side-by-side (true) or unified inline (false) view",
    },
    theme: {
      description: "Color theme",
      control: "select",
      options: ["light", "dark"],
    },
    height: { description: "Editor height (CSS value)" },
  },
};

export default meta;
type Story = StoryObj<typeof DiffEditor>;

const baseSql = `SELECT
  customer_id,
  first_name,
  last_name,
  email
FROM customers
WHERE status = 'active'`;

const modifiedSql = `SELECT
  customer_id,
  first_name,
  last_name,
  email,
  created_at
FROM customers
WHERE status = 'active'
  AND country = 'US'`;

export const SqlDiff: Story = {
  name: "SQL Diff (Default)",
  args: {
    original: baseSql,
    modified: modifiedSql,
    language: "sql",
    sideBySide: true,
    height: "300px",
  },
};

export const UnifiedView: Story = {
  name: "Unified (Inline) View",
  parameters: {
    docs: {
      description: {
        story:
          "Inline diff mode shows changes in a single column with deletions and additions clearly marked.",
      },
    },
  },
  args: {
    original: baseSql,
    modified: modifiedSql,
    language: "sql",
    sideBySide: false,
    height: "350px",
  },
};

const baseYaml = `version: 2
models:
  - name: customers
    columns:
      - name: customer_id
        tests:
          - unique`;

const modifiedYaml = `version: 2
models:
  - name: customers
    description: Customer dimension table
    columns:
      - name: customer_id
        tests:
          - unique
          - not_null`;

export const YamlDiff: Story = {
  name: "YAML Diff",
  args: {
    original: baseYaml,
    modified: modifiedYaml,
    language: "yaml",
    sideBySide: true,
    height: "280px",
  },
};
