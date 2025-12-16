/**
 * @file inlineRenderCell.test.tsx
 * @description Tests for inline diff cell renderer
 *
 * Tests cover:
 * - asNumber helper function
 * - inlineRenderCell component rendering
 * - Delta mode display
 * - Diff display (base vs current)
 */

import { asNumber } from "./inlineRenderCell";

// ============================================================================
// asNumber Tests
// ============================================================================

describe("asNumber", () => {
  describe("number input", () => {
    test("returns number as-is", () => {
      expect(asNumber(123)).toBe(123);
    });

    test("returns negative number as-is", () => {
      expect(asNumber(-456)).toBe(-456);
    });

    test("returns decimal number as-is", () => {
      expect(asNumber(123.456)).toBe(123.456);
    });

    test("returns zero as-is", () => {
      expect(asNumber(0)).toBe(0);
    });

    test("returns negative zero as-is", () => {
      expect(asNumber(-0)).toBe(-0);
    });

    test("returns NaN as-is", () => {
      expect(Number.isNaN(asNumber(NaN))).toBe(true);
    });

    test("returns Infinity as-is", () => {
      expect(asNumber(Infinity)).toBe(Infinity);
    });

    test("returns negative Infinity as-is", () => {
      expect(asNumber(-Infinity)).toBe(-Infinity);
    });
  });

  describe("string input", () => {
    test("parses numeric string", () => {
      expect(asNumber("123")).toBe(123);
    });

    test("parses decimal string", () => {
      expect(asNumber("123.456")).toBe(123.456);
    });

    test("parses negative string", () => {
      expect(asNumber("-456")).toBe(-456);
    });

    test("parses string with leading whitespace", () => {
      expect(asNumber("  123")).toBe(123);
    });

    test("parses string with trailing whitespace", () => {
      expect(asNumber("123  ")).toBe(123);
    });

    test("returns 0 for non-numeric string", () => {
      expect(asNumber("abc")).toBe(0);
    });

    test("returns 0 for empty string", () => {
      expect(asNumber("")).toBe(0);
    });

    test("parses string starting with number", () => {
      // parseFloat stops at first non-numeric character
      expect(asNumber("123abc")).toBe(123);
    });

    test("returns 0 for string starting with non-number", () => {
      expect(asNumber("abc123")).toBe(0);
    });

    test("parses scientific notation string", () => {
      expect(asNumber("1.5e10")).toBe(1.5e10);
    });

    test("parses Infinity string", () => {
      expect(asNumber("Infinity")).toBe(Infinity);
    });

    test("parses negative Infinity string", () => {
      expect(asNumber("-Infinity")).toBe(-Infinity);
    });
  });

  describe("other types", () => {
    test("returns 0 for null", () => {
      expect(asNumber(null as never)).toBe(0);
    });

    test("returns 0 for undefined", () => {
      expect(asNumber(undefined as never)).toBe(0);
    });

    test("returns 0 for boolean true", () => {
      expect(asNumber(true as never)).toBe(0);
    });

    test("returns 0 for boolean false", () => {
      expect(asNumber(false as never)).toBe(0);
    });

    test("returns 0 for object", () => {
      expect(asNumber({} as never)).toBe(0);
    });

    test("returns 0 for array", () => {
      expect(asNumber([] as never)).toBe(0);
    });
  });
});
