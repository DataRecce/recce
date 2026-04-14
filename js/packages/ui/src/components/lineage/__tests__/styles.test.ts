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
// getStyleForImpacted Tests
// =============================================================================

describe("getStyleForImpacted", () => {
  it("uses changeStatusColors.impacted as accent color", () => {
    const style = getStyleForImpacted(false);
    expect(style.color).toBe(changeStatusColors.impacted);
    expect(style.hexColor).toBe(changeStatusColors.impacted);
  });

  it("uses same accent color in dark mode", () => {
    const style = getStyleForImpacted(true);
    expect(style.color).toBe(changeStatusColors.impacted);
  });

  it("returns a background color in light mode", () => {
    const style = getStyleForImpacted(false);
    expect(style.backgroundColor).toBeDefined();
  });

  it("returns a background color in dark mode", () => {
    const style = getStyleForImpacted(true);
    expect(style.backgroundColor).toBeDefined();
  });

  it("returns IconImpacted icon", () => {
    const style = getStyleForImpacted(false);
    expect(style.icon).toBe(IconImpacted);
  });
});

// =============================================================================
// getIconForChangeStatus Tests
// =============================================================================

describe("getIconForChangeStatus", () => {
  describe("added status", () => {
    it("returns muted green accent for added status", () => {
      const result = getIconForChangeStatus("added");
      expect(result.color).toBe("rgb(46 160 67)");
      expect(result.hexColor).toBe("rgb(46 160 67)");
    });

    it("returns IconAdded icon for added status", () => {
      const result = getIconForChangeStatus("added");
      expect(result.icon).toBe(IconAdded);
    });

    it("returns light background in light mode", () => {
      const result = getIconForChangeStatus("added", false);
      expect(result.backgroundColor).toBe("rgb(222 248 227)");
    });

    it("returns dark background in dark mode", () => {
      const result = getIconForChangeStatus("added", true);
      expect(result.backgroundColor).toBe("rgb(30 58 30)");
    });
  });

  describe("removed status", () => {
    it("returns muted red accent for removed status", () => {
      const result = getIconForChangeStatus("removed");
      expect(result.color).toBe("rgb(248 81 73)");
      expect(result.hexColor).toBe("rgb(248 81 73)");
    });

    it("returns IconRemoved icon for removed status", () => {
      const result = getIconForChangeStatus("removed");
      expect(result.icon).toBe(IconRemoved);
    });

    it("returns light background in light mode", () => {
      const result = getIconForChangeStatus("removed", false);
      expect(result.backgroundColor).toBe("rgb(252 225 224)");
    });

    it("returns dark background in dark mode", () => {
      const result = getIconForChangeStatus("removed", true);
      expect(result.backgroundColor).toBe("rgb(68 35 35)");
    });
  });

  describe("modified status", () => {
    it("returns brown accent for modified status", () => {
      const result = getIconForChangeStatus("modified");
      expect(result.color).toBe("rgb(212 133 11)"); // brown — distinct from impacted yellow
      expect(result.hexColor).toBe("rgb(212 133 11)");
    });

    it("returns IconModified icon for modified status", () => {
      const result = getIconForChangeStatus("modified");
      expect(result.icon).toBe(IconModified);
    });

    it("returns light background in light mode", () => {
      const result = getIconForChangeStatus("modified", false);
      expect(result.backgroundColor).toBe("rgb(255 237 175)");
    });

    it("returns dark background in dark mode", () => {
      const result = getIconForChangeStatus("modified", true);
      expect(result.backgroundColor).toBe("rgb(75 65 33)");
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
      expect(result.backgroundColor).toBe("rgb(38 38 38)");
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
    it("has muted green for added", () => {
      expect(changeStatusColors.added).toBe("rgb(46 160 67)");
    });

    it("has muted red for removed", () => {
      expect(changeStatusColors.removed).toBe("rgb(248 81 73)");
    });

    it("has brown for modified", () => {
      expect(changeStatusColors.modified).toBe("rgb(212 133 11)");
    });

    it("has yellow for impacted", () => {
      expect(changeStatusColors.impacted).toBe("rgb(252 211 77)");
    });

    it("has neutral gray for unchanged", () => {
      expect(changeStatusColors.unchanged).toBe("#737373");
    });
  });

  describe("changeStatusBackgroundsLight", () => {
    it("has correct background for added", () => {
      expect(changeStatusBackgroundsLight.added).toBe("rgb(222 248 227)");
    });

    it("has correct background for removed", () => {
      expect(changeStatusBackgroundsLight.removed).toBe("rgb(252 225 224)");
    });

    it("has correct background for modified", () => {
      expect(changeStatusBackgroundsLight.modified).toBe("rgb(255 237 175)");
    });

    it("has correct background for impacted", () => {
      expect(changeStatusBackgroundsLight.impacted).toBe("rgb(254 249 227)");
    });

    it("has correct background for unchanged", () => {
      expect(changeStatusBackgroundsLight.unchanged).toBe("#FFFFFF");
    });
  });

  describe("changeStatusBackgroundsDark", () => {
    it("has correct background for added", () => {
      expect(changeStatusBackgroundsDark.added).toBe("rgb(30 58 30)");
    });

    it("has correct background for removed", () => {
      expect(changeStatusBackgroundsDark.removed).toBe("rgb(68 35 35)");
    });

    it("has correct background for modified", () => {
      expect(changeStatusBackgroundsDark.modified).toBe("rgb(75 65 33)");
    });

    it("has correct background for impacted", () => {
      expect(changeStatusBackgroundsDark.impacted).toBe("rgb(50 44 24)");
    });

    it("has correct background for unchanged", () => {
      expect(changeStatusBackgroundsDark.unchanged).toBe("rgb(38 38 38)");
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

  it("IconImpacted is a function component", () => {
    expect(typeof IconImpacted).toBe("function");
  });
});

// =============================================================================
// CSS ↔ JS Color Sync
// =============================================================================
// The JS constants above are hand-synced with the --schema-color-* custom
// properties in ../../schema/style.css. Both sides use the same muted
// palette so the lineage graph, legend, edges, column nodes, and sidebar
// render as one visual system. When updating a color, update both files
// and the expected values in this test — there is no build-time check.
