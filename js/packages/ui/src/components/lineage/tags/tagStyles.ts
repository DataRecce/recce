/**
 * @file tagStyles.ts
 * @description Shared styling utilities for lineage node tags
 *
 * Provides reusable styles for tag components that display information
 * in lineage graph nodes (resource type, row count, etc.).
 *
 * Source: Extracted from OSS js/src/components/lineage/NodeTag.tsx
 */

import type { SxProps, Theme } from "@mui/material/styles";

/**
 * Get root styles for tag components
 *
 * Creates a pill-shaped container with theme-aware colors.
 *
 * @param isDark - Whether dark mode is active
 * @returns SxProps for the tag container
 *
 * @example
 * ```tsx
 * const isDark = useIsDark();
 * <Box sx={getTagRootSx(isDark)}>Tag content</Box>
 * ```
 */
export const getTagRootSx = (isDark: boolean): SxProps<Theme> => ({
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 16,
  px: 1,
  py: 0.25,
  fontSize: "0.75rem",
  bgcolor: isDark ? "grey.700" : "grey.100",
  color: isDark ? "grey.100" : "inherit",
});

/**
 * Styles for the leading element (icon) in a tag
 *
 * Provides consistent spacing and alignment for icons at the start of tags.
 *
 * @example
 * ```tsx
 * <Box sx={tagStartElementSx}>
 *   <MyIcon />
 * </Box>
 * ```
 */
export const tagStartElementSx: SxProps<Theme> = {
  mr: 0.5,
  display: "flex",
  alignItems: "center",
};
