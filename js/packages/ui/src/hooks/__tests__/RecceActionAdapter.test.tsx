import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../../lib/fetchClient";

const { mockGetModelInfo, mockPush, mockSearchRuns, mockSubmitRun } =
  vi.hoisted(() => ({
    mockGetModelInfo: vi.fn(),
    mockPush: vi.fn(),
    mockSearchRuns: vi.fn(),
    mockSubmitRun: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/lineage",
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    getModelInfo: (...args: unknown[]) => mockGetModelInfo(...args),
    searchRuns: (...args: unknown[]) => mockSearchRuns(...args),
    submitRun: (...args: unknown[]) => mockSubmitRun(...args),
  };
});

import { Toaster } from "../../components/ui/Toaster";
import {
  LineageGraphProvider,
  RouteConfigProvider,
  useRecceActionContext,
} from "../../contexts";
import { ApiProvider } from "../../providers";
import { RecceActionAdapter } from "../RecceActionAdapter";

const apiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
} as unknown as ApiClient;

const modelInfo = {
  model: {
    base: {
      columns: {
        amount: { name: "amount", type: "DECIMAL(12, 2)" },
        quantity: { name: "quantity", type: "INTEGER" },
      },
    },
    current: {
      columns: {
        amount: { name: "amount", type: "DECIMAL(12, 2)" },
        quantity: { name: "quantity", type: "INTEGER" },
      },
    },
  },
};

function ModelHistogramLauncher() {
  const { runAction, runId } = useRecceActionContext();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          runAction(
            "histogram_diff",
            { model: "orders", column_name: "", column_type: "" },
            {
              showForm: true,
              submitOnSelection: true,
              trackProps: { source: "lineage_model_node" },
            },
          )
        }
      >
        Launch model histogram
      </button>
      {runId && <output>{runId}</output>}
    </>
  );
}

function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider config={{ client: apiClient }}>
        <RouteConfigProvider>
          <LineageGraphProvider
            lineageGraph={
              {
                nodes: [
                  {
                    id: "model.test.orders",
                    data: { name: "orders", resourceType: "model" },
                  },
                ],
                edges: [],
              } as never
            }
          >
            {children}
          </LineageGraphProvider>
        </RouteConfigProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function renderLauncher() {
  return render(
    <TestProviders>
      <RecceActionAdapter>
        <ModelHistogramLauncher />
        <Toaster />
      </RecceActionAdapter>
    </TestProviders>,
  );
}

describe("RecceActionAdapter model histogram selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModelInfo.mockResolvedValue(modelInfo);
    mockSearchRuns.mockResolvedValue([]);
    mockSubmitRun.mockResolvedValue({ run_id: "run-123" });
  });

  it("submits once, opens the result, and preserves model launcher telemetry", async () => {
    const user = userEvent.setup();
    renderLauncher();

    await user.click(screen.getByRole("button", { name: /launch model/i }));
    await user.selectOptions(await screen.findByRole("combobox"), "amount");

    await waitFor(() => expect(mockSubmitRun).toHaveBeenCalledTimes(1));
    expect(mockSubmitRun).toHaveBeenCalledWith(
      "histogram_diff",
      {
        model: "orders",
        column_name: "amount",
        column_type: "DECIMAL(12, 2)",
      },
      {
        nowait: true,
        trackProps: { source: "lineage_model_node" },
      },
      apiClient,
    );
    expect(await screen.findByText("run-123")).toBeInTheDocument();
  });

  it("keeps the submission failure toast visible", async () => {
    const user = userEvent.setup();
    mockSubmitRun.mockRejectedValue(new Error("warehouse unavailable"));
    renderLauncher();

    await user.click(screen.getByRole("button", { name: /launch model/i }));
    await user.selectOptions(await screen.findByRole("combobox"), "amount");

    expect(
      await screen.findByText("Failed to submit a run"),
    ).toBeInTheDocument();
    expect(screen.getByText("warehouse unavailable")).toBeInTheDocument();
    expect(mockSubmitRun).toHaveBeenCalledTimes(1);
  });
});
