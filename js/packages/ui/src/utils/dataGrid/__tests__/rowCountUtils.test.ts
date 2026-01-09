import {
  calculateDelta,
  getRowCountDiffStatus,
  rowCountDiffResultToDataFrame,
  rowCountResultToDataFrame,
} from "../rowCountUtils";

// ============================================================================
// calculateDelta Tests
// ============================================================================

describe("calculateDelta", () => {
  test("returns '0' when values are equal", () => {
    expect(calculateDelta(100, 100)).toBe("0");
  });

  test("returns percentage string when values differ", () => {
    const result = calculateDelta(100, 150);
    expect(result).toMatch(/^\+50(\.0)?%$/);
  });

  test("returns 'Added' when base is null", () => {
    expect(calculateDelta(null, 100)).toBe("Added");
  });

  test("returns 'Removed' when current is null", () => {
    expect(calculateDelta(100, null)).toBe("Removed");
  });

  test("returns 'N/A' when both are null", () => {
    expect(calculateDelta(null, null)).toBe("N/A");
  });
});

// ============================================================================
// getRowCountDiffStatus Tests
// ============================================================================

describe("getRowCountDiffStatus", () => {
  test("returns 'added' when only current exists", () => {
    expect(getRowCountDiffStatus(null, 100)).toBe("added");
  });

  test("returns 'removed' when only base exists", () => {
    expect(getRowCountDiffStatus(100, null)).toBe("removed");
  });

  test("returns 'modified' when values differ", () => {
    expect(getRowCountDiffStatus(100, 200)).toBe("modified");
  });

  test("returns undefined when values are equal", () => {
    expect(getRowCountDiffStatus(100, 100)).toBeUndefined();
  });

  test("returns undefined when both are null", () => {
    expect(getRowCountDiffStatus(null, null)).toBeUndefined();
  });
});

// ============================================================================
// rowCountDiffResultToDataFrame Tests
// ============================================================================

describe("rowCountDiffResultToDataFrame", () => {
  test("converts empty result to empty DataFrame", () => {
    const result = rowCountDiffResultToDataFrame({});

    expect(result.columns).toHaveLength(4);
    expect(result.data).toHaveLength(0);
  });

  test("converts single entry correctly", () => {
    const result = rowCountDiffResultToDataFrame({
      orders: { base: 100, curr: 150 },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0][0]).toBe("orders");
    expect(result.data[0][1]).toBe(100);
    expect(result.data[0][2]).toBe(150);
  });

  test("handles null values", () => {
    const result = rowCountDiffResultToDataFrame({
      new_model: { base: null, curr: 100 },
    });

    expect(result.data[0][1]).toBeNull();
    expect(result.data[0][2]).toBe(100);
    expect(result.data[0][3]).toBe("Added");
  });

  test("includes calculated delta", () => {
    const result = rowCountDiffResultToDataFrame({
      orders: { base: 100, curr: 100 },
    });

    expect(result.data[0][3]).toBe("0");
  });
});

// ============================================================================
// rowCountResultToDataFrame Tests
// ============================================================================

describe("rowCountResultToDataFrame", () => {
  test("converts empty result to empty DataFrame", () => {
    const result = rowCountResultToDataFrame({});

    expect(result.columns).toHaveLength(2);
    expect(result.data).toHaveLength(0);
  });

  test("converts single entry correctly", () => {
    const result = rowCountResultToDataFrame({
      orders: { curr: 150 },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0][0]).toBe("orders");
    expect(result.data[0][1]).toBe(150);
  });

  test("handles null values", () => {
    const result = rowCountResultToDataFrame({
      failed_model: { curr: null },
    });

    expect(result.data[0][1]).toBeNull();
  });
});
