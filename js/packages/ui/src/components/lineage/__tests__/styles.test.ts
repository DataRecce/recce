/**
 * @file styles.test.ts
 * @description Tests for lineage styles utilities
 *
 * Tests verify:
 * - getIconForChangeStatus returns correct colors and icons for both palettes
 * - getStyleForImpacted uses the CLL palette
 * - getIconForResourceType returns correct colors and icons
 */

import { getSemanticColorTheme } from "../../../theme";
import {
  getIconForChangeStatus,
  getIconForResourceType,
  getStyleForImpacted,
  IconAdded,
  IconExposure,
  IconImpacted,
  IconMetric,
  IconModel,
  IconModified,
  IconRemoved,
  IconSeed,
  IconSemanticModel,
  IconSnapshot,
  IconSource,
} from "../styles";

// =============================================================================
// getStyleForImpacted Tests (CLL-only)
// =============================================================================

describe("getStyleForImpacted", () => {
  it("uses cllChangeStatusColors.impacted as accent color", () => {
    const style = getStyleForImpacted(false);
    expect(style.color).toBe("rgb(252 211 77)");
    expect(style.hexColor).toBe("rgb(252 211 77)");
  });

  it("uses same accent color in dark mode", () => {
    const style = getStyleForImpacted(true);
    expect(style.color).toBe("rgb(252 211 77)");
  });

  it("returns a background color in light mode", () => {
    const style = getStyleForImpacted(false);
    expect(style.backgroundColor).toBe("rgb(254 249 227)");
  });

  it("returns a background color in dark mode", () => {
    const style = getStyleForImpacted(true);
    expect(style.backgroundColor).toBe("rgb(50 44 24)");
  });

  it("returns IconImpacted icon", () => {
    const style = getStyleForImpacted(false);
    expect(style.icon).toBe(IconImpacted);
  });
});

// =============================================================================
// getIconForChangeStatus Tests (default Tailwind palette)
// =============================================================================

describe("getIconForChangeStatus (semantic structural palette)", () => {
  it.each([false, true])(
    "uses a neutral surface with only a secondary status accent when isDark=%s",
    (isDark) => {
      const semantic = getSemanticColorTheme(isDark);

      for (const status of ["added", "removed", "modified"] as const) {
        const result = getIconForChangeStatus(status, isDark);

        expect(result.color).toBe(semantic.structural.neutral.border);
        expect(result.backgroundColor).toBe(
          semantic.structural.neutral.background,
        );
        expect(result.borderColor).toBe(semantic.structural.neutral.border);
        expect(result.secondaryAccent).toBe(
          semantic.structural.secondaryAccent[status],
        );
      }
    },
  );

  describe("added status", () => {
    it("returns the neutral border for added status", () => {
      const result = getIconForChangeStatus("added");
      expect(result.color).toBe("#737373");
      expect(result.hexColor).toBe("#737373");
    });

    it("returns IconAdded icon for added status", () => {
      const result = getIconForChangeStatus("added");
      expect(result.icon).toBe(IconAdded);
    });

    it("returns a neutral light background in light mode", () => {
      const result = getIconForChangeStatus("added", false);
      expect(result.backgroundColor).toBe("#FAFAFA");
    });

    it("returns a neutral dark background in dark mode", () => {
      const result = getIconForChangeStatus("added", true);
      expect(result.backgroundColor).toBe("#171717");
    });
  });

  describe("removed status", () => {
    it("returns the neutral border for removed status", () => {
      const result = getIconForChangeStatus("removed");
      expect(result.color).toBe("#737373");
    });

    it("returns IconRemoved icon for removed status", () => {
      const result = getIconForChangeStatus("removed");
      expect(result.icon).toBe(IconRemoved);
    });
  });

  describe("modified status", () => {
    it("returns the neutral border for modified status", () => {
      const result = getIconForChangeStatus("modified");
      expect(result.color).toBe("#737373");
    });

    it("returns IconModified icon for modified status", () => {
      const result = getIconForChangeStatus("modified");
      expect(result.icon).toBe(IconModified);
    });
  });

  describe("undefined/default status", () => {
    it("returns the neutral border when no status is provided", () => {
      const result = getIconForChangeStatus(undefined);
      expect(result.color).toBe("#737373");
      expect(result.hexColor).toBe("#737373");
    });

    it("returns undefined icon when no status provided", () => {
      const result = getIconForChangeStatus(undefined);
      expect(result.icon).toBeUndefined();
    });

    it("returns a neutral background in light mode when no status", () => {
      const result = getIconForChangeStatus(undefined, false);
      expect(result.backgroundColor).toBe("#FAFAFA");
    });

    it("returns a neutral background in dark mode when no status", () => {
      const result = getIconForChangeStatus(undefined, true);
      expect(result.backgroundColor).toBe("#171717");
    });
  });
});

