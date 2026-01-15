/**
 * @file QueryPageOss.test.tsx
 * @description Tests for QueryPageOss high-level component.
 */

import { render, screen } from "@testing-library/react";
import { QueryPageOss } from "../QueryPageOss";

const mockUseRecceQueryContext = jest.fn();
const mockUseLineageGraphContext = jest.fn();
const mockUseRecceInstanceContext = jest.fn();
const mockUseRecceActionContext = jest.fn();
const mockUseApiConfig = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock("../../../api", () => ({
  submitQuery: jest.fn(),
  submitQueryBase: jest.fn(),
  submitQueryDiff: jest.fn(),
  waitRun: jest.fn(),
}));

jest.mock(
  "../../components",
  () => ({
    HistoryToggle: () => <div data-testid="history-toggle" />,
  }),
  { virtual: true },
);

jest.mock(
  "../../components/app",
  () => ({
    SetupConnectionPopover: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="setup-connection-popover">{children}</div>
    ),
  }),
  { virtual: true },
);

jest.mock(
  "../../components/lineage",
  () => ({
    BaseEnvironmentSetupGuide: () => <div data-testid="base-env-setup" />,
  }),
  { virtual: true },
);

jest.mock("../QueryForm", () => ({
  QueryForm: () => <div data-testid="query-form" />,
}));

jest.mock("../SetupConnectionGuide", () => ({
  SetupConnectionGuide: () => <div data-testid="setup-connection-guide" />,
}));

jest.mock("../SqlEditor", () => ({
  __esModule: true,
  default: () => <div data-testid="sql-editor" />,
  DualSqlEditor: () => <div data-testid="dual-sql-editor" />,
}));

jest.mock("../../../hooks", () => ({
  defaultSqlQuery: "select * from my_model",
  useRecceQueryContext: () => mockUseRecceQueryContext(),
  useApiConfig: () => mockUseApiConfig(),
}));

jest.mock("../../../contexts", () => ({
  useLineageGraphContext: () => mockUseLineageGraphContext(),
  useRecceActionContext: () => mockUseRecceActionContext(),
  useRecceInstanceContext: () => mockUseRecceInstanceContext(),
}));

describe("QueryPageOss", () => {
  beforeEach(() => {
    mockUseRecceQueryContext.mockReturnValue({
      sqlQuery: "select * from my_model",
      baseSqlQuery: "",
      setSqlQuery: jest.fn(),
      setBaseSqlQuery: jest.fn(),
      primaryKeys: [],
      setPrimaryKeys: jest.fn(),
      isCustomQueries: false,
      setCustomQueries: jest.fn(),
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
      showRunId: jest.fn(),
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
