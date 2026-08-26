import { getContrastRatio } from "@mui/material/styles";
import {
  compositeRgbChannels,
  getSemanticColorTheme,
  STRUCTURAL_CHANGE_PRESENTATION,
} from "../semanticColors";

/**
 * The shipped composite math, formatted for MUI. `compositeRgbChannels` is the
 * function the histogram crosshatch uses, so drift in it fails these tests.
 * Only the separator differs: `decomposeColor` splits `rgb()` on commas, so the
 * space-separated form the canvas takes would parse as NaN here.
 */
function compositeHex(foreground: string, background: string): string {
  return `rgb(${compositeRgbChannels(foreground, background).join(", ")})`;
}

describe.each([false, true])("semantic colors, dark=%s", (isDark) => {
  const semantic = getSemanticColorTheme(isDark);

  test("comparison roles are Base and Current", () => {
    expect(Object.keys(semantic.comparison).sort()).toEqual([
      "base",
      "current",
    ]);
  });

  test.each(["base", "current"] as const)(
    "%s text and border meet contrast requirements",
    (role) => {
      const token = semantic.comparison[role];
      expect(
        getContrastRatio(token.foreground, token.background),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(token.border, token.background),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  test("direction does not alias comparison accents", () => {
    expect(semantic.direction.foreground).not.toBe(
      semantic.comparison.base.foreground,
    );
    expect(semantic.direction.foreground).not.toBe(
      semantic.comparison.current.foreground,
    );
  });

  test("categorical overlap has a contrast-safe crosshatch", () => {
    const overlap = semantic.categorical.overlap;
    const compositedFill = compositeHex(
      overlap.chartFill,
      semantic.structural.neutral.background,
    );

    expect(overlap.pattern).toBe("crosshatch");
    expect(
      getContrastRatio(overlap.foreground, compositedFill),
    ).toBeGreaterThanOrEqual(3);
  });

  test.each(["base", "current"] as const)(
    "%s chart outline contrasts with its composited fill",
    (role) => {
      const token = semantic.comparison[role];
      const compositedFill = compositeHex(
        token.chartFill,
        semantic.structural.neutral.background,
      );

      expect(
        getContrastRatio(token.border, compositedFill),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  test.each(["added", "removed", "modified", "unchanged"] as const)(
    "%s secondary accent has non-text contrast across compound surfaces",
    (status) => {
      const backgrounds = [
        semantic.structural.neutral.background,
        semantic.comparison.base.background,
        semantic.comparison.current.background,
        ...(isDark ? [] : ["#F5F5F5", "#E5E5E5"]),
      ];

      for (const background of backgrounds) {
        expect(
          getContrastRatio(
            semantic.structural.secondaryAccent[status],
            background,
          ),
        ).toBeGreaterThanOrEqual(3);
      }
    },
  );
});

test("structural meanings have redundant symbols and labels", () => {
  expect(STRUCTURAL_CHANGE_PRESENTATION).toEqual({
    added: { symbol: "+", label: "Added" },
    removed: { symbol: "−", label: "Removed" },
    modified: { symbol: "Δ", label: "Modified" },
    unchanged: { symbol: "", label: "Unchanged" },
  });
});
