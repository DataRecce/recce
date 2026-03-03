import { ScreenshotBox } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";

const meta: Meta<typeof ScreenshotBox> = {
  title: "UI/ScreenshotBox",
  component: ScreenshotBox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A container component that can be captured as a screenshot. Forwards its ref to allow parent components to capture the element using html-to-image or similar libraries. Commonly used to wrap charts, tables, or other visualizations that need to be exported as images.",
      },
    },
    layout: "centered",
  },
  argTypes: {
    backgroundColor: {
      description: "Background color for the screenshot area (default: white)",
      control: "color",
    },
    blockSize: {
      description: "Block size (height in block direction)",
      control: "text",
    },
    children: {
      description: "Content to render inside the screenshot area",
      control: false,
    },
  },
};

export default meta;
type Story = StoryObj<typeof ScreenshotBox>;

// ============================================
// Basic Examples
// ============================================

export const Default: Story = {
  name: "Default",
  args: {
    children: (
      <div style={{ padding: "20px" }}>
        <h3>Screenshot Content</h3>
        <p>This content can be captured as an image.</p>
      </div>
    ),
  },
};

export const WithChart: Story = {
  name: "With Chart Content",
  parameters: {
    docs: {
      description: {
        story:
          "Example showing how ScreenshotBox is typically used to wrap chart or visualization content.",
      },
    },
  },
  args: {
    backgroundColor: "white",
    children: (
      <div style={{ padding: "24px", width: "500px" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "18px" }}>
          Data Quality Metrics
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
          }}
        >
          {[
            { label: "Row Count", value: "1,234", color: "#10b981" },
            { label: "Null Values", value: "0", color: "#3b82f6" },
            { label: "Duplicates", value: "5", color: "#f59e0b" },
          ].map((metric) => (
            <div
              key={metric.label}
              style={{
                padding: "16px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: metric.color,
                  marginBottom: "8px",
                }}
              >
                {metric.value}
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
};

export const WithTable: Story = {
  name: "With Table Content",
  args: {
    children: (
      <div style={{ padding: "16px" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              <th style={{ padding: "8px", textAlign: "left" }}>Check</th>
              <th style={{ padding: "8px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "8px", textAlign: "right" }}>Count</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "8px" }}>Schema Validation</td>
              <td style={{ padding: "8px" }}>✅ Pass</td>
              <td style={{ padding: "8px", textAlign: "right" }}>15</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "8px" }}>Row Count</td>
              <td style={{ padding: "8px" }}>✅ Pass</td>
              <td style={{ padding: "8px", textAlign: "right" }}>1234</td>
            </tr>
            <tr>
              <td style={{ padding: "8px" }}>Null Check</td>
              <td style={{ padding: "8px" }}>⚠️ Warning</td>
              <td style={{ padding: "8px", textAlign: "right" }}>2</td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },
};

// ============================================
// Background Colors
// ============================================

export const WhiteBackground: Story = {
  name: "White Background",
  args: {
    backgroundColor: "white",
    children: (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h3>White Background</h3>
        <p style={{ color: "#666" }}>Default background color</p>
      </div>
    ),
  },
};

export const LightGrayBackground: Story = {
  name: "Light Gray Background",
  args: {
    backgroundColor: "#f9fafb",
    children: (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h3>Light Gray Background</h3>
        <p style={{ color: "#666" }}>Subtle background color</p>
      </div>
    ),
  },
};

export const ColoredBackground: Story = {
  name: "Colored Background",
  args: {
    backgroundColor: "#dbeafe",
    children: (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h3>Colored Background</h3>
        <p style={{ color: "#1e40af" }}>Blue background for emphasis</p>
      </div>
    ),
  },
};

// ============================================
// Size Variants
// ============================================

export const FixedHeight: Story = {
  name: "Fixed Height",
  args: {
    blockSize: "300px",
    children: (
      <div
        style={{
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <h3>Fixed Height Container</h3>
        <p>This container has a fixed height of 300px.</p>
        <div style={{ flex: 1 }} />
        <p style={{ fontSize: "12px", color: "#999" }}>Content at the bottom</p>
      </div>
    ),
  },
};

// ============================================
// Interactive Example with Ref
// ============================================

export const WithCaptureButton: Story = {
  name: "With Capture Button (Example)",
  parameters: {
    docs: {
      description: {
        story:
          "Example showing how to use the ref to capture a screenshot. The actual capture functionality requires html-to-image or similar library in a real application.",
      },
    },
  },
  render: function CaptureExample() {
    const screenshotRef = useRef<HTMLDivElement>(null);

    const handleCapture = () => {
      if (screenshotRef.current) {
        // In a real app, you would use html-to-image here:
        // import { toPng } from 'html-to-image';
        // const dataUrl = await toPng(screenshotRef.current);
        alert(
          "Screenshot would be captured here!\n\nIn a real implementation, use html-to-image:\n\nimport { toPng } from 'html-to-image';\nconst dataUrl = await toPng(ref.current);",
        );
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <ScreenshotBox ref={screenshotRef} backgroundColor="white">
          <div style={{ padding: "32px", width: "400px" }}>
            <h2 style={{ margin: "0 0 16px 0" }}>Report Title</h2>
            <p style={{ margin: "0", color: "#666" }}>
              This content will be captured when you click the button below.
            </p>
            <div
              style={{
                marginTop: "24px",
                padding: "16px",
                backgroundColor: "#f0f9ff",
                borderRadius: "8px",
              }}
            >
              <strong>Status:</strong> Ready for capture
            </div>
          </div>
        </ScreenshotBox>
        <button
          onClick={handleCapture}
          style={{
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: 500,
            color: "white",
            backgroundColor: "#3b82f6",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          📸 Capture Screenshot
        </button>
      </div>
    );
  },
};

// ============================================
// Real-World Examples
// ============================================

export const DashboardCard: Story = {
  name: "Dashboard Card Example",
  args: {
    backgroundColor: "white",
    children: (
      <div style={{ padding: "20px", width: "350px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "16px" }}>Active Checks</h3>
          <span
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#10b981",
            }}
          >
            42
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "#6b7280" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <span>✅ Passing: 38</span>
            <span>90%</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <span>⚠️ Warning: 3</span>
            <span>7%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>❌ Failing: 1</span>
            <span>3%</span>
          </div>
        </div>
      </div>
    ),
  },
};
