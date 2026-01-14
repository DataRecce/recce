import { deltaPercentageString } from "./delta";

describe("deltaPercentageString", () => {
  describe("when base < current (increase)", () => {
    test("returns positive percentage", () => {
      expect(deltaPercentageString(100, 150)).toBe("+50.0%");
    });

    test("returns positive percentage with decimal", () => {
      expect(deltaPercentageString(100, 125)).toBe("+25.0%");
    });

    test("returns '+ <0.1 %' for very small increases", () => {
      expect(deltaPercentageString(10000, 10005)).toBe("+ <0.1 %");
    });
  });

  describe("when base > current (decrease)", () => {
    test("returns negative percentage", () => {
      expect(deltaPercentageString(100, 50)).toBe("-50.0%");
    });

    test("returns negative percentage with decimal", () => {
      expect(deltaPercentageString(100, 75)).toBe("-25.0%");
    });

    test("returns '- <0.1 %' for very small decreases", () => {
      expect(deltaPercentageString(10000, 9995)).toBe("- <0.1 %");
    });
  });

  describe("when base === current (no change)", () => {
    test("returns '0'", () => {
      expect(deltaPercentageString(100, 100)).toBe("0");
    });

    test("returns '0' for zero values", () => {
      expect(deltaPercentageString(0, 0)).toBe("0");
    });
  });

  describe("when base is 0 (divide by zero)", () => {
    test("returns 'N/A' when base is 0 and current is positive", () => {
      expect(deltaPercentageString(0, 100)).toBe("N/A");
    });

    test("returns 'N/A' when base is 0 and current is negative", () => {
      expect(deltaPercentageString(0, -100)).toBe("N/A");
    });
  });
});
