import { HSplit, VSplit } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

const meta: Meta<typeof HSplit> = {
  title: "Primitives/Split",
  component: HSplit,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    sizes: {
      description: "Initial sizes of each pane (percentages that sum to 100)",
      control: "object",
    },
    minSize: {
      description: "Minimum size of panes in pixels",
      control: "number",
    },
    gutterSize: {
      description: "Width/height of the gutter (drag handle) in pixels",
      control: "number",
    },
    onDrag: {
      description: "Callback during drag with new sizes",
      action: "dragged",
    },
    onDragEnd: {
      description: "Callback when drag ends with final sizes",
      action: "dragEnded",
    },
  },
};

export default meta;
type Story = StoryObj<typeof HSplit>;

const LeftPanel = () => (
  <div
    style={{
      height: "100%",
      padding: "20px",
      backgroundColor: "#f0f9ff",
      borderRight: "1px solid #e0e7ff",
    }}
  >
    <h3 style={{ margin: "0 0 16px 0" }}>Left Panel</h3>
    <p style={{ fontSize: "14px", color: "#666" }}>
      Drag the divider to resize.
    </p>
  </div>
);

const RightPanel = () => (
  <div
    style={{
      height: "100%",
      padding: "20px",
      backgroundColor: "#fef3c7",
    }}
  >
    <h3 style={{ margin: "0 0 16px 0" }}>Right Panel</h3>
  </div>
);

export const HorizontalSplit: Story = {
  args: {
    sizes: [50, 50],
    gutterSize: 5,
    style: { height: "400px" },
    onDrag: fn(),
    onDragEnd: fn(),
  },
  render: (args) => (
    <HSplit {...args}>
      <LeftPanel />
      <RightPanel />
    </HSplit>
  ),
};

export const VerticalSplit: Story = {
  args: {
    sizes: [50, 50],
    gutterSize: 5,
    style: { height: "400px" },
  },
  render: (args) => (
    <VSplit {...args}>
      <div
        style={{
          height: "100%",
          padding: "20px",
          backgroundColor: "#f0f9ff",
          borderBottom: "1px solid #e0e7ff",
        }}
      >
        <h3 style={{ margin: "0 0 16px 0" }}>Top Panel</h3>
      </div>
      <div
        style={{
          height: "100%",
          padding: "20px",
          backgroundColor: "#fef3c7",
        }}
      >
        <h3 style={{ margin: "0 0 16px 0" }}>Bottom Panel</h3>
      </div>
    </VSplit>
  ),
};

export const ThreePanels: Story = {
  args: {
    sizes: [25, 50, 25],
    gutterSize: 5,
    style: { height: "400px" },
  },
  render: (args) => (
    <HSplit {...args}>
      <div
        style={{ height: "100%", padding: "20px", backgroundColor: "#f0f9ff" }}
      >
        <h3>Panel 1</h3>
      </div>
      <div
        style={{ height: "100%", padding: "20px", backgroundColor: "#fef3c7" }}
      >
        <h3>Panel 2</h3>
      </div>
      <div
        style={{ height: "100%", padding: "20px", backgroundColor: "#fce7f3" }}
      >
        <h3>Panel 3</h3>
      </div>
    </HSplit>
  ),
};

export const DiffView: Story = {
  args: {
    sizes: [50, 50],
    minSize: 300,
    gutterSize: 5,
    style: { height: "400px" },
  },
  render: (args) => (
    <HSplit {...args}>
      <div
        style={{ height: "100%", padding: "16px", backgroundColor: "#fef2f2" }}
      >
        <div
          style={{
            fontWeight: "bold",
            marginBottom: "12px",
            color: "#991b1b",
          }}
        >
          Base
        </div>
        <pre
          style={{
            fontSize: "13px",
            fontFamily: "monospace",
            margin: 0,
            color: "#666",
          }}
        >
          {`SELECT
  customer_id,
  name,
  email
FROM customers
WHERE active = true`}
        </pre>
      </div>
      <div
        style={{ height: "100%", padding: "16px", backgroundColor: "#f0fdf4" }}
      >
        <div
          style={{
            fontWeight: "bold",
            marginBottom: "12px",
            color: "#166534",
          }}
        >
          Current
        </div>
        <pre
          style={{
            fontSize: "13px",
            fontFamily: "monospace",
            margin: 0,
            color: "#666",
          }}
        >
          {`SELECT
  customer_id,
  name,
  email,
  phone
FROM customers
WHERE active = true
AND created_at >= '2024-01-01'`}
        </pre>
      </div>
    </HSplit>
  ),
};
