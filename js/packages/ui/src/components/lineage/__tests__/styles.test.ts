/**
 * @file styles.test.ts
 * @description Tests for lineage styles utilities
 *
 * Tests verify:
 * - getIconForChangeStatus returns correct colors and icons
 * - getIconForResourceType returns correct colors and icons
 * - Style constants are defined correctly
 */

import {
  changeStatusBackgroundsDark,
  changeStatusBackgroundsLight,
  changeStatusColors,
  getIconForChangeStatus,
  getIconForResourceType,
  IconAdded,
  IconExposure,
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
// getIconForChangeStatus Tests
// =============================================================================

describe("getIconForChangeStatus", () => {
  describe("added status", () => {
    it("returns green color for added status", () => {
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
    it("returns red color for removed status", () => {
      const result = getIconForChangeStatus("removed");
      expect(result.color).toBe("#EF4444"); // colors.red[500]
      expect(result.hexColor).toBe("#EF4444");
    });

    it("returns IconRemoved icon for removed status", () => {
      const result = getIconForChangeStatus("removed");
      expect(result.icon).toBe(IconRemoved);
    });

    it("returns light background in light mode", () => {
      const result = getIconForChangeStatus("removed", false);
      expect(result.backgroundColor).toBe("#FECACA"); // colors.red[200]
    });

    it("returns dark background in dark mode", () => {
      const result = getIconForChangeStatus("removed", true);
      expect(result.backgroundColor).toBe("#450A0A"); // colors.red[950]
    });
  });

  describe("modified status", () => {
    it("returns amber color for modified status", () => {
      const result = getIconForChangeStatus("modified");
      expect(result.color).toBe("#F59E0B"); // colors.amber[500]
      expect(result.hexColor).toBe("#F59E0B");
    });

    it("returns IconModified icon for modified status", () => {
      const result = getIconForChangeStatus("modified");
      expect(result.icon).toBe(IconModified);
    });

    it("returns light background in light mode", () => {
      const result = getIconForChangeStatus("modified", false);
      expect(result.backgroundColor).toBe("#FEF3C7"); // colors.amber[100]
    });

    it("returns dark background in dark mode", () => {
      const result = getIconForChangeStatus("modified", true);
      expect(result.backgroundColor).toBe("#78350F"); // colors.amber[900]
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

// =============================================================================
// Style Constants Tests
// =============================================================================

describe("style constants", () => {
  describe("changeStatusColors", () => {
    it("has correct color for added", () => {
      expect(changeStatusColors.added).toBe("#22C55E");
    });

    it("has correct color for removed", () => {
      expect(changeStatusColors.removed).toBe("#EF4444");
    });

    it("has correct color for modified", () => {
      expect(changeStatusColors.modified).toBe("#F59E0B");
    });

    it("has correct color for unchanged", () => {
      expect(changeStatusColors.unchanged).toBe("#737373");
    });
  });

  describe("changeStatusBackgroundsLight", () => {
    it("has correct background for added", () => {
      expect(changeStatusBackgroundsLight.added).toBe("#DCFCE7");
    });

    it("has correct background for removed", () => {
      expect(changeStatusBackgroundsLight.removed).toBe("#FECACA");
    });

    it("has correct background for modified", () => {
      expect(changeStatusBackgroundsLight.modified).toBe("#FEF3C7");
    });

    it("has correct background for unchanged", () => {
      expect(changeStatusBackgroundsLight.unchanged).toBe("#FFFFFF");
    });
  });

  describe("changeStatusBackgroundsDark", () => {
    it("has correct background for added", () => {
      expect(changeStatusBackgroundsDark.added).toBe("#14532D");
    });

    it("has correct background for removed", () => {
      expect(changeStatusBackgroundsDark.removed).toBe("#450A0A");
    });

    it("has correct background for modified", () => {
      expect(changeStatusBackgroundsDark.modified).toBe("#78350F");
    });

    it("has correct background for unchanged", () => {
      expect(changeStatusBackgroundsDark.unchanged).toBe("#404040");
    });
  });
});

// =============================================================================
// Icon Component Tests
// =============================================================================

describe("icon components", () => {
  it("IconAdded is a function component", () => {
    expect(typeof IconAdded).toBe("function");
  });

  it("IconRemoved is a function component", () => {
    expect(typeof IconRemoved).toBe("function");
  });

  it("IconModified is a function component", () => {
    expect(typeof IconModified).toBe("function");
  });

  it("IconModel is a function component", () => {
    expect(typeof IconModel).toBe("function");
  });

  it("IconSource is a function component", () => {
    expect(typeof IconSource).toBe("function");
  });

  it("IconSeed is a function component", () => {
    expect(typeof IconSeed).toBe("function");
  });

  it("IconSnapshot is a function component", () => {
    expect(typeof IconSnapshot).toBe("function");
  });

  it("IconMetric is a function component", () => {
    expect(typeof IconMetric).toBe("function");
  });

  it("IconExposure is a function component", () => {
    expect(typeof IconExposure).toBe("function");
  });

  it("IconSemanticModel is a function component", () => {
    expect(typeof IconSemanticModel).toBe("function");
  });
});
