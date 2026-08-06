import { getComparisonThemeColors } from "../chartTheme";

describe("getComparisonThemeColors", () => {
  test("uses current blue and base orange in light mode", () => {
    expect(getComparisonThemeColors(false)).toEqual({
      current: {
        accent: "#63B3ED",
        background: "#E6F3FC",
        foreground: "#245A85",
      },
      base: {
        accent: "#F6AD55",
        background: "#FFF3E6",
        foreground: "#98471F",
      },
    });
  });

  test("keeps the same semantics with brighter accents in dark mode", () => {
    expect(getComparisonThemeColors(true)).toEqual({
      current: {
        accent: "#90CDF4",
        background: "#173B57",
        foreground: "#90CDF4",
      },
      base: {
        accent: "#FBD38D",
        background: "#4A2A14",
        foreground: "#FBD38D",
      },
    });
  });
});
