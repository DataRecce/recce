import { getContrastRatio } from "@mui/material/styles";
import {
  getSemanticColorTheme,
  STRUCTURAL_CHANGE_PRESENTATION,
} from "../semanticColors";

function compositeHex(foreground: string, background: string): string {
  const parse = (value: string) =>
    [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
  const foregroundRgb = parse(foreground);
  const backgroundRgb = parse(background);
  const alpha = Number.parseInt(foreground.slice(7, 9), 16) / 255;
  return `rgb(${foregroundRgb
    .map((channel, i) =>
      Math.round(channel * alpha + backgroundRgb[i] * (1 - alpha)),
    )
    .join(", ")})`;
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
