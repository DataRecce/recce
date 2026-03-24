"use client";

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { memo } from "react";
import { useIsDark } from "../../../hooks/useIsDark";
import { getIconForMaterialization, getIconForResourceType } from "../styles";
import { getTagRootSx, tagStartElementSx } from "./tagStyles";

export interface NodeTagProps {
  resourceType?: string;
  materialized?: string;
  "data-testid"?: string;
}

const materializationLabels: Record<string, string> = {
  table: "table",
  view: "view",
  incremental: "incremental",
  ephemeral: "ephemeral",
  materialized_view: "mat. view",
  dynamic_table: "dyn. table",
  streaming_table: "stream. table",
};

function getMaterializationLabel(materialized: string): string {
  return materializationLabels[materialized] ?? materialized;
}

function NodeTagComponent({
  resourceType,
  materialized,
  "data-testid": testId,
}: NodeTagProps) {
  const isDark = useIsDark();

  const showMaterialization = resourceType === "model" && materialized;

  const { icon: Icon } = showMaterialization
    ? getIconForMaterialization(materialized)
    : getIconForResourceType(resourceType);

  const label = showMaterialization
    ? getMaterializationLabel(materialized)
    : resourceType;

  const tooltip = showMaterialization
    ? "Materialization strategy"
    : "Type of resource";

  return (
    <Tooltip arrow title={tooltip}>
      <Box component="span" sx={getTagRootSx(isDark)} data-testid={testId}>
        {Icon && (
          <Box component="span" sx={tagStartElementSx}>
            <Icon aria-hidden="true" />
          </Box>
        )}
        {label}
      </Box>
    </Tooltip>
  );
}

export const NodeTag = memo(NodeTagComponent);
NodeTag.displayName = "NodeTag";
