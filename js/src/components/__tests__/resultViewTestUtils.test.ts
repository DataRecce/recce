/**
 * @file resultViewTestUtils.test.ts
 * @description Tests to verify resultViewTestUtils loads and exports correctly
 */

import { vi } from "vitest";

// Mock ag-grid-community before any imports
vi.mock("ag-grid-community", () => ({
  themeQuartz: { withParams: vi.fn(() => "mocked-theme") },
  AllCommunityModule: {},
  ModuleRegistry: {
    registerModules: vi.fn(),
  },
}));

import {
  createEmptyRowCountDiffRun,
  createHistogramDiffRun,
  createProfileDiffRun,
  createProfileRun,
  createQueryDiffRun,
  createQueryRun,
  createRowCountDiffRun,
  createRowCountRun,
  createRunningRun,
  createRunWithError,
  createTopKDiffRun,
  createValueDiffRun,
  runFixtureCreators,
  runTypesWithResultView,
} from "@/testing-utils/fixtures/runFixtures";
import {
  agGridCoreMock,
  agGridMock,
  agGridReactMock,
  createBoxRef,
  createGridRef,
  createTestQueryClient,
  expectRefForwarded,
  expectThrowsForWrongType,
  getResultViewMockConfig,
  renderResultView,
  renderWithProviders,
  resetDarkModeMock,
  screenshotBoxMock,
  screenshotDataGridMock,
  setDarkMode,
  setupResultViewMocks,
  TestProviders,
  useIsDarkMock,
} from "@/testing-utils/resultViewTestUtils";

// ============================================================================
// Test Utilities Export Verification
// ============================================================================

describe("resultViewTestUtils exports", () => {
  test("exports AG Grid mocks", () => {
    expect(agGridMock).toBeDefined();
    expect(agGridMock.ModuleRegistry).toBeDefined();
    expect(agGridCoreMock).toBeDefined();
    expect(agGridReactMock).toBeDefined();
  });

  test("exports Screenshot mocks", () => {
    expect(screenshotBoxMock).toBeDefined();
    expect(screenshotDataGridMock).toBeDefined();
  });

  test("exports provider utilities", () => {
    expect(createTestQueryClient).toBeDefined();
    expect(TestProviders).toBeDefined();
  });

  test("exports render utilities", () => {
    expect(renderWithProviders).toBeDefined();
    expect(renderResultView).toBeDefined();
  });

  test("exports ref utilities", () => {
    expect(createGridRef).toBeDefined();
    expect(createBoxRef).toBeDefined();
  });

  test("exports assertion utilities", () => {
    expect(expectThrowsForWrongType).toBeDefined();
    expect(expectRefForwarded).toBeDefined();
  });

  test("exports hook mocks", () => {
    expect(useIsDarkMock).toBeDefined();
    expect(setDarkMode).toBeDefined();
    expect(resetDarkModeMock).toBeDefined();
  });

  test("exports setup utilities", () => {
    expect(setupResultViewMocks).toBeDefined();
    expect(getResultViewMockConfig).toBeDefined();
  });
});

// ============================================================================
// Run Fixtures Export Verification
// ============================================================================

describe("runFixtures exports", () => {
  test("exports row count fixtures", () => {
    expect(createRowCountDiffRun).toBeDefined();
    expect(createRowCountRun).toBeDefined();
    expect(createEmptyRowCountDiffRun).toBeDefined();
  });

  test("exports value diff fixture", () => {
    expect(createValueDiffRun).toBeDefined();
  });

  test("exports histogram diff fixture", () => {
    expect(createHistogramDiffRun).toBeDefined();
  });

  test("exports top-k diff fixture", () => {
    expect(createTopKDiffRun).toBeDefined();
  });

  test("exports profile fixtures", () => {
    expect(createProfileDiffRun).toBeDefined();
    expect(createProfileRun).toBeDefined();
  });

  test("exports query fixtures", () => {
    expect(createQueryDiffRun).toBeDefined();
    expect(createQueryRun).toBeDefined();
  });

  test("exports error case fixtures", () => {
    expect(createRunWithError).toBeDefined();
    expect(createRunningRun).toBeDefined();
  });

  test("exports fixture lookup helpers", () => {
    expect(runFixtureCreators).toBeDefined();
    expect(runTypesWithResultView).toBeDefined();
    expect(runTypesWithResultView).toContain("row_count_diff");
    expect(runTypesWithResultView).toContain("query_diff");
  });
});

// ============================================================================
// Fixture Function Verification
// ============================================================================

