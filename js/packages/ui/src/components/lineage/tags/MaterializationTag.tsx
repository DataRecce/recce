"use client";

/**
 * @file MaterializationTag.tsx
 * @description Pure presentation component for displaying materialization strategy with icon
 *
 * Shows the materialization type (table, view, incremental, etc.) as a tag with an icon.
 * Uses theme-aware styling for light/dark mode support.
 */

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { memo } from "react";
import { useIsDark } from "../../../hooks/useIsDark";
import { getIconForMaterialization } from "../styles";
import { getTagRootSx, tagStartElementSx } from "./tagStyles";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Data required for MaterializationTag
 */
export interface MaterializationTagData {
  /** The materialization strategy (table, view, incremental, ephemeral, etc.) */
  materialized?: string;
}

/**
 * Props for MaterializationTag component
 */
export interface MaterializationTagProps {
  /** Node data containing the materialization strategy */
  data: MaterializationTagData;
  /** Test ID for testing */
  "data-testid"?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const displayLabels: Record<string, string> = {
  table: "table",
  view: "view",
  incremental: "incremental",
  ephemeral: "ephemeral",
  materialized_view: "mat. view",
};

function getDisplayLabel(materialized?: string): string | undefined {
  if (!materialized) return undefined;
  return displayLabels[materialized] ?? materialized;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * MaterializationTag - Displays the materialization strategy with an icon
 *
 * Shows a pill-shaped tag with an icon representing the materialization strategy
 * (table, view, incremental, ephemeral, etc.).
 *
 * @example
 * ```tsx
 * // Basic usage
 * <MaterializationTag data={{ materialized: "table" }} />
 *
 * // With incremental type
 * <MaterializationTag data={{ materialized: "incremental" }} />
 * ```
 */
function MaterializationTagComponent({
  data,
  "data-testid": testId,
}: MaterializationTagProps) {
  const isDark = useIsDark();
  const { icon: MaterializationIcon } = getIconForMaterialization(
    data.materialized,
  );

  return (
    <Tooltip arrow title="Materialization strategy">
      <Box component="span" sx={getTagRootSx(isDark)} data-testid={testId}>
        {MaterializationIcon && (
          <Box component="span" sx={tagStartElementSx}>
            <MaterializationIcon />
          </Box>
        )}
        {getDisplayLabel(data.materialized)}
      </Box>
    </Tooltip>
  );
}

export const MaterializationTag = memo(MaterializationTagComponent);
MaterializationTag.displayName = "MaterializationTag";
