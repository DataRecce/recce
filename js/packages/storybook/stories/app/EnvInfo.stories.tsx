import { EnvInfo } from "@datarecce/ui/components";
import { LineageGraphProvider } from "@datarecce/ui/contexts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, within } from "storybook/test";
import {
  createEnvInfo,
  createLineageGraph,
  createSqlMeshEnvInfo,
} from "./fixtures";

const meta: Meta<typeof EnvInfo> = {
  title: "Checks/EnvInfo",
  component: EnvInfo,
  parameters: {
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
};

export default meta;
type Story = StoryObj<typeof EnvInfo>;

export const DbtDevMode: Story = {
  args: {
    envInfo: createEnvInfo(),
    reviewMode: false,
    lineageGraph: createLineageGraph(),
  },
};

export const DbtReviewMode: Story = {
  args: {
    envInfo: createEnvInfo(),
    reviewMode: true,
    lineageGraph: createLineageGraph(),
  },
};

export const SqlMeshDevMode: Story = {
  args: {
    envInfo: createSqlMeshEnvInfo(),
    reviewMode: false,
    lineageGraph: createLineageGraph(),
  },
};

export const NoEnvInfo: Story = {
  args: {
    envInfo: undefined,
    reviewMode: false,
    lineageGraph: undefined,
  },
};

export const DbtDialogOpen: Story = {
  args: {
    envInfo: createEnvInfo(),
    reviewMode: false,
    lineageGraph: createLineageGraph(),
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const infoButton = canvas.getByRole("button", {
      name: /Environment Info/i,
    });
    await userEvent.click(infoButton);
    expect(screen.getByText("Environment Information")).toBeInTheDocument();
    expect(screen.getByText("DBT")).toBeInTheDocument();
    expect(screen.getByText("base")).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
  },
};

export const DialogCloseTest: Story = {
  args: {
    envInfo: createEnvInfo(),
    reviewMode: false,
    lineageGraph: createLineageGraph(),
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const infoButton = canvas.getByRole("button", {
      name: /Environment Info/i,
    });
    await userEvent.click(infoButton);
    expect(screen.getByText("Environment Information")).toBeInTheDocument();
    const closeButton = screen.getByRole("button", { name: /^Close$/i });
    await userEvent.click(closeButton);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(
      screen.queryByText("Environment Information"),
    ).not.toBeInTheDocument();
  },
};

export const ReviewModeWithPrLink: Story = {
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
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const infoButton = canvas.getByRole("button", {
      name: /Environment Info/i,
    });
    await userEvent.click(infoButton);
    expect(screen.getByText("Review Information")).toBeInTheDocument();
    const prLink = screen.getByRole("link");
    expect(prLink).toHaveAttribute(
      "href",
      "https://github.com/myorg/myrepo/pull/456",
    );
    expect(prLink).toHaveAttribute("target", "_blank");
  },
};
