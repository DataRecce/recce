export type ComparisonRole = "base" | "current";
export type StructuralChangeStatus =
  | "added"
  | "removed"
  | "modified"
  | "unchanged";
export type QuantitativeDirection = "increase" | "decrease" | "equal";

export interface SemanticColorChannel {
  accent: string;
  foreground: string;
  background: string;
  border: string;
  chartFill: string;
}

export interface SemanticColorTheme {
  comparison: Record<ComparisonRole, SemanticColorChannel>;
  structural: {
    neutral: SemanticColorChannel;
    secondaryAccent: Record<StructuralChangeStatus, string>;
  };
  direction: SemanticColorChannel;
  categorical: {
    overlap: SemanticColorChannel & { pattern: "crosshatch" };
  };
}

export const STRUCTURAL_CHANGE_PRESENTATION = {
  added: { symbol: "+", label: "Added" },
  removed: { symbol: "−", label: "Removed" },
  modified: { symbol: "Δ", label: "Modified" },
  unchanged: { symbol: "", label: "Unchanged" },
} as const satisfies Record<
  StructuralChangeStatus,
  { symbol: string; label: string }
>;

export const STRUCTURAL_EDGE_DASH = {
  added: "12 4",
  removed: "3 3",
  modified: "8 3 2 3",
  unchanged: "0",
} as const satisfies Record<StructuralChangeStatus, string>;

const light: SemanticColorTheme = {
  comparison: {
    base: {
      accent: "#F6AD55",
      foreground: "#98471F",
      background: "#FFF3E6",
      border: "#98471F",
      chartFill: "#F6AD55A5",
    },
    current: {
      accent: "#63B3ED",
      foreground: "#245A85",
      background: "#E6F3FC",
      border: "#245A85",
      chartFill: "#63B3EDA5",
    },
  },
  structural: {
    neutral: {
      accent: "#737373",
      foreground: "#262626",
      background: "#FAFAFA",
      border: "#737373",
      chartFill: "#737373A5",
    },
    secondaryAccent: {
      added: "#15803D",
      removed: "#DC2626",
      modified: "#B45309",
      unchanged: "#737373",
    },
  },
  direction: {
    accent: "#737373",
    foreground: "#404040",
    background: "#FAFAFA",
    border: "#737373",
    chartFill: "#737373A5",
  },
  categorical: {
    overlap: {
      accent: "#805AD5",
      foreground: "#553C9A",
      background: "#FAF5FF",
      border: "#553C9A",
      chartFill: "#805AD5A5",
      pattern: "crosshatch",
    },
  },
};

const dark: SemanticColorTheme = {
  comparison: {
    base: {
      accent: "#FBD38D",
      foreground: "#FBD38D",
      background: "#4A2A14",
      border: "#FBD38D",
      chartFill: "#FBD38D66",
    },
    current: {
      accent: "#90CDF4",
      foreground: "#90CDF4",
      background: "#173B57",
      border: "#90CDF4",
      chartFill: "#90CDF466",
    },
  },
  structural: {
    neutral: {
      accent: "#A3A3A3",
      foreground: "#E5E5E5",
      background: "#171717",
      border: "#A3A3A3",
      chartFill: "#A3A3A3A5",
    },
    secondaryAccent: {
      added: "#4ADE80",
      removed: "#F87171",
      modified: "#FCD34D",
      unchanged: "#A3A3A3",
    },
  },
  direction: {
    accent: "#A3A3A3",
    foreground: "#E5E5E5",
    background: "#171717",
    border: "#A3A3A3",
    chartFill: "#A3A3A3A5",
  },
  categorical: {
    overlap: {
      accent: "#B794F4",
      foreground: "#E9D8FD",
      background: "#2D1F47",
      border: "#B794F4",
      chartFill: "#B794F4A5",
      pattern: "crosshatch",
    },
  },
};

export function getSemanticColorTheme(isDark: boolean): SemanticColorTheme {
  return isDark ? dark : light;
}

/**
 * Composite a hex color that may carry an alpha channel over an opaque hex
 * background and return the resulting `[r, g, b]` channel values.
 *
 * This is the one place the alpha-flattening math lives. The histogram
 * crosshatch needs the color a translucent `chartFill` actually resolves to on
 * screen, and the contrast tests need the same value to check it, so neither
 * keeps a private copy.
 */
export function compositeRgbChannels(
  foreground: string,
  background: string,
): [number, number, number] {
  const parseRgb = (value: string) =>
    [1, 3, 5].map((index) =>
      Number.parseInt(value.slice(index, index + 2), 16),
    );
  const foregroundRgb = parseRgb(foreground);
  const backgroundRgb = parseRgb(background);
  const alpha =
    foreground.length >= 9
      ? Number.parseInt(foreground.slice(7, 9), 16) / 255
      : 1;
  const [red, green, blue] = foregroundRgb.map((channel, index) =>
    Math.round(channel * alpha + backgroundRgb[index] * (1 - alpha)),
  );
  return [red, green, blue];
}

/**
 * {@link compositeRgbChannels} formatted as the space-separated `rgb()` string
 * used for colors across the codebase.
 */
export function compositeHex(foreground: string, background: string): string {
  return `rgb(${compositeRgbChannels(foreground, background).join(" ")})`;
}
