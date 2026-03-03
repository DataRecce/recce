import { EnvInfo } from "@datarecce/ui/components";
import { LineageGraphProvider } from "@datarecce/ui/contexts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, within } from "storybook/test";
import {
  createEnvInfo,
  createLineageGraph,
  createMinimalEnvInfo,
  createSqlMeshEnvInfo,
} from "./fixtures";

/**
 * EnvInfo displays environment information including git, DBT/SQLMesh metadata,
 * and schema information. It shows a summary in the toolbar and opens a detailed
 * dialog when clicked.
 */
const meta: Meta<typeof EnvInfo> = {
  title: "App/EnvInfo",
  component: EnvInfo,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Displays environment metadata including git info, PR details, and adapter-specific information (DBT or SQLMesh). Shows schemas and timestamps in a compact view with a detailed dialog.",
      },
    },
    layout: "centered",
  },
  decorators: [
    (Story, context) => {
      const { envInfo, reviewMode, lineageGraph } = context.args as {
        envInfo?: ReturnType<typeof createEnvInfo>;
        reviewMode?: boolean;
        lineageGraph?: ReturnType<typeof createLineageGraph>;
      };
      return (
        <LineageGraphProvider
          envInfo={envInfo}
          reviewMode={reviewMode}
          lineageGraph={lineageGraph}
        >
          <Story />
        </LineageGraphProvider>
      );
    },
  ],
  argTypes: {
    // These are passed through the decorator, not directly to the component
  },
};

export default meta;
type Story = StoryObj<typeof EnvInfo>;

// ============================================
// DBT Mode Stories
// ============================================

export const DbtDevMode: Story = {
  name: "DBT - Dev Mode",
  args: {
    envInfo: createEnvInfo(),
    reviewMode: false,
    lineageGraph: createLineageGraph(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default view in development mode with DBT environment info. Shows git branch, schemas, and timestamps.",
      },
    },
  },
};

export const DbtReviewMode: Story = {
  name: "DBT - Review Mode",
  args: {
    envInfo: createEnvInfo(),
    reviewMode: true,
    lineageGraph: createLineageGraph(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Review mode displays PR information including title and URL link in addition to git info.",
      },
    },
  },
};

export const DbtDialogOpen: Story = {
  name: "DBT - Dialog Open",
  args: {
    envInfo: createEnvInfo(),
    reviewMode: false,
    lineageGraph: createLineageGraph(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows the detailed environment information dialog with DBT-specific table.",
      },
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);

    // Click the info button to open dialog
    const infoButton = canvas.getByRole("button", {
      name: /Environment Info/i,
    });
    await userEvent.click(infoButton);

    // Verify dialog content (use screen for portal-rendered dialog)
    expect(screen.getByText("Environment Information")).toBeInTheDocument();
    expect(screen.getByText("DBT")).toBeInTheDocument();
    expect(screen.getByText("base")).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
  },
};

// ============================================
// SQLMesh Mode Stories
// ============================================

export const SqlMeshDevMode: Story = {
  name: "SQLMesh - Dev Mode",
  args: {
    envInfo: createSqlMeshEnvInfo(),
    reviewMode: false,
    lineageGraph: createLineageGraph(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "SQLMesh adapter type shows environment names instead of DBT versions.",
      },
    },
  },
};

export const SqlMeshDialogOpen: Story = {
  name: "SQLMesh - Dialog Open",
  args: {
    envInfo: createSqlMeshEnvInfo(),
    reviewMode: false,
    lineageGraph: createLineageGraph(),
  },
  parameters: {
    docs: {
      description: {
        story: "SQLMesh dialog shows base and current environment names.",
      },
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);

    // Click the info button to open dialog
    const infoButton = canvas.getByRole("button", {
      name: /Environment Info/i,
    });
    await userEvent.click(infoButton);

    // Verify SQLMesh content (use screen for portal-rendered dialog)
    expect(screen.getByText("SQLMesh")).toBeInTheDocument();
    expect(screen.getByText("prod")).toBeInTheDocument();
    expect(screen.getByText("dev")).toBeInTheDocument();
  },
};

// ============================================
// Edge Cases
// ============================================

export const MinimalInfo: Story = {
  name: "Minimal Info",
  args: {
    envInfo: createMinimalEnvInfo(),
    reviewMode: false,
    lineageGraph: {
      nodes: {},
      edges: {},
      modifiedSet: [],
      manifestMetadata: {},
      catalogMetadata: {},
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows component with minimal environment info (no DBT/SQLMesh metadata).",
      },
    },
  },
};

