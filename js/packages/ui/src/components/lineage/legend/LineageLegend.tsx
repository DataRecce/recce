"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { changeStatusColors, cllChangeStatusColors } from "../styles";

/**
 * Legend item for change status
 */
export interface ChangeStatusLegendItem {
  status: "added" | "removed" | "modified" | "impacted";
  label: string;
  description?: string;
}

/**
 * Legend item for transformation type
 */
export interface TransformationLegendItem {
  type: "passthrough" | "renamed" | "derived" | "source" | "unknown";
  label: string;
  description?: string;
}

/**
 * Props for the LineageLegend component
 */
export interface LineageLegendProps {
  /**
   * Type of legend to display
   */
  variant: "changeStatus" | "transformation";

  /**
   * Whether to show tooltips on hover
   * @default true
   */
  showTooltips?: boolean;

  /**
   * Optional title for the legend
   */
  title?: string;

  /**
   * CSS class name for additional styling
   */
  className?: string;

  /**
   * When true, render the muted CLL palette and include the "Impacted" entry.
   * When false (default), render the original Tailwind palette and omit
   * "Impacted" — matching the legend OSS users have always seen.
   * @default false
   */
  newCllExperience?: boolean;
}

/**
 * Default change status items
 */
const defaultChangeStatusItems: ChangeStatusLegendItem[] = [
  { status: "added", label: "Added", description: "Newly added resource" },
  { status: "removed", label: "Removed", description: "Removed resource" },
  { status: "modified", label: "Modified", description: "Modified resource" },
  {
    status: "impacted",
    label: "Impacted",
    description: "Downstream of a modified resource",
  },
];

/**
 * Default transformation items
 */
const defaultTransformationItems: TransformationLegendItem[] = [
  {
    type: "passthrough",
    label: "Passthrough",
    description: "Column passes through unchanged",
  },
  {
    type: "renamed",
    label: "Renamed",
    description: "Column was renamed from source",
  },
  {
    type: "derived",
    label: "Derived",
    description: "Column is derived from other columns",
  },
  { type: "source", label: "Source", description: "Original source column" },
  {
    type: "unknown",
    label: "Unknown",
    description: "Transformation type could not be determined",
  },
];

/**
 * Colors and symbols for change status indicators (default Tailwind palette).
 */
const changeStatusStyles: Record<string, { color: string; symbol: string }> = {
  added: { color: changeStatusColors.added, symbol: "+" },
  removed: { color: changeStatusColors.removed, symbol: "-" },
  modified: { color: changeStatusColors.modified, symbol: "~" },
};

/**
 * Colors and symbols for change status indicators (CLL muted palette).
 */
const cllChangeStatusStyles: Record<string, { color: string; symbol: string }> =
  {
    added: { color: cllChangeStatusColors.added, symbol: "+" },
    removed: { color: cllChangeStatusColors.removed, symbol: "-" },
    modified: { color: cllChangeStatusColors.modified, symbol: "~" },
    impacted: { color: cllChangeStatusColors.impacted, symbol: "!" },
  };

/**
 * Colors for transformation type chips
 */
const transformationStyles: Record<
  string,
  { letter: string; color: "default" | "warning" | "info" | "error" }
> = {
  passthrough: { letter: "P", color: "default" },
  renamed: { letter: "R", color: "warning" },
  derived: { letter: "D", color: "warning" },
  source: { letter: "S", color: "info" },
  unknown: { letter: "U", color: "error" },
};

/**
 * ChangeStatusIcon - Renders a change status indicator
 */
function ChangeStatusIcon({
  status,
  newCllExperience,
}: {
  status: "added" | "removed" | "modified" | "impacted";
  newCllExperience: boolean;
}) {
  const style = (newCllExperience ? cllChangeStatusStyles : changeStatusStyles)[
    status
  ];
  return (
    <Box
      sx={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        backgroundColor: style.color,
        color: "white",
        fontSize: 10,
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {style.symbol}
    </Box>
  );
}

/**
 * TransformationChip - Renders a transformation type chip
 */
function TransformationChip({
  type,
}: {
  type: "passthrough" | "renamed" | "derived" | "source" | "unknown";
}) {
  const style = transformationStyles[type];
  return (
    <Chip
      label={style.letter}
      size="small"
      color={style.color}
      sx={{
        fontSize: "8pt",
        height: 18,
        minWidth: 18,
        "& .MuiChip-label": {
          px: 0.5,
        },
      }}
    />
  );
}

/**
 * LineageLegend Component
 *
 * A pure presentation component for displaying legends in lineage visualizations.
 * Supports both change status legends (added/removed/modified) and
 * transformation type legends (passthrough/renamed/derived/source/unknown).
 *
 * @example Change status legend
 * ```tsx
 * import { LineageLegend } from '@datarecce/ui/primitives';
 *
 * function MyLineageGraph() {
 *   return (
 *     <div style={{ position: 'relative' }}>
 *       <ReactFlow nodes={nodes} edges={edges} />
 *       <div style={{ position: 'absolute', bottom: 10, right: 10 }}>
 *         <LineageLegend variant="changeStatus" title="Changes" />
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Transformation type legend
 * ```tsx
 * import { LineageLegend } from '@datarecce/ui/primitives';
 *
 * function ColumnLineageGraph() {
 *   return (
 *     <div>
 *       <ReactFlow nodes={columnNodes} edges={edges} />
 *       <LineageLegend variant="transformation" />
 *     </div>
 *   );
 * }
 * ```
 */
export function LineageLegend({
  variant,
  showTooltips = true,
  title,
  className,
  newCllExperience = false,
}: LineageLegendProps) {
  const changeStatusItems = newCllExperience
    ? defaultChangeStatusItems
    : defaultChangeStatusItems.filter((item) => item.status !== "impacted");
  const items =
    variant === "changeStatus" ? changeStatusItems : defaultTransformationItems;

  return (
    <Box
      className={className}
      sx={{
        bgcolor: "background.paper",
        padding: "12px",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        fontSize: "0.875rem",
      }}
    >
      {title && (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            fontWeight: 600,
            mb: 1,
            color: "text.secondary",
          }}
        >
          {title}
        </Typography>
      )}

      {variant === "changeStatus" &&
        (items as ChangeStatusLegendItem[]).map((item) => {
          const content = (
            <Box
              key={item.status}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                mb: "4px",
                "&:last-child": { mb: 0 },
              }}
            >
              <ChangeStatusIcon
                status={item.status}
                newCllExperience={newCllExperience}
              />
              <Typography variant="body2">{item.label}</Typography>
            </Box>
          );

          return showTooltips && item.description ? (
            <Tooltip
              key={item.status}
              title={item.description}
              placement="right"
            >
              {content}
            </Tooltip>
          ) : (
            content
          );
        })}

      {variant === "transformation" &&
        (items as TransformationLegendItem[]).map((item) => {
          const content = (
            <Box
              key={item.type}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                mb: "4px",
                "&:last-child": { mb: 0 },
              }}
            >
              <TransformationChip type={item.type} />
              <Typography variant="body2">{item.label}</Typography>
            </Box>
          );

          return showTooltips && item.description ? (
            <Tooltip key={item.type} title={item.description} placement="right">
              {content}
            </Tooltip>
          ) : (
            content
          );
        })}
    </Box>
  );
}
