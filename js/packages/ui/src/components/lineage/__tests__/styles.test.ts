/**
 * @file styles.test.ts
 * @description Tests for lineage styles utilities
 *
 * Tests verify:
 * - getIconForChangeStatus returns correct colors and icons for both palettes
 * - getStyleForImpacted uses the CLL palette
 * - getIconForResourceType returns correct colors and icons
 */

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

describe("getIconForChangeStatus (default palette)", () => {
  describe("added status", () => {
    it("returns Tailwind green for added status", () => {
      const result = getIconForChangeStatus("added");
      expect(result.color).toBe("#22C55E"); // colors.green[500]
      expect(result.hexColor).toBe("#22C55E");
    });

    it("returns IconAdded icon for added status", () => {
      const result = getIconForChangeStatus("added");
      expect(result.icon).toBe(IconAdded);
    });

    it("returns light background in light mode", () => {
      const result = getIconForChangeStatus("added", false);
      expect(result.backgroundColor).toBe("#DCFCE7"); // colors.green[100]
    });

    it("returns dark background in dark mode", () => {
      const result = getIconForChangeStatus("added", true);
      expect(result.backgroundColor).toBe("#14532D"); // colors.green[900]
    });
  });

  describe("removed status", () => {
    it("returns Tailwind red for removed status", () => {
      const result = getIconForChangeStatus("removed");
      expect(result.color).toBe("#EF4444"); // colors.red[500]
    });

    it("returns IconRemoved icon for removed status", () => {
      const result = getIconForChangeStatus("removed");
      expect(result.icon).toBe(IconRemoved);
    });
  });

  describe("modified status", () => {
    it("returns Tailwind amber for modified status", () => {
      const result = getIconForChangeStatus("modified");
      expect(result.color).toBe("#F59E0B"); // colors.amber[500]
    });

    it("returns IconModified icon for modified status", () => {
      const result = getIconForChangeStatus("modified");
      expect(result.icon).toBe(IconModified);
    });
  });

  describe("undefined/default status", () => {
    it("returns gray color when no status provided", () => {
      const result = getIconForChangeStatus(undefined);
      expect(result.color).toBe("#737373"); // colors.neutral[500]
      expect(result.hexColor).toBe("#737373");
    });

    it("returns undefined icon when no status provided", () => {
      const result = getIconForChangeStatus(undefined);
      expect(result.icon).toBeUndefined();
    });

    it("returns white background in light mode when no status", () => {
      const result = getIconForChangeStatus(undefined, false);
      expect(result.backgroundColor).toBe("#FFFFFF");
    });

    it("returns dark background in dark mode when no status", () => {
      const result = getIconForChangeStatus(undefined, true);
      expect(result.backgroundColor).toBe("#404040"); // colors.neutral[700]
    });
  });
});

// =============================================================================
// getIconForChangeStatus with palette: "cll" (muted CLL palette)
// =============================================================================

describe('getIconForChangeStatus (palette: "cll")', () => {
  it("returns muted green for added", () => {
    const result = getIconForChangeStatus("added", false, "cll");
    expect(result.color).toBe("rgb(46 160 67)");
  });

  it("returns muted red for removed", () => {
    const result = getIconForChangeStatus("removed", false, "cll");
    expect(result.color).toBe("rgb(248 81 73)");
  });

  it("returns brown for modified (distinct from impacted yellow)", () => {
    const result = getIconForChangeStatus("modified", false, "cll");
    expect(result.color).toBe("rgb(212 133 11)");
  });

  it("returns light background in light mode for added", () => {
    const result = getIconForChangeStatus("added", false, "cll");
    expect(result.backgroundColor).toBe("rgb(222 248 227)");
  });

  it("returns dark background in dark mode for modified", () => {
    const result = getIconForChangeStatus("modified", true, "cll");
    expect(result.backgroundColor).toBe("rgb(75 65 33)");
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
