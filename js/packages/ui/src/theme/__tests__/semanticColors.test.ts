import { getContrastRatio } from "@mui/material/styles";
import {
  getSemanticColorTheme,
  STRUCTURAL_CHANGE_PRESENTATION,
} from "../semanticColors";

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

  test.each(["added", "removed", "modified", "unchanged"] as const)(
    "%s secondary accent has non-text contrast",
    (status) => {
      expect(
        getContrastRatio(
          semantic.structural.secondaryAccent[status],
          semantic.structural.neutral.background,
        ),
      ).toBeGreaterThanOrEqual(3);
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