export const NoEnvInfo: Story = {
  name: "No Environment Info",
  args: {
    envInfo: undefined,
    reviewMode: false,
    lineageGraph: undefined,
  },
  parameters: {
    docs: {
      description: {
        story: "Graceful handling when no environment info is available.",
      },
    },
  },
};

export const MultipleSchemas: Story = {
  name: "Multiple Schemas",
  args: {
    envInfo: createEnvInfo(),
    reviewMode: false,
    lineageGraph: {
      ...createLineageGraph(),
      nodes: {
        node1: {
          id: "node1",
          type: "lineageGraphNode",
          position: { x: 0, y: 0 },
          data: {
            id: "node1",
            name: "node1",
            from: "both",
            data: {
              base: {
                id: "node1",
                unique_id: "node1",
                name: "node1",
                schema: "raw",
              },
              current: {
                id: "node1",
                unique_id: "node1",
                name: "node1",
                schema: "raw",
              },
            },
            resourceType: "model",
            packageName: "test",
            parents: {},
            children: {},
          },
        },
        node2: {
          id: "node2",
          type: "lineageGraphNode",
          position: { x: 0, y: 0 },
          data: {
            id: "node2",
            name: "node2",
            from: "both",
            data: {
              base: {
                id: "node2",
                unique_id: "node2",
                name: "node2",
                schema: "staging",
              },
              current: {
                id: "node2",
                unique_id: "node2",
                name: "node2",
                schema: "staging",
              },
            },
            resourceType: "model",
            packageName: "test",
            parents: {},
            children: {},
          },
        },
        node3: {
          id: "node3",
          type: "lineageGraphNode",
          position: { x: 0, y: 0 },
          data: {
            id: "node3",
            name: "node3",
            from: "both",
            data: {
              base: {
                id: "node3",
                unique_id: "node3",
                name: "node3",
                schema: "analytics",
              },
              current: {
                id: "node3",
                unique_id: "node3",
                name: "node3",
                schema: "analytics",
              },
            },
            resourceType: "model",
            packageName: "test",
            parents: {},
            children: {},
          },
        },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Shows handling of multiple schemas (raw, staging, analytics).",
      },
    },
  },
};

// ============================================
// Interactive Tests
// ============================================

export const DialogCloseTest: Story = {
  name: "Dialog Close Test",
  args: {
    envInfo: createEnvInfo(),
    reviewMode: false,
    lineageGraph: createLineageGraph(),
  },
  parameters: {
    docs: {
      description: {
        story: "Tests that the dialog can be opened and closed properly.",
      },
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);

    // Open dialog
    const infoButton = canvas.getByRole("button", {
      name: /Environment Info/i,
    });
    await userEvent.click(infoButton);

    // Verify dialog is open (use screen for portal-rendered dialog)
    expect(screen.getByText("Environment Information")).toBeInTheDocument();

    // Close via Close button in actions
    const closeButton = screen.getByRole("button", { name: /^Close$/i });
    await userEvent.click(closeButton);

    // Wait for dialog to close (MUI transition)
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Dialog should be closed
    expect(
      screen.queryByText("Environment Information"),
    ).not.toBeInTheDocument();
  },
};

export const ReviewModeWithPrLink: Story = {
  name: "Review Mode - PR Link",
  args: {
    envInfo: createEnvInfo({
      pullRequest: {
        id: "456",
        title: "Fix data quality issue in orders model",
        url: "https://github.com/myorg/myrepo/pull/456",
      },
    }),
    reviewMode: true,
    lineageGraph: createLineageGraph(),
  },
  parameters: {
    docs: {
      description: {
        story: "Review mode shows PR link that opens in new tab.",
      },
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);

    // Open dialog
    const infoButton = canvas.getByRole("button", {
      name: /Environment Info/i,
    });
    await userEvent.click(infoButton);

    // Verify Review Information is shown (use screen for portal-rendered dialog)
    expect(screen.getByText("Review Information")).toBeInTheDocument();

    // Verify PR link exists and has correct attributes
    const prLink = screen.getByRole("link");
    expect(prLink).toHaveAttribute(
      "href",
      "https://github.com/myorg/myrepo/pull/456",
    );
    expect(prLink).toHaveAttribute("target", "_blank");
  },
};
