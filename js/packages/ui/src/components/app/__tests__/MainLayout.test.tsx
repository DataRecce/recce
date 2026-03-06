import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Main } from "../MainLayout";

// ============================================================================
// Mocks
// ============================================================================

// Mock react-split to capture props passed to Split components
vi.mock("react-split", () => ({
  __esModule: true,
  default: ({
    children,
    direction,
    sizes,
    minSize,
    gutterSize,
    style,
  }: {
    children: React.ReactNode;
    direction?: string;
    sizes?: number[];
    minSize?: number | number[];
    gutterSize?: number;
    style?: React.CSSProperties;
  }) => (
    <div
      data-testid={`mock-split-${direction ?? "horizontal"}`}
      data-direction={direction}
      data-sizes={JSON.stringify(sizes)}
      data-min-size={JSON.stringify(minSize)}
      data-gutter-size={gutterSize}
      style={style}
    >
      {children}
    </div>
  ),
}));

// Track the action context values used in each test
let mockActionContext = {
  isRunResultOpen: false,
  isHistoryOpen: false,
  closeRunResult: vi.fn(),
  runAction: vi.fn(),
  showRunId: vi.fn(),
  closeHistory: vi.fn(),
  showHistory: vi.fn(),
  setHistoryOpen: vi.fn(),
  clearRunResult: vi.fn(),
};

vi.mock("../../../contexts", () => ({
  useRecceActionContext: () => mockActionContext,
  useRouteConfig: () => ({ basePath: "" }),
  useRecceServerFlag: () => ({ data: { single_env_onboarding: false } }),
  useLineageGraphContext: () => ({
    isDemoSite: false,
    isLoading: false,
    isCodespace: false,
  }),
  useRecceInstanceContext: () => ({
    featureToggles: { mode: null },
  }),
}));

vi.mock("../../../hooks/useIsDark", () => ({
  useIsDark: () => false,
}));

