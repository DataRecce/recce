/**
 * @file tagStyles.test.ts
 * @description Tests for tag styling utilities
 *
 * Tests verify:
 * - getTagRootSx returns correct styles for light/dark mode
 * - tagStartElementSx provides consistent spacing
 */

import { getTagRootSx, tagStartElementSx } from "../tagStyles";

describe("tagStyles", () => {
  describe("getTagRootSx", () => {
    it("returns light mode styles when isDark is false", () => {
      const styles = getTagRootSx(false);

      expect(styles).toMatchObject({
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 16,
        px: 1,
        py: 0.25,
        fontSize: "0.75rem",
        bgcolor: "grey.100",
        color: "inherit",
      });
    });

    it("returns dark mode styles when isDark is true", () => {
      const styles = getTagRootSx(true);

      expect(styles).toMatchObject({
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 16,
        px: 1,
        py: 0.25,
        fontSize: "0.75rem",
        bgcolor: "grey.700",
        color: "grey.100",
      });
    });
  });

  describe("tagStartElementSx", () => {
    it("provides consistent spacing and alignment", () => {
      expect(tagStartElementSx).toMatchObject({
        mr: 0.5,
        display: "flex",
        alignItems: "center",
      });
    });
  });
});
