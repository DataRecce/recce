import { ExternalLinkConfirmDialog } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, within } from "storybook/test";

const meta: Meta<typeof ExternalLinkConfirmDialog> = {
  title: "UI/ExternalLinkConfirmDialog",
  component: ExternalLinkConfirmDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A confirmation dialog that warns users before navigating to external URLs. Shows the destination URL and provides cancel/continue options for security.",
      },
    },
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

// ============================================
// Basic Examples
// ============================================

export const Closed: Story = {
  name: "Closed (Not Visible)",
  args: {
    isOpen: false,
    url: "https://example.com",
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export const Open: Story = {
  name: "Open",
  args: {
    isOpen: true,
    url: "https://example.com/documentation",
    onConfirm: fn(),
    onCancel: fn(),
  },
};

// ============================================
// Different URL Types
// ============================================

export const ShortURL: Story = {
  name: "Short URL",
  args: {
    isOpen: true,
    url: "https://docs.getdbt.com",
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export const LongURL: Story = {
  name: "Long URL (Truncated)",
  parameters: {
    docs: {
      description: {
        story:
          "Long URLs are truncated for display while preserving the domain name.",
      },
    },
  },
  args: {
    isOpen: true,
    url: "https://docs.example.com/guides/advanced/data-validation/schema-checks/detailed-configuration",
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export const GitHubURL: Story = {
  name: "GitHub URL",
  args: {
    isOpen: true,
    url: "https://github.com/DataRecce/recce/issues/123",
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export const DocumentationURL: Story = {
  name: "Documentation URL",
  args: {
    isOpen: true,
    url: "https://docs.getdbt.com/docs/build/sources",
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export const URLWithQuery: Story = {
  name: "URL with Query Parameters",
  args: {
    isOpen: true,
    url: "https://example.com/search?q=data+validation&filter=recent",
    onConfirm: fn(),
    onCancel: fn(),
  },
};

// ============================================
// Interactive Example
// ============================================

export const InteractiveDemo: Story = {
  name: "Interactive Demo",
  parameters: {
    docs: {
      description: {
        story:
          "Click the link to see the confirmation dialog appear. You can then confirm or cancel.",
      },
    },
  },
  render: function InteractiveExample() {
    const [isOpen, setIsOpen] = useState(false);
    const [pendingUrl] = useState("https://github.com/DataRecce/recce");

    const handleLinkClick = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsOpen(true);
    };

    const handleConfirm = () => {
      alert(`Would navigate to: ${pendingUrl}`);
      setIsOpen(false);
    };

    const handleCancel = () => {
      setIsOpen(false);
    };

    return (
      <div style={{ padding: "20px" }}>
        <p style={{ marginBottom: "16px" }}>
          Click the link below to trigger the confirmation dialog:
        </p>
        <a
          href={pendingUrl}
          onClick={handleLinkClick}
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
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </div>
    );
  },
};

// ============================================
// Interactive Tests
// ============================================

export const ConfirmNavigation: Story = {
  name: "Confirm Navigation Test",
  args: {
    isOpen: true,
    url: "https://example.com",
    onConfirm: fn(),
    onCancel: fn(),
  },
  play: async ({ args }) => {
    // Dialog is rendered in a portal, use screen
    const confirmButton = screen.getByRole("button", { name: /continue/i });
    await userEvent.click(confirmButton);

    // Verify callback was called
    expect(args.onConfirm).toHaveBeenCalled();
  },
};

export const CancelNavigation: Story = {
  name: "Cancel Navigation Test",
  args: {
    isOpen: true,
    url: "https://example.com",
    onConfirm: fn(),
    onCancel: fn(),
  },
  play: async ({ args }) => {
    // Dialog is rendered in a portal, use screen
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelButton);

    // Verify callback was called
    expect(args.onCancel).toHaveBeenCalled();
  },
};

export const CloseWithX: Story = {
  name: "Close with X Button Test",
  args: {
    isOpen: true,
    url: "https://example.com",
    onConfirm: fn(),
    onCancel: fn(),
  },
  play: async ({ args }) => {
    // Find and click the close button
    const closeButton = screen.getByLabelText(/close/i);
    await userEvent.click(closeButton);

    // Verify cancel callback was called
    expect(args.onCancel).toHaveBeenCalled();
  },
};

// ============================================
// Real-World Context
// ============================================

export const InMarkdownContent: Story = {
  name: "In Markdown Content Context",
  parameters: {
    docs: {
      description: {
        story:
          "Example showing how the dialog appears when clicking external links in markdown content.",
      },
    },
  },
  render: function MarkdownExample() {
    const [isOpen, setIsOpen] = useState(false);
    const [pendingUrl, setPendingUrl] = useState("");

    const handleLinkClick = (url: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      setPendingUrl(url);
      setIsOpen(true);
    };

    return (
      <div
        style={{
          maxWidth: "600px",
          padding: "24px",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Check Description</h3>
        <p>
          This check validates data quality using industry best practices. For
          more information, see the{" "}
          <a
            href="https://docs.example.com/quality"
            onClick={handleLinkClick("https://docs.example.com/quality")}
            style={{ color: "#3b82f6", textDecoration: "underline" }}
          >
            documentation ↗
          </a>
          .
        </p>
        <p>
          Report bugs or request features on{" "}
          <a
            href="https://github.com/DataRecce/recce/issues"
            onClick={handleLinkClick(
              "https://github.com/DataRecce/recce/issues",
            )}
            style={{ color: "#3b82f6", textDecoration: "underline" }}
          >
            GitHub ↗
          </a>
          .
        </p>
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

// ============================================
// Edge Cases
// ============================================

export const VeryLongDomain: Story = {
  name: "Very Long Domain",
  args: {
    isOpen: true,
    url: "https://very-long-subdomain.extremely-long-domain-name.example.com/path",
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export const URLWithFragments: Story = {
  name: "URL with Fragment",
  args: {
    isOpen: true,
    url: "https://docs.example.com/guide#advanced-configuration",
    onConfirm: fn(),
    onCancel: fn(),
  },
};
