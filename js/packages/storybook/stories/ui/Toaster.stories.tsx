import { Toaster, toaster } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Toaster> = {
  title: "UI/Toaster",
  component: Toaster,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Toast notification system using MUI Snackbar. Provides success, error, warning, info, and loading toast types. Can be used standalone with the toaster instance or via React context with ToasterProvider.",
      },
    },
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof Toaster>;

// ============================================
// Basic Toast Types
// ============================================

export const SuccessToast: Story = {
  name: "Success Toast",
  parameters: {
    docs: {
      description: {
        story: "Click the button to show a success toast notification.",
      },
    },
  },
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.success({
            title: "Success!",
            description: "Your changes have been saved successfully.",
          });
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#10b981",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Show Success Toast
      </button>
      <Toaster />
    </div>
  ),
};

export const ErrorToast: Story = {
  name: "Error Toast",
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.error({
            title: "Error",
            description: "Failed to save changes. Please try again.",
          });
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Show Error Toast
      </button>
      <Toaster />
    </div>
  ),
};

export const WarningToast: Story = {
  name: "Warning Toast",
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.warning({
            title: "Warning",
            description:
              "This action cannot be undone. Please proceed with caution.",
          });
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#f59e0b",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Show Warning Toast
      </button>
      <Toaster />
    </div>
  ),
};

export const InfoToast: Story = {
  name: "Info Toast",
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.info({
            title: "Information",
            description: "Your session will expire in 5 minutes.",
          });
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Show Info Toast
      </button>
      <Toaster />
    </div>
  ),
};

export const LoadingToast: Story = {
  name: "Loading Toast",
  parameters: {
    docs: {
      description: {
        story:
          "Loading toasts show a spinner and don't auto-dismiss. Useful for long-running operations.",
      },
    },
  },
  render: () => (
    <div>
      <button
        onClick={() => {
          const id = toaster.loading({
            title: "Processing...",
            description: "Please wait while we process your request.",
          });

          // Simulate completion after 3 seconds
          setTimeout(() => {
            toaster.update(id, {
              type: "success",
              title: "Complete!",
              description: "Processing finished successfully.",
            });
          }, 3000);
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#6b7280",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Show Loading Toast
      </button>
      <Toaster />
    </div>
  ),
};

// ============================================
// Content Variants
// ============================================

export const TitleOnly: Story = {
  name: "Title Only",
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.success({ title: "Saved!" });
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Show Title Only
      </button>
      <Toaster />
    </div>
  ),
};

export const DescriptionOnly: Story = {
  name: "Description Only",
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.success({
            description: "Your changes have been saved.",
          });
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Show Description Only
      </button>
      <Toaster />
    </div>
  ),
};

export const LongContent: Story = {
  name: "Long Content",
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.info({
            title: "Data Quality Check Complete",
            description:
              "The schema validation check has completed successfully. All 42 tables were validated against the expected schema. No discrepancies were found in column names, data types, or constraints.",
          });
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Show Long Content
      </button>
      <Toaster />
    </div>
  ),
};

// ============================================
// Duration Variants
// ============================================

export const QuickToast: Story = {
  name: "Quick Toast (2s)",
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.success({
            title: "Quick message",
            description: "This will disappear quickly.",
            duration: 2000,
          });
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Show Quick Toast
      </button>
      <Toaster />
    </div>
  ),
};

export const PersistentToast: Story = {
  name: "Persistent Toast (10s)",
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.warning({
            title: "Important Notice",
            description: "This message will stay visible for 10 seconds.",
            duration: 10000,
          });
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#f59e0b",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Show Persistent Toast
      </button>
      <Toaster />
    </div>
  ),
};

// ============================================
// Multiple Toasts
// ============================================

export const MultipleToasts: Story = {
  name: "Multiple Toasts",
  parameters: {
    docs: {
      description: {
        story:
          "Multiple toasts can be displayed simultaneously and stack vertically.",
      },
    },
  },
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.info({
            title: "First toast",
            description: "This appeared first",
          });
          setTimeout(() => {
            toaster.success({
              title: "Second toast",
              description: "This appeared second",
            });
          }, 500);
          setTimeout(() => {
            toaster.warning({
              title: "Third toast",
              description: "This appeared third",
            });
          }, 1000);
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Show Multiple Toasts
      </button>
      <Toaster />
    </div>
  ),
};

// ============================================
// Real-World Examples
// ============================================

export const CopyConfirmation: Story = {
  name: "Copy Confirmation",
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.success({
            description: "Value copied to clipboard",
            duration: 2000,
          });
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Copy to Clipboard
      </button>
      <Toaster />
    </div>
  ),
};

export const SaveProgress: Story = {
  name: "Save with Progress",
  parameters: {
    docs: {
      description: {
        story: "Demonstrates updating a toast from loading to success state.",
      },
    },
  },
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
        style={{
          padding: "8px 16px",
          backgroundColor: "#10b981",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Save Changes
      </button>
      <Toaster />
    </div>
  ),
};

export const ValidationError: Story = {
  name: "Validation Error",
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.error({
            title: "Validation Failed",
            description:
              "Please fill in all required fields before submitting.",
          });
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Submit Form
      </button>
      <Toaster />
    </div>
  ),
};

export const NetworkError: Story = {
  name: "Network Error",
  render: () => (
    <div>
      <button
        onClick={() => {
          toaster.error({
            title: "Connection Error",
            description:
              "Unable to reach the server. Please check your internet connection.",
            duration: 8000,
          });
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Trigger Network Error
      </button>
      <Toaster />
    </div>
  ),
};