// Mock run components to avoid complex dependencies
vi.mock("../../run", () => ({
  RunListOss: () => <div data-testid="mock-run-list">RunList</div>,
  RunResultPaneOss: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="mock-run-result-pane">
      RunResultPane
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

// ============================================================================
// Helpers
// ============================================================================

function renderMain(overrides: Partial<typeof mockActionContext> = {}) {
  mockActionContext = { ...mockActionContext, ...overrides };

  return render(
    <Main isLineageRoute={true} lineage={<div>Lineage Content</div>}>
      <div>Children Content</div>
    </Main>,
  );
}

/**
 * Get the vertical split element (controls run result pane open/close)
 */
function getVSplit() {
  return screen.getByTestId("mock-split-vertical");
}

/**
 * Get the horizontal split element (controls history panel open/close)
 */
function getHSplit() {
  return screen.getByTestId("mock-split-horizontal");
}

// ============================================================================
// Tests: VSplit (Run Result Pane) — constant props prevent destroy/recreate
// ============================================================================

describe("Main component - VSplit stability (run result pane)", () => {
  describe("gutterSize must be constant to avoid react-split destroy/recreate", () => {
    test("VSplit gutterSize is 5 when result pane is CLOSED", () => {
      renderMain({ isRunResultOpen: false });
      expect(getVSplit()).toHaveAttribute("data-gutter-size", "5");
    });

    test("VSplit gutterSize is 5 when result pane is OPEN", () => {
      renderMain({ isRunResultOpen: true });
      expect(getVSplit()).toHaveAttribute("data-gutter-size", "5");
    });
  });

  describe("minSize must be constant to avoid react-split destroy/recreate", () => {
    test("VSplit minSize is 0 when result pane is CLOSED", () => {
      renderMain({ isRunResultOpen: false });
      expect(getVSplit()).toHaveAttribute("data-min-size", "0");
    });

    test("VSplit minSize is 0 when result pane is OPEN", () => {
      renderMain({ isRunResultOpen: true });
      expect(getVSplit()).toHaveAttribute("data-min-size", "0");
    });
  });

  describe("only sizes should change based on result pane state", () => {
    test("VSplit sizes are [100, 0] when result pane is CLOSED", () => {
      renderMain({ isRunResultOpen: false });
      expect(getVSplit()).toHaveAttribute(
        "data-sizes",
        JSON.stringify([100, 0]),
      );
    });

    test("VSplit sizes are [50, 50] when result pane is OPEN", () => {
      renderMain({ isRunResultOpen: true });
      expect(getVSplit()).toHaveAttribute(
        "data-sizes",
        JSON.stringify([50, 50]),
      );
    });
  });
});

// ============================================================================
// Tests: HSplit (History Panel) — constant props prevent destroy/recreate
// ============================================================================

describe("Main component - HSplit stability (history panel)", () => {
  describe("gutterSize must be constant to avoid react-split destroy/recreate", () => {
    test("HSplit gutterSize is 5 when history panel is CLOSED", () => {
      renderMain({ isHistoryOpen: false });
      expect(getHSplit()).toHaveAttribute("data-gutter-size", "5");
    });

    test("HSplit gutterSize is 5 when history panel is OPEN", () => {
      renderMain({ isHistoryOpen: true });
      expect(getHSplit()).toHaveAttribute("data-gutter-size", "5");
    });
  });

  describe("minSize must be constant to avoid react-split destroy/recreate", () => {
    test("HSplit minSize is 0 when history panel is CLOSED", () => {
      renderMain({ isHistoryOpen: false });
      expect(getHSplit()).toHaveAttribute("data-min-size", "0");
    });

    test("HSplit minSize is 0 when history panel is OPEN", () => {
      renderMain({ isHistoryOpen: true });
      expect(getHSplit()).toHaveAttribute("data-min-size", "0");
    });
  });

  describe("only sizes should change based on history panel state", () => {
    test("HSplit sizes are [0, 100] when history panel is CLOSED", () => {
      renderMain({ isHistoryOpen: false });
      expect(getHSplit()).toHaveAttribute(
        "data-sizes",
        JSON.stringify([0, 100]),
      );
    });

    test("HSplit sizes reflect open state when history panel is OPEN", () => {
      renderMain({ isHistoryOpen: true });
      const hsplit = getHSplit();
      const sizes = JSON.parse(hsplit.getAttribute("data-sizes") ?? "[]");
      // When open, the first pane (history) should have non-zero size
      expect(sizes[0]).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Tests: Gutter visibility — hidden when panels are collapsed
// ============================================================================

describe("Main component - gutter visibility", () => {
  test("VSplit has split-gutter-hidden class when result pane is CLOSED", () => {
    renderMain({ isRunResultOpen: false });
    // The SplitPane wrapper Box should have the class
    const vsplit = getVSplit();
    // Walk up to find the SplitPane wrapper with the class
    const wrapper = vsplit.closest("[class*='split-gutter-hidden']");
    expect(wrapper).not.toBeNull();
  });

  test("VSplit does NOT have split-gutter-hidden class when result pane is OPEN", () => {
    renderMain({ isRunResultOpen: true });
    const vsplit = getVSplit();
    const wrapper = vsplit.closest("[class*='split-gutter-hidden']");
    expect(wrapper).toBeNull();
  });

  test("HSplit has split-gutter-hidden class when history panel is CLOSED", () => {
    renderMain({ isHistoryOpen: false });
    const hsplit = getHSplit();
    const wrapper = hsplit.closest("[class*='split-gutter-hidden']");
    expect(wrapper).not.toBeNull();
  });

  test("HSplit does NOT have split-gutter-hidden class when history panel is OPEN", () => {
    renderMain({ isHistoryOpen: true });
    const hsplit = getHSplit();
    const wrapper = hsplit.closest("[class*='split-gutter-hidden']");
    expect(wrapper).toBeNull();
  });
});

// ============================================================================
// Tests: Content rendering
// ============================================================================

describe("Main component - content rendering", () => {
  test("shows RunResultPane when result pane is open", () => {
    renderMain({ isRunResultOpen: true });
    expect(screen.getByTestId("mock-run-result-pane")).toBeInTheDocument();
  });

  test("hides RunResultPane when result pane is closed", () => {
    renderMain({ isRunResultOpen: false });
    expect(
      screen.queryByTestId("mock-run-result-pane"),
    ).not.toBeInTheDocument();
  });

  test("shows RunList when history panel is open", () => {
    renderMain({ isHistoryOpen: true });
    expect(screen.getByTestId("mock-run-list")).toBeInTheDocument();
  });

  test("hides RunList when history panel is closed", () => {
    renderMain({ isHistoryOpen: false });
    expect(screen.queryByTestId("mock-run-list")).not.toBeInTheDocument();
  });
});
