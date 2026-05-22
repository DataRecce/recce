import { ScreenshotBox } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";

const meta: Meta<typeof ScreenshotBox> = {
  title: "Primitives/ScreenshotBox",
  component: ScreenshotBox,
  parameters: {
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

export const Default: Story = {
  args: {
    backgroundColor: "white",
    children: (
      <div style={{ padding: "20px", width: "320px" }}>
        <h3 style={{ margin: "0 0 8px 0" }}>Screenshot Content</h3>
        <p style={{ margin: 0, color: "#666" }}>
          Adjust the controls to change the box; the contents are arbitrary.
        </p>
      </div>
    ),
  },
};

export const WithCaptureButton: Story = {
  render: function CaptureExample() {
    const screenshotRef = useRef<HTMLDivElement>(null);

    const handleCapture = () => {
      if (screenshotRef.current) {
        alert(
          "Screenshot would be captured here.\n\nIn a real implementation, use snapdom:\n\nimport { snapdom } from '@zumer/snapdom';\nconst canvas = await snapdom.toCanvas(ref.current);",
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
