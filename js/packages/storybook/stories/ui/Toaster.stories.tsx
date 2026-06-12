import { Toaster, toaster } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Toaster> = {
  title: "Primitives/Toaster",
  component: Toaster,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof Toaster>;

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 500,
};

export const AllTypes: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <button
        onClick={() =>
          toaster.success({
            title: "Success!",
            description: "Your changes have been saved successfully.",
          })
        }
        style={{ ...buttonStyle, backgroundColor: "#10b981" }}
      >
        Success
      </button>
      <button
        onClick={() =>
          toaster.error({
            title: "Error",
            description: "Failed to save changes. Please try again.",
          })
        }
        style={{ ...buttonStyle, backgroundColor: "#ef4444" }}
      >
        Error
      </button>
      <button
        onClick={() =>
          toaster.warning({
            title: "Warning",
            description:
              "This action cannot be undone. Please proceed with caution.",
          })
        }
        style={{ ...buttonStyle, backgroundColor: "#f59e0b" }}
      >
        Warning
      </button>
      <button
        onClick={() =>
          toaster.info({
            title: "Information",
            description: "Your session will expire in 5 minutes.",
          })
        }
        style={{ ...buttonStyle, backgroundColor: "#3b82f6" }}
      >
        Info
      </button>
      <button
        onClick={() => {
          const id = toaster.loading({
            title: "Processing...",
            description: "Please wait while we process your request.",
          });
          setTimeout(() => {
            toaster.update(id, {
              type: "success",
              title: "Complete!",
              description: "Processing finished successfully.",
            });
          }, 3000);
        }}
        style={{ ...buttonStyle, backgroundColor: "#6b7280" }}
      >
        Loading (auto-completes in 3s)
      </button>
      <Toaster />
    </div>
  ),
};

export const MultipleToasts: Story = {
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.info({ title: "First toast", description: "Appeared first" });
          setTimeout(() => {
            toaster.success({
              title: "Second toast",
              description: "Appeared second",
            });
          }, 500);
          setTimeout(() => {
            toaster.warning({
              title: "Third toast",
              description: "Appeared third",
            });
          }, 1000);
        }}
        style={{ ...buttonStyle, backgroundColor: "#3b82f6" }}
      >
        Fire 3 stacked toasts
      </button>
      <Toaster />
    </div>
  ),
};

export const SaveProgress: Story = {
  render: () => (
    <div>
      <button
        onClick={() => {
          const id = toaster.loading({
            title: "Saving...",
            description: "Saving your changes to the database.",
          });
          setTimeout(() => {
            toaster.update(id, {
              type: "success",
              title: "Saved!",
              description: "All changes have been saved successfully.",
            });
          }, 2000);
        }}
        style={{ ...buttonStyle, backgroundColor: "#10b981" }}
      >
        Save Changes (loading → success via toaster.update)
      </button>
      <Toaster />
    </div>
  ),
};
