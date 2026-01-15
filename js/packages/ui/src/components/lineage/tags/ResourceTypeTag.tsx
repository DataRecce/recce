"use client";

/**
 * @file ResourceTypeTag.tsx
 * @description Pure presentation component for displaying resource type with icon
 *
 * Shows the resource type (model, source, seed, etc.) as a tag with an icon.
 * Uses theme-aware styling for light/dark mode support.
 *
 * Source: Migrated from OSS js/src/components/lineage/NodeTag.tsx
 */

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { memo } from "react";
import { useIsDark } from "../../../hooks/useIsDark";
import { getIconForResourceType } from "../styles";
import { getTagRootSx, tagStartElementSx } from "./tagStyles";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Data required for ResourceTypeTag
 */
export interface ResourceTypeTagData {
  /** The resource type to display (model, source, seed, snapshot, etc.) */
  resourceType?: string;
}

/**
 * Props for ResourceTypeTag component
 */
export interface ResourceTypeTagProps {
  /** Node data containing the resource type */
  data: ResourceTypeTagData;
  /** Test ID for testing */
  "data-testid"?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * ResourceTypeTag - Displays the resource type with an icon
 *
 * Shows a pill-shaped tag with an icon representing the resource type
 * (model, source, seed, snapshot, metric, exposure, semantic_model).
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ResourceTypeTag data={{ resourceType: "model" }} />
 *
 * // With snapshot type
 * <ResourceTypeTag data={{ resourceType: "snapshot" }} />
 * ```
 */
function ResourceTypeTagComponent({
  data,
  "data-testid": testId,
}: ResourceTypeTagProps) {
  const isDark = useIsDark();
  const { icon: ResourceTypeIcon } = getIconForResourceType(data.resourceType);

  return (
    <Tooltip arrow title="Type of resource">
      <Box component="span" sx={getTagRootSx(isDark)} data-testid={testId}>
        {ResourceTypeIcon && (
          <Box component="span" sx={tagStartElementSx}>
            <ResourceTypeIcon />
          </Box>
        )}
        {data.resourceType}
      </Box>
    </Tooltip>
  );
}

export const ResourceTypeTag = memo(ResourceTypeTagComponent);
ResourceTypeTag.displayName = "ResourceTypeTag";
