"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

/**
 * Legend item for change status
 */
export interface ChangeStatusLegendItem {
  status: "added" | "removed" | "modified";
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
}

/**
 * Default change status items
 */
const defaultChangeStatusItems: ChangeStatusLegendItem[] = [
  { status: "added", label: "Added", description: "Newly added resource" },
  { status: "removed", label: "Removed", description: "Removed resource" },
  { status: "modified", label: "Modified", description: "Modified resource" },
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
 * Colors for change status indicators
 */
const changeStatusStyles: Record<string, { color: string; symbol: string }> = {
  added: { color: "#22c55e", symbol: "+" },
  removed: { color: "#ef4444", symbol: "-" },
  modified: { color: "#f59e0b", symbol: "~" },
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
}: {
  status: "added" | "removed" | "modified";
}) {
  const style = changeStatusStyles[status];
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
}: LineageLegendProps) {
  const items =
    variant === "changeStatus"
      ? defaultChangeStatusItems
      : defaultTransformationItems;

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
              <ChangeStatusIcon status={item.status} />
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