describe("runFixtures - createRowCountDiffRun", () => {
  test("creates valid row_count_diff run", () => {
    const run = createRowCountDiffRun();
    expect(run.type).toBe("row_count_diff");
    expect(run.run_id).toBeDefined();
    expect(run.run_at).toBeDefined();
    expect(run.status).toBe("Finished");
    expect(run.result).toBeDefined();
    expect(run.params?.node_names).toBeDefined();
  });

  test("includes diverse row count scenarios", () => {
    const run = createRowCountDiffRun();
    const result = run.result;
    expect(result).toBeDefined();

    // Check for modified (base != curr)
    expect(result?.orders.base).not.toBe(result?.orders.curr);

    // Check for unchanged (base === curr)
    expect(result?.customers.base).toBe(result?.customers.curr);

    // Check for added (base is null)
    expect(result?.products.base).toBeNull();
    expect(result?.products.curr).not.toBeNull();

    // Check for removed (curr is null)
    expect(result?.old_model.base).not.toBeNull();
    expect(result?.old_model.curr).toBeNull();
  });
});

describe("runFixtures - createValueDiffRun", () => {
  test("creates valid value_diff run", () => {
    const run = createValueDiffRun();
    expect(run.type).toBe("value_diff");
    expect(run.result?.summary).toBeDefined();
    expect(run.result?.data).toBeDefined();
    expect(run.params?.model).toBeDefined();
    expect(run.params?.primary_key).toBeDefined();
  });
});

describe("runFixtures - createHistogramDiffRun", () => {
  test("creates valid histogram_diff run", () => {
    const run = createHistogramDiffRun();
    expect(run.type).toBe("histogram_diff");
    expect(run.result?.base).toBeDefined();
    expect(run.result?.current).toBeDefined();
    expect(run.result?.bin_edges).toBeDefined();
    expect(run.result?.min).toBeDefined();
    expect(run.result?.max).toBeDefined();
  });
});

describe("runFixtures - createTopKDiffRun", () => {
  test("creates valid top_k_diff run", () => {
    const run = createTopKDiffRun();
    expect(run.type).toBe("top_k_diff");
    expect(run.result?.base).toBeDefined();
    expect(run.result?.current).toBeDefined();
    expect(run.result?.base.values).toBeDefined();
    expect(run.result?.base.counts).toBeDefined();
  });
});

describe("runFixtures - createProfileDiffRun", () => {
  test("creates valid profile_diff run", () => {
    const run = createProfileDiffRun();
    expect(run.type).toBe("profile_diff");
    expect(run.result?.base).toBeDefined();
    expect(run.result?.current).toBeDefined();
    expect(run.result?.base?.columns).toBeDefined();
    expect(run.result?.base?.data).toBeDefined();
  });
});

describe("runFixtures - createQueryDiffRun", () => {
  test("creates valid query_diff run", () => {
    const run = createQueryDiffRun();
    expect(run.type).toBe("query_diff");
    expect(run.result?.base).toBeDefined();
    expect(run.result?.current).toBeDefined();
    expect(run.params?.sql_template).toBeDefined();
  });
});

describe("runFixtures - error cases", () => {
  test("createRunWithError creates failed run", () => {
    const run = createRunWithError();
    expect(run.status).toBe("Failed");
    expect(run.error).toBeDefined();
    expect(run.result).toBeUndefined();
  });

  test("createRunningRun creates running run", () => {
    const run = createRunningRun();
    expect(run.status).toBe("Running");
    expect(run.progress).toBeDefined();
    expect(run.progress?.percentage).toBeDefined();
  });
});

// ============================================================================
// Utility Function Verification
// ============================================================================

describe("resultViewTestUtils - ref utilities", () => {
  test("createGridRef creates a ref object", () => {
    const ref = createGridRef();
    expect(ref).toBeDefined();
    expect(ref.current).toBeNull();
  });

  test("createBoxRef creates a ref object", () => {
    const ref = createBoxRef();
    expect(ref).toBeDefined();
    expect(ref.current).toBeNull();
  });
});

describe("resultViewTestUtils - dark mode utilities", () => {
  beforeEach(() => {
    resetDarkModeMock();
  });

  test("useIsDarkMock returns false by default", () => {
    expect(useIsDarkMock()).toBe(false);
  });

  test("setDarkMode changes return value", () => {
    setDarkMode(true);
    expect(useIsDarkMock()).toBe(true);

    setDarkMode(false);
    expect(useIsDarkMock()).toBe(false);
  });

  test("resetDarkModeMock resets to false", () => {
    setDarkMode(true);
    resetDarkModeMock();
    expect(useIsDarkMock()).toBe(false);
  });
});

describe("resultViewTestUtils - mock config", () => {
  test("getResultViewMockConfig returns all mocks", () => {
    const config = getResultViewMockConfig();
    expect(config.agGrid).toBeDefined();
    expect(config.agGridCore).toBeDefined();
    expect(config.agGridReact).toBeDefined();
    expect(config.screenshotBox).toBeDefined();
    expect(config.screenshotDataGrid).toBeDefined();
    expect(config.useIsDark).toBeDefined();
  });
});
