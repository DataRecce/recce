/**
 * @file columnPrecisionOptions.test.ts
 * @description Tests for column precision select options
 *
 * Tests cover:
 * - Option generation for column names
 * - Callback invocation with correct render modes
 * - All precision option types (raw, 2 decimal, percent, delta)
 */

import { vi } from "vitest";
import { columnPrecisionSelectOptions } from "../columnPrecisionOptions";

describe("columnPrecisionSelectOptions", () => {
  test("returns array of 4 options", () => {
    const callback = vi.fn();
    const options = columnPrecisionSelectOptions("price", callback);

    expect(options).toHaveLength(4);
  });

  test("each option has value and onClick", () => {
    const callback = vi.fn();
    const options = columnPrecisionSelectOptions("price", callback);

    options.forEach((option) => {
      expect(option).toHaveProperty("value");
      expect(option).toHaveProperty("onClick");
      expect(typeof option.value).toBe("string");
      expect(typeof option.onClick).toBe("function");
    });
  });

  test("first option is 'Show raw value'", () => {
    const callback = vi.fn();
    const options = columnPrecisionSelectOptions("price", callback);

    expect(options[0].value).toBe("Show raw value");
    options[0].onClick();
    expect(callback).toHaveBeenCalledWith({ price: "raw" });
  });

  test("second option is 'Show 2 decimal points'", () => {
    const callback = vi.fn();
    const options = columnPrecisionSelectOptions("price", callback);

    expect(options[1].value).toBe("Show 2 decimal points");
    options[1].onClick();
    expect(callback).toHaveBeenCalledWith({ price: 2 });
  });

  test("third option is 'Show as percentage'", () => {
    const callback = vi.fn();
    const options = columnPrecisionSelectOptions("price", callback);

    expect(options[2].value).toBe("Show as percentage");
    options[2].onClick();
    expect(callback).toHaveBeenCalledWith({ price: "percent" });
  });

  test("fourth option is 'Show with net change'", () => {
    const callback = vi.fn();
    const options = columnPrecisionSelectOptions("price", callback);

    expect(options[3].value).toBe("Show with net change");
    options[3].onClick();
    expect(callback).toHaveBeenCalledWith({ price: "delta" });
  });

  test("uses column name in callback key", () => {
    const callback = vi.fn();
    const options = columnPrecisionSelectOptions("total_amount", callback);

    options[0].onClick();
    expect(callback).toHaveBeenCalledWith({ total_amount: "raw" });
  });

  test("handles special characters in column name", () => {
    const callback = vi.fn();
    const options = columnPrecisionSelectOptions("col-with-dashes", callback);

    options[0].onClick();
    expect(callback).toHaveBeenCalledWith({ "col-with-dashes": "raw" });
  });

  test("each onClick calls the callback independently", () => {
    const callback = vi.fn();
    const options = columnPrecisionSelectOptions("price", callback);

    // Click all options
    options.forEach((option) => option.onClick());

    expect(callback).toHaveBeenCalledTimes(4);
    expect(callback).toHaveBeenNthCalledWith(1, { price: "raw" });
    expect(callback).toHaveBeenNthCalledWith(2, { price: 2 });
    expect(callback).toHaveBeenNthCalledWith(3, { price: "percent" });
    expect(callback).toHaveBeenNthCalledWith(4, { price: "delta" });
  });
});
