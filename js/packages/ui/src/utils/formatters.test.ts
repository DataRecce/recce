import { formatAsAbbreviatedNumber, formatIntervalMinMax } from "./formatters";

describe("formatIntervalMinMax", () => {
  describe("lower bound (<0.1%)", () => {
    test("returns <0.1% for very small positive values", () => {
      expect(formatIntervalMinMax(0.0001)).toBe("<0.1%");
      expect(formatIntervalMinMax(0.0005)).toBe("<0.1%");
    });

    test("returns <0.1% at the upper edge (0.001)", () => {
      expect(formatIntervalMinMax(0.001)).toBe("<0.1%");
    });

    test("does not return <0.1% for zero", () => {
      expect(formatIntervalMinMax(0)).toBe("0.0%");
    });
  });

  describe("upper bound (>99.9%)", () => {
    test("returns >99.9% for values very close to 100%", () => {
      expect(formatIntervalMinMax(0.9995)).toBe(">99.9%");
      expect(formatIntervalMinMax(0.9999)).toBe(">99.9%");
    });

    test("returns >99.9% at the lower edge (0.999)", () => {
      expect(formatIntervalMinMax(0.999)).toBe(">99.9%");
    });

    test("does not return >99.9% for exactly 100%", () => {
      expect(formatIntervalMinMax(1)).toBe("100.0%");
    });
  });

  describe("normal range", () => {
    test("formats 0% correctly", () => {
      expect(formatIntervalMinMax(0)).toBe("0.0%");
    });

    test("formats 50% correctly", () => {
      expect(formatIntervalMinMax(0.5)).toBe("50.0%");
    });

    test("formats 100% correctly", () => {
      expect(formatIntervalMinMax(1)).toBe("100.0%");
    });

    test("formats values just above 0.1%", () => {
      expect(formatIntervalMinMax(0.002)).toBe("0.2%");
      expect(formatIntervalMinMax(0.01)).toBe("1.0%");
    });

    test("formats values just below 99.9%", () => {
      expect(formatIntervalMinMax(0.998)).toBe("99.8%");
      expect(formatIntervalMinMax(0.99)).toBe("99.0%");
    });

    test("formats decimal percentages", () => {
      expect(formatIntervalMinMax(0.123)).toBe("12.3%");
      expect(formatIntervalMinMax(0.456)).toBe("45.6%");
      expect(formatIntervalMinMax(0.789)).toBe("78.9%");
    });
  });

  describe("edge cases", () => {
    test("handles values greater than 100%", () => {
      expect(formatIntervalMinMax(1.5)).toBe("150.0%");
      expect(formatIntervalMinMax(2)).toBe("200.0%");
    });

    test("handles negative values", () => {
      expect(formatIntervalMinMax(-0.1)).toBe("-10.0%");
      expect(formatIntervalMinMax(-0.5)).toBe("-50.0%");
    });
  });
});