// =============================================================================
// getIconForChangeStatus with palette: "cll" (muted CLL palette)
// =============================================================================

describe('getIconForChangeStatus (legacy palette: "cll")', () => {
  it("does not remap structural added status into the CLL palette", () => {
    const result = getIconForChangeStatus("added", false, "cll");
    expect(result.color).toBe("#737373");
    expect(result.secondaryAccent).toBe("#15803D");
  });

  it("does not remap structural removed status into the CLL palette", () => {
    const result = getIconForChangeStatus("removed", false, "cll");
    expect(result.color).toBe("#737373");
    expect(result.secondaryAccent).toBe("#DC2626");
  });

  it("does not remap structural modified status into the CLL palette", () => {
    const result = getIconForChangeStatus("modified", false, "cll");
    expect(result.color).toBe("#737373");
    expect(result.secondaryAccent).toBe("#B45309");
  });

  it("returns a neutral background in light mode", () => {
    const result = getIconForChangeStatus("added", false, "cll");
    expect(result.backgroundColor).toBe("#FAFAFA");
  });

  it("returns a neutral background in dark mode", () => {
    const result = getIconForChangeStatus("modified", true, "cll");
    expect(result.backgroundColor).toBe("#171717");
  });
});

// =============================================================================
// getIconForResourceType Tests
// =============================================================================

describe("getIconForResourceType", () => {
  it("returns IconModel for model type", () => {
    const result = getIconForResourceType("model");
    expect(result.icon).toBe(IconModel);
    expect(result.color).toBe("#A5F3FC"); // colors.cyan[200]
  });

  it("returns IconSource for source type", () => {
    const result = getIconForResourceType("source");
    expect(result.icon).toBe(IconSource);
    expect(result.color).toBe("#86EFAC"); // colors.green[300]
  });

  it("returns IconSeed for seed type", () => {
    const result = getIconForResourceType("seed");
    expect(result.icon).toBe(IconSeed);
    expect(result.color).toBe("#22C55E"); // colors.green[500]
  });

  it("returns IconSnapshot for snapshot type", () => {
    const result = getIconForResourceType("snapshot");
    expect(result.icon).toBe(IconSnapshot);
    expect(result.color).toBe("#22C55E"); // colors.green[500]
  });

  it("returns IconMetric for metric type", () => {
    const result = getIconForResourceType("metric");
    expect(result.icon).toBe(IconMetric);
    expect(result.color).toBe("#FECDD3"); // colors.rose[200]
  });

  it("returns IconExposure for exposure type", () => {
    const result = getIconForResourceType("exposure");
    expect(result.icon).toBe(IconExposure);
    expect(result.color).toBe("#FECDD3"); // colors.rose[200]
  });

  it("returns IconSemanticModel for semantic_model type", () => {
    const result = getIconForResourceType("semantic_model");
    expect(result.icon).toBe(IconSemanticModel);
    expect(result.color).toBe("#FB7185"); // colors.rose[400]
  });

  it("returns undefined icon for unknown type", () => {
    const result = getIconForResourceType("unknown");
    expect(result.icon).toBeUndefined();
    expect(result.color).toBe("inherit");
  });

  it("returns undefined icon when no type provided", () => {
    const result = getIconForResourceType(undefined);
    expect(result.icon).toBeUndefined();
    expect(result.color).toBe("inherit");
  });
});
