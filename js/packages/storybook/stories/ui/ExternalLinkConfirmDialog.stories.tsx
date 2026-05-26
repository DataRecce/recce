import { ExternalLinkConfirmDialog } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent } from "storybook/test";

const meta: Meta<typeof ExternalLinkConfirmDialog> = {
  title: "Primitives/ExternalLinkConfirmDialog",
  component: ExternalLinkConfirmDialog,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    isOpen: {
      description: "Whether the dialog is open",
      control: "boolean",
    },
    url: {
      description: "The external URL the user is trying to navigate to",
      control: "text",
    },
    onConfirm: {
      description: "Callback when user confirms navigation",
      action: "confirmed",
    },
    onCancel: {
      description: "Callback when user cancels navigation",
      action: "cancelled",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ExternalLinkConfirmDialog>;

export const Default: Story = {
  args: {
    isOpen: true,
    url: "https://docs.example.com/guides/advanced/data-validation",
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export const InteractiveDemo: Story = {
  render: function InteractiveExample() {
    const [isOpen, setIsOpen] = useState(false);
    const pendingUrl = "https://github.com/DataRecce/recce";

    return (
      <div style={{ padding: "20px" }}>
        <p style={{ marginBottom: "16px" }}>
          Click the link below to trigger the confirmation dialog:
        </p>
        <a
          href={pendingUrl}
          onClick={(e) => {
            e.preventDefault();
            setIsOpen(true);
          }}
          style={{
            color: "#3b82f6",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Visit DataRecce on GitHub ↗
        </a>
        <ExternalLinkConfirmDialog
          isOpen={isOpen}
          url={pendingUrl}
          onConfirm={() => {
            alert(`Would navigate to: ${pendingUrl}`);
            setIsOpen(false);
          }}
          onCancel={() => setIsOpen(false)}
        />
      </div>
    );
  },
};

export const ConfirmNavigation: Story = {
  args: {
    isOpen: true,
    url: "https://example.com",
    onConfirm: fn(),
    onCancel: fn(),
  },
  play: async ({ args }) => {
    const confirmButton = screen.getByRole("button", { name: /continue/i });
    await userEvent.click(confirmButton);
    expect(args.onConfirm).toHaveBeenCalled();
  },
};

export const CancelNavigation: Story = {
  args: {
    isOpen: true,
    url: "https://example.com",
    onConfirm: fn(),
    onCancel: fn(),
  },
  play: async ({ args }) => {
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelButton);
    expect(args.onCancel).toHaveBeenCalled();
  },
};

export const CloseWithX: Story = {
  args: {
    isOpen: true,
    url: "https://example.com",
    onConfirm: fn(),
    onCancel: fn(),
  },
  play: async ({ args }) => {
    const closeButton = screen.getByLabelText(/close/i);
    await userEvent.click(closeButton);
    expect(args.onCancel).toHaveBeenCalled();
  },
};