describe("formatAsAbbreviatedNumber", () => {
  describe("string passthrough", () => {
    test("returns string input unchanged", () => {
      expect(formatAsAbbreviatedNumber("hello")).toBe("hello");
      expect(formatAsAbbreviatedNumber("2024-01-01")).toBe("2024-01-01");
      expect(formatAsAbbreviatedNumber("")).toBe("");
    });
  });

  describe("trillions (T)", () => {
    test("formats small trillions with decimals", () => {
      expect(formatAsAbbreviatedNumber(1_000_000_000_000)).toBe("1T");
      expect(formatAsAbbreviatedNumber(1_500_000_000_000)).toBe("1.5T");
      expect(formatAsAbbreviatedNumber(12_340_000_000_000)).toBe("12.34T");
    });

    test("formats large trillions without decimals", () => {
      expect(formatAsAbbreviatedNumber(1_000_000_000_000_000)).toBe("1,000T");
      expect(formatAsAbbreviatedNumber(999_000_000_000_000_000)).toBe(
        "999,000T",
      );
    });

    test("formats negative trillions", () => {
      expect(formatAsAbbreviatedNumber(-1_000_000_000_000)).toBe("-1T");
      expect(formatAsAbbreviatedNumber(-5_500_000_000_000)).toBe("-5.5T");
    });
  });

  describe("billions (B)", () => {
    test("formats billions", () => {
      expect(formatAsAbbreviatedNumber(1_000_000_000)).toBe("1B");
      expect(formatAsAbbreviatedNumber(2_500_000_000)).toBe("2.5B");
      expect(formatAsAbbreviatedNumber(999_000_000_000)).toBe("999B");
    });

    test("formats negative billions", () => {
      expect(formatAsAbbreviatedNumber(-1_000_000_000)).toBe("-1B");
      expect(formatAsAbbreviatedNumber(-7_800_000_000)).toBe("-7.8B");
    });
  });

  describe("millions (M)", () => {
    test("formats millions", () => {
      expect(formatAsAbbreviatedNumber(1_000_000)).toBe("1M");
      expect(formatAsAbbreviatedNumber(5_600_000)).toBe("5.6M");
      expect(formatAsAbbreviatedNumber(999_000_000)).toBe("999M");
    });

    test("formats negative millions", () => {
      expect(formatAsAbbreviatedNumber(-1_000_000)).toBe("-1M");
      expect(formatAsAbbreviatedNumber(-4_300_000)).toBe("-4.3M");
    });
  });

  describe("thousands (K)", () => {
    test("formats thousands", () => {
      expect(formatAsAbbreviatedNumber(1_000)).toBe("1K");
      expect(formatAsAbbreviatedNumber(2_500)).toBe("2.5K");
      expect(formatAsAbbreviatedNumber(999_000)).toBe("999K");
    });

    test("formats negative thousands", () => {
      expect(formatAsAbbreviatedNumber(-1_000)).toBe("-1K");
      expect(formatAsAbbreviatedNumber(-6_700)).toBe("-6.7K");
    });
  });

  describe("ones, tens, hundreds (1-999)", () => {
    test("formats small integers", () => {
      expect(formatAsAbbreviatedNumber(1)).toBe("1");
      expect(formatAsAbbreviatedNumber(10)).toBe("10");
      expect(formatAsAbbreviatedNumber(100)).toBe("100");
      expect(formatAsAbbreviatedNumber(999)).toBe("999");
    });

    test("formats decimals with up to 2 decimal places", () => {
      expect(formatAsAbbreviatedNumber(1.5)).toBe("1.5");
      expect(formatAsAbbreviatedNumber(12.34)).toBe("12.34");
      expect(formatAsAbbreviatedNumber(123.456)).toBe("123.46");
    });

    test("formats negative values", () => {
      expect(formatAsAbbreviatedNumber(-1)).toBe("-1");
      expect(formatAsAbbreviatedNumber(-50)).toBe("-50");
      expect(formatAsAbbreviatedNumber(-999)).toBe("-999");
    });
  });

  describe("large fractionals (0.01-0.99)", () => {
    test("formats with up to 3 decimal places", () => {
      expect(formatAsAbbreviatedNumber(0.1)).toBe("0.1");
      expect(formatAsAbbreviatedNumber(0.01)).toBe("0.01");
      expect(formatAsAbbreviatedNumber(0.123)).toBe("0.123");
      expect(formatAsAbbreviatedNumber(0.9999)).toBe("1");
    });

    test("formats negative large fractionals", () => {
      expect(formatAsAbbreviatedNumber(-0.1)).toBe("-0.1");
      expect(formatAsAbbreviatedNumber(-0.5)).toBe("-0.5");
    });
  });

  describe("small fractionals (< 0.01)", () => {
    test("formats in scientific notation", () => {
      expect(formatAsAbbreviatedNumber(0.001)).toBe("1E-3");
      expect(formatAsAbbreviatedNumber(0.0001)).toBe("1E-4");
      expect(formatAsAbbreviatedNumber(0.00123)).toBe("1.23E-3");
    });

    test("formats negative small fractionals", () => {
      expect(formatAsAbbreviatedNumber(-0.001)).toBe("-1E-3");
      expect(formatAsAbbreviatedNumber(-0.0001)).toBe("-1E-4");
    });
  });

  describe("zero", () => {
    test("formats zero", () => {
      expect(formatAsAbbreviatedNumber(0)).toBe("0");
    });
  });

  describe("edge cases", () => {
    test("handles boundary between K and no suffix", () => {
      expect(formatAsAbbreviatedNumber(999)).toBe("999");
      expect(formatAsAbbreviatedNumber(1000)).toBe("1K");
    });

    test("handles boundary between M and K", () => {
      expect(formatAsAbbreviatedNumber(999_999)).toBe("1,000K");
      expect(formatAsAbbreviatedNumber(1_000_000)).toBe("1M");
    });

    test("handles boundary between B and M", () => {
      expect(formatAsAbbreviatedNumber(999_999_999)).toBe("1,000M");
      expect(formatAsAbbreviatedNumber(1_000_000_000)).toBe("1B");
    });

    test("handles boundary between T and B", () => {
      expect(formatAsAbbreviatedNumber(999_999_999_999)).toBe("1,000B");
      expect(formatAsAbbreviatedNumber(1_000_000_000_000)).toBe("1T");
    });
  });
});
