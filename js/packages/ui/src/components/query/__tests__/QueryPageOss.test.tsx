/**
 * @file QueryPageOss.test.tsx
 * @description Tests for QueryPageOss high-level component.
 */

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { QueryPageOss } from "../QueryPageOss";

const mockUseRecceQueryContext = vi.fn();
const mockUseLineageGraphContext = vi.fn();
const mockUseRecceInstanceContext = vi.fn();
const mockUseRecceActionContext = vi.fn();
const mockUseApiConfig = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../../api", () => ({
  submitQuery: vi.fn(),
  submitQueryBase: vi.fn(),
  submitQueryDiff: vi.fn(),
  waitRun: vi.fn(),
}));

vi.mock("../../components", () => ({
  HistoryToggle: () => <div data-testid="history-toggle" />,
}));

vi.mock("../../components/app", () => ({
  SetupConnectionPopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="setup-connection-popover">{children}</div>
  ),
}));

vi.mock("../../components/lineage", () => ({
  BaseEnvironmentSetupGuide: () => <div data-testid="base-env-setup" />,
}));

vi.mock("../QueryForm", () => ({
  QueryForm: () => <div data-testid="query-form" />,
}));

vi.mock("../SetupConnectionGuide", () => ({
  SetupConnectionGuide: () => <div data-testid="setup-connection-guide" />,
}));

vi.mock("../SqlEditor", () => ({
  __esModule: true,
  default: () => <div data-testid="sql-editor" />,
  DualSqlEditor: () => <div data-testid="dual-sql-editor" />,
}));

vi.mock("../../../hooks", () => ({
  defaultSqlQuery: "select * from my_model",
  useRecceQueryContext: () => mockUseRecceQueryContext(),
  useApiConfig: () => mockUseApiConfig(),
}));

vi.mock("../../../contexts", () => ({
  useLineageGraphContext: () => mockUseLineageGraphContext(),
  useRecceActionContext: () => mockUseRecceActionContext(),
  useRecceInstanceContext: () => mockUseRecceInstanceContext(),
}));

describe("QueryPageOss", () => {
  beforeEach(() => {
    mockUseRecceQueryContext.mockReturnValue({
      sqlQuery: "select * from my_model",
      baseSqlQuery: "",
      setSqlQuery: vi.fn(),
      setBaseSqlQuery: vi.fn(),
      primaryKeys: [],
      setPrimaryKeys: vi.fn(),
      isCustomQueries: false,
      setCustomQueries: vi.fn(),
    });
    mockUseLineageGraphContext.mockReturnValue({
      lineageGraph: undefined,
      envInfo: undefined,
    });
    mockUseRecceInstanceContext.mockReturnValue({
      featureToggles: { mode: null },
      singleEnv: true,
    });
    mockUseRecceActionContext.mockReturnValue({
      showRunId: vi.fn(),
    });
    mockUseApiConfig.mockReturnValue({
      apiClient: {},
    });
  });

  it("renders disabled Run Diff button for single environment", () => {
    render(<QueryPageOss />);

    expect(screen.getByRole("button", { name: "Run Diff" })).toBeDisabled();
  });
});
