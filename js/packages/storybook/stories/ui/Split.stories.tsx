import { HSplit, VSplit } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

const meta: Meta<typeof HSplit> = {
  title: "UI/Split",
  component: HSplit,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Resizable split pane components for creating flexible layouts. HSplit creates left-right splits, VSplit creates top-bottom splits. Wraps react-split with a consistent API.",
      },
    },
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
    maxSize: {
      description: "Maximum size of panes in pixels",
      control: "number",
    },
    gutterSize: {
      description: "Width/height of the gutter (drag handle) in pixels",
      control: "number",
    },
    snapOffset: {
      description: "Snap to minimum size when within this many pixels",
      control: "number",
    },
    dragInterval: {
      description: "Number of pixels to snap to during drag",
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
    className: {
      description: "Optional CSS class name",
      control: "text",
    },
    style: {
      description: "Optional inline styles",
      control: "object",
    },
  },
};

export default meta;
type Story = StoryObj<typeof HSplit>;

// Sample content for demonstrations
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
      This is the left panel. Drag the divider to resize.
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
    <p style={{ fontSize: "14px", color: "#666" }}>
      This is the right panel. Try resizing!
    </p>
  </div>
);

const TopPanel = () => (
  <div
    style={{
      height: "100%",
      padding: "20px",
      backgroundColor: "#f0f9ff",
      borderBottom: "1px solid #e0e7ff",
    }}
  >
    <h3 style={{ margin: "0 0 16px 0" }}>Top Panel</h3>
    <p style={{ fontSize: "14px", color: "#666" }}>
      This is the top panel. Drag the divider to resize.
    </p>
  </div>
);

const BottomPanel = () => (
  <div
    style={{
      height: "100%",
      padding: "20px",
      backgroundColor: "#fef3c7",
    }}
  >
    <h3 style={{ margin: "0 0 16px 0" }}>Bottom Panel</h3>
    <p style={{ fontSize: "14px", color: "#666" }}>
      This is the bottom panel. Try resizing!
    </p>
  </div>
);

// ============================================
// Horizontal Split (HSplit)
// ============================================

export const HorizontalSplit: Story = {
  name: "Horizontal Split (Default)",
  parameters: {
    docs: {
      description: {
        story:
          "Basic horizontal split with 50/50 sizing. Drag the vertical divider to resize panes.",
      },
    },
  },
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

export const Horizontal30_70: Story = {
  name: "Horizontal 30/70 Split",
  args: {
    sizes: [30, 70],
    gutterSize: 5,
    style: { height: "400px" },
  },
  render: (args) => (
    <HSplit {...args}>
      <LeftPanel />
      <RightPanel />
    </HSplit>
  ),
};

export const HorizontalWithMinSize: Story = {
  name: "Horizontal with Min Size",
  parameters: {
    docs: {
      description: {
        story:
          "Each pane has a minimum size of 150px. Try resizing to see the constraint.",
      },
    },
  },
  args: {
    sizes: [50, 50],
    minSize: 150,
    gutterSize: 5,
    style: { height: "400px" },
  },
  render: (args) => (
    <HSplit {...args}>
      <LeftPanel />
      <RightPanel />
    </HSplit>
  ),
};

export const HorizontalThreePanel: Story = {
  name: "Horizontal Three Panels",
  parameters: {
    docs: {
      description: {
        story:
          "Split with three panels. Each divider can be dragged independently.",
      },
    },
  },
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

// ============================================
// Vertical Split (VSplit)
// ============================================

export const VerticalSplit: Story = {
  name: "Vertical Split (Default)",
  parameters: {
    docs: {
      description: {
        story:
          "Basic vertical split with 50/50 sizing. Drag the horizontal divider to resize panes.",
      },
    },
  },
  args: {
    sizes: [50, 50],
    gutterSize: 5,
    style: { height: "400px" },
  },
  render: (args) => (
    <VSplit {...args}>
      <TopPanel />
      <BottomPanel />
    </VSplit>
  ),
};

export const Vertical40_60: Story = {
  name: "Vertical 40/60 Split",
  args: {
    sizes: [40, 60],
    gutterSize: 5,
    style: { height: "400px" },
  },
  render: (args) => (
    <VSplit {...args}>
      <TopPanel />
      <BottomPanel />
    </VSplit>
  ),
};

export const VerticalWithMinSize: Story = {
  name: "Vertical with Min Size",
  args: {
    sizes: [50, 50],
    minSize: 100,
    gutterSize: 5,
    style: { height: "400px" },
  },
  render: (args) => (
    <VSplit {...args}>
      <TopPanel />
      <BottomPanel />
    </VSplit>
  ),
};

// ============================================
// Gutter Variants
// ============================================

export const ThinGutter: Story = {
  name: "Thin Gutter (2px)",
  args: {
    sizes: [50, 50],
    gutterSize: 2,
    style: { height: "400px" },
  },
  render: (args) => (
    <HSplit {...args}>
      <LeftPanel />
      <RightPanel />
    </HSplit>
  ),
};

export const ThickGutter: Story = {
  name: "Thick Gutter (10px)",
  args: {
    sizes: [50, 50],
    gutterSize: 10,
    style: { height: "400px" },
  },
  render: (args) => (
    <HSplit {...args}>
      <LeftPanel />
      <RightPanel />
    </HSplit>
  ),
};

// ============================================
// Real-World Examples
// ============================================

export const SidebarLayout: Story = {
  name: "Sidebar Layout Example",
  parameters: {
    docs: {
      description: {
        story: "Typical sidebar + main content layout with 20/80 split.",
      },
    },
  },
  args: {
    sizes: [20, 80],
    minSize: 200,
    gutterSize: 5,
    style: { height: "500px" },
  },
  render: (args) => (
    <HSplit {...args}>
      <div
        style={{
          height: "100%",
          padding: "20px",
          backgroundColor: "#1e293b",
          color: "white",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Navigation</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          <li style={{ padding: "8px 0" }}>Dashboard</li>
          <li style={{ padding: "8px 0" }}>Checks</li>
          <li style={{ padding: "8px 0" }}>Lineage</li>
          <li style={{ padding: "8px 0" }}>Settings</li>
        </ul>
      </div>
      <div
        style={{ height: "100%", padding: "24px", backgroundColor: "#ffffff" }}
      >
        <h1 style={{ marginTop: 0 }}>Main Content</h1>
        <p style={{ color: "#666" }}>This is the main content area.</p>
      </div>
    </HSplit>
  ),
};

export const DiffView: Story = {
  name: "Diff View Example",
  parameters: {
    docs: {
      description: {
        story: "Side-by-side diff comparison layout with 50/50 split.",
      },
    },
  },
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
