"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useIsDark } from "../../../hooks/useIsDark";
import { StructuralChangeIndicator } from "../../ui/StructuralChangeIndicator";
import {
  CHANGE_CATEGORY_DETAILS,
  CHANGE_CATEGORY_LABELS,
} from "../changeCategory";
import {
  COLUMN_TRANSFORMATION_DETAILS,
  COLUMN_TRANSFORMATION_ORDER,
  type ColumnTransformationType,
} from "../columnTransformation";
import { cllImpactedAccent } from "../styles";
import { TreatmentChip } from "../TreatmentChip";
import { getGraphBadgeLegendEntries } from "../wholeModelTreatment";

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
  type: ColumnTransformationType;
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
   * When true, render the muted CLL palette, include the "Impacted" entry,
   * and document the graph badges the canvas nodes carry. When false
   * (default), render the original Tailwind palette and omit both — matching
   * the legend OSS users have always seen.
   * @default false
   */
  newCllExperience?: boolean;

  /**
   * Transformation types represented by chips in the displayed column chain.
   * When omitted, all transformation types are shown.
   */
  transformationTypes?: readonly ColumnTransformationType[];
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
const defaultTransformationItems: TransformationLegendItem[] =
  COLUMN_TRANSFORMATION_ORDER.map((type) => ({
    type,
    label: COLUMN_TRANSFORMATION_DETAILS[type].label,
    description: COLUMN_TRANSFORMATION_DETAILS[type].description,
  }));

/**
 * Colors and symbols for change status indicators (default Tailwind palette).
 */
/**
 * ChangeStatusIcon - Renders a change status indicator
 */
function ChangeStatusIcon({
  status,
  isDark,
}: {
  status: "added" | "removed" | "modified" | "impacted";
  isDark: boolean;
}) {
  if (status !== "impacted") {
    return (
      <StructuralChangeIndicator
        status={status}
        emphasis="secondary"
        size="sm"
      />
    );
  }

  return (
    <Box
      aria-label="Impacted change"
      sx={{
        width: 16,
        height: 16,
        color: isDark ? cllImpactedAccent.dark : cllImpactedAccent.light,
        fontSize: "0.875rem",
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span aria-hidden="true">!</span>
    </Box>
  );
}

/**
 * TransformationChip - Renders a transformation type chip
 */
function TransformationChip({ type }: { type: ColumnTransformationType }) {
  const details = COLUMN_TRANSFORMATION_DETAILS[type];
  return (
    <Chip
      aria-label={`${details.label} transformation: ${details.description}`}
      label={details.letter}
      size="small"
      color={details.color}
      sx={{
        fontSize: "0.6667rem",
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
 * A presentation component for displaying legends in lineage visualizations.
 * Supports both change status legends (added/removed/modified) and
 * transformation type legends (passthrough/renamed/derived/source/unknown).
 *
 * Takes its colour mode from `useIsDark` rather than a prop, so the badge
 * swatches pick the same light/dark tokens the graph badges do.
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
  transformationTypes,
}: LineageLegendProps) {
  const isDark = useIsDark();
  const changeStatusItems = newCllExperience
    ? defaultChangeStatusItems
    : defaultChangeStatusItems.filter((item) => item.status !== "impacted");
  const displayedTransformationTypes = transformationTypes
    ? new Set(transformationTypes)
    : undefined;
  const transformationItems = displayedTransformationTypes
    ? defaultTransformationItems.filter((item) =>
        displayedTransformationTypes.has(item.type),
      )
    : defaultTransformationItems;
  const items =
    variant === "changeStatus" ? changeStatusItems : transformationItems;

  if (variant === "transformation" && transformationItems.length === 0) {
    return null;
  }

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
              <ChangeStatusIcon status={item.status} isDark={isDark} />
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

      {variant === "changeStatus" && !newCllExperience && (
        <Box
          sx={{
            mt: 1,
            pt: 1,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: "block",
              fontWeight: 600,
              mb: 0.5,
              color: "text.secondary",
            }}
          >
            Change Categories
          </Typography>
          {CHANGE_CATEGORY_DETAILS.map(({ category, description }) => {
            const content = (
              <Typography
                key={category}
                variant="body2"
                sx={{ fontWeight: 600, mb: "2px" }}
              >
                {CHANGE_CATEGORY_LABELS[category]}
              </Typography>
            );

            return showTooltips ? (
              <Tooltip key={category} title={description} placement="right">
                {content}
              </Tooltip>
            ) : (
              content
            );
          })}
        </Box>
      )}

      {variant === "changeStatus" && newCllExperience && (
        <Box
          sx={{
            mt: 1,
            pt: 1,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: "block",
              fontWeight: 600,
              mb: 0.5,
              color: "text.secondary",
            }}
          >
            Badges
          </Typography>
          {getGraphBadgeLegendEntries(isDark).map((entry) => (
            <Box
              key={entry.kind}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                mb: "4px",
                "&:last-child": { mb: 0 },
              }}
            >
              <TreatmentChip
                tokens={entry.tokens}
                testId={`legend-treatment-${entry.kind}`}
                ariaLabel={entry.ariaLabel}
              >
                {entry.text}
              </TreatmentChip>
              <Typography variant="body2">{entry.tooltip}</Typography>
            </Box>
          ))}
        </Box>
      )}

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
