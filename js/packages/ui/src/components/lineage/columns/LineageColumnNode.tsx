"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { Handle, Position } from "@xyflow/react";
import type { MouseEvent } from "react";
import { memo, useState } from "react";
import { getSemanticColorTheme } from "../../../theme";
import { DataTypeIcon } from "../../ui/DataTypeIcon";
import { StructuralChangeIndicator } from "../../ui/StructuralChangeIndicator";
import { DIM_FILTER } from "../config/zoomConstants";
import { getStyleForImpacted } from "../styles";

/**
 * Transformation type for column-level lineage
 */
export type ColumnTransformationType =
  | "passthrough"
  | "renamed"
  | "derived"
  | "source"
  | "unknown";

/**
 * Column change status for diff views
 */
export type ColumnChangeStatus = "added" | "removed" | "modified";

/**
 * Data structure for a column node
 */
export interface LineageColumnNodeData extends Record<string, unknown> {
  /** Column name */
  column: string;
  /** Column data type (e.g., "VARCHAR", "INTEGER") */
  type?: string;
  /** ID of the parent model/table node */
  nodeId: string;
  /** Transformation type for this column */
  transformationType?: ColumnTransformationType;
  /** Change status for diff views */
  changeStatus?: ColumnChangeStatus;
  /** Whether the column is highlighted */
  isHighlighted?: boolean;
  /** Whether the column is selected/focused */
  isFocused?: boolean;
  /** Whether this column is impacted (new CLL experience) */
  isImpacted?: boolean;
  /** Number of upstream ancestry columns omitted by the current graph filter */
  hiddenUpstreamColumnCount?: number;
  /** Number of downstream ancestry columns omitted by the current graph filter */
  hiddenDownstreamColumnCount?: number;
  /** Whether to use the new CLL experience palette (muted bg + left accent) */
  newCllExperience?: boolean;
}

/**
 * Props for the LineageColumnNode component
 */
export interface LineageColumnNodeProps {
  /** Unique node ID */
  id: string;
  /** Node data */
  data: LineageColumnNodeData;
  /** Whether the node is selected */
  selected?: boolean;

  // === New props for OSS feature parity ===

  /**
   * Whether to show content (used for zoom-level visibility)
   * When false, the node renders nothing (hidden at low zoom levels)
   * @default true
   */
  showContent?: boolean;

  /**
   * Whether to show change analysis mode
   * When true and changeStatus exists, shows change status indicator
   * When false, shows transformation type indicator
   * @default false
   */
  showChangeAnalysis?: boolean;

  /**
   * Whether to use dark mode styling
   * @default false
   */
  isDark?: boolean;

  /**
   * Whether to use the new CLL experience palette (muted bg + left accent
   * for changed columns, dark hex fallbacks). When false, renders the
   * original behavior: only `isImpacted` triggers a tinted bg.
   * Falls back to `data.newCllExperience` when prop is omitted.
   * @default false
   */
  newCllExperience?: boolean;

  // === Callbacks ===

  /** Callback when column is clicked */
  onColumnClick?: (columnId: string) => void;

  /**
   * Callback when context menu is requested (kebab menu click)
   * When provided, shows kebab menu on hover
   */
  onContextMenu?: (event: MouseEvent, columnId: string) => void;
}

/**
 * Default column height in pixels
 */
export const COLUMN_NODE_HEIGHT = 24;

/**
 * Default column width in pixels
 */
export const COLUMN_NODE_WIDTH = 280;

/**
 * Colors for transformation type chips
 */
const transformationColors: Record<
  ColumnTransformationType,
  { letter: string; color: "default" | "warning" | "info" | "error" }
> = {
  passthrough: { letter: "P", color: "default" },
  renamed: { letter: "R", color: "warning" },
  derived: { letter: "D", color: "warning" },
  source: { letter: "S", color: "info" },
  unknown: { letter: "U", color: "error" },
};

/**
 * KebabMenuIcon - Inline SVG to avoid react-icons dependency
 */
function KebabMenuIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13" r="1.5" />
    </svg>
  );
}

/**
 * ChangeStatusIndicator - Shows change status icon
 */
function ChangeStatusIndicator({
  changeStatus,
}: {
  changeStatus?: ColumnChangeStatus;
}) {
  if (!changeStatus) {
    return null;
  }

  return (
    <StructuralChangeIndicator
      status={changeStatus}
      emphasis="secondary"
      size="sm"
    />
  );
}

/**
 * TransformationIndicator - Shows transformation type chip
 */
function TransformationIndicator({
  transformationType,
}: {
  transformationType?: ColumnTransformationType;
}) {
  if (!transformationType) {
    return null;
  }

  const config = transformationColors[transformationType];

  return (
    <Chip
      label={config.letter}
      size="small"
      color={config.color}
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

function HiddenLineageIndicator({
  count,
  direction,
}: {
  count?: number;
  direction: "upstream" | "downstream";
}) {
  if (!count) {
    return null;
  }

  const label = `${count} ${direction} lineage column${count === 1 ? "" : "s"} hidden by the current view`;
  return (
    <Box
      component="span"
      role="img"
      aria-label={label}
      title={label}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        height: 18,
        px: 0.5,
        border: "1px solid",
        borderColor: "warning.main",
        borderRadius: "4px",
        color: "warning.dark",
        backgroundColor: "action.hover",
        fontSize: "0.625rem",
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {direction === "upstream" ? `← ${count}` : `${count} →`}
    </Box>
  );
}

/**
 * LineageColumnNode Component
 *
 * A pure presentation component for rendering individual columns
 * in column-level lineage visualizations using React Flow.
 *
 * @example Basic usage
 * ```tsx
 * import { LineageColumnNode } from '@datarecce/ui/primitives';
 *
 * // Register as a React Flow node type
 * const nodeTypes = {
 *   columnNode: LineageColumnNode,
 * };
 *
 * function ColumnLineageGraph() {
 *   return (
 *     <ReactFlow nodes={columnNodes} edges={edges} nodeTypes={nodeTypes} />
 *   );
 * }
 * ```
 *
 * @example Node data structure
 * ```tsx
 * const columnNode = {
 *   id: 'users-id',
 *   type: 'columnNode',
 *   data: {
 *     column: 'id',
 *     type: 'INTEGER',
 *     nodeId: 'users',
 *     transformationType: 'passthrough',
 *     changeStatus: undefined,
 *     isHighlighted: true,
 *   },
 *   position: { x: 0, y: 0 },
 * };
 * ```
 *
 * @example With change analysis mode
 * ```tsx
 * // In change analysis mode, shows change status instead of transformation type
 * <LineageColumnNode
 *   showChangeAnalysis={true}
 *   showContent={zoomLevel > 0.3}
 *   onContextMenu={(e, columnId) => showMenu(e, columnId)}
 * />
 * ```
 */
function LineageColumnNodeComponent({
  id,
  data,
  showContent = true,
  showChangeAnalysis = false,
  isDark = false,
  newCllExperience: newCllExperienceProp,
  onColumnClick,
  onContextMenu,
}: LineageColumnNodeProps) {
  const {
    column,
    type,
    transformationType,
    changeStatus,
    isHighlighted = true,
    isFocused = false,
    isImpacted = false,
    hiddenUpstreamColumnCount,
    hiddenDownstreamColumnCount,
  } = data;
  const newCllExperience =
    newCllExperienceProp ?? data.newCllExperience ?? false;
  const semantic = getSemanticColorTheme(isDark);

  const [isHovered, setIsHovered] = useState(false);

  // Hide node when showContent is false (low zoom level)
  if (!showContent) {
    return null;
  }

  // Structural status owns the neutral surface plus secondary-accent rail.
  // CLL impact keeps its separate amber presentation only when the column has
  // no structural status of its own.
  const neutralHoverBg = isDark ? "#262626" : "#F5F5F5";
  const neutralSelectedBg = isDark ? "#404040" : "#E5E5E5";
  const statusBg = changeStatus
    ? isFocused
      ? neutralSelectedBg
      : isHovered
        ? neutralHoverBg
        : semantic.structural.neutral.background
    : undefined;
  const statusAccent = changeStatus
    ? semantic.structural.secondaryAccent[changeStatus]
    : undefined;
  const impactedStyle =
    isImpacted && !changeStatus ? getStyleForImpacted(isDark) : undefined;

  const tintedBg = statusBg ?? impactedStyle?.backgroundColor;
  const accentColor = statusAccent ?? impactedStyle?.color;

  // Dark-mode fallbacks for the new CLL experience only — the muted palette
  // needs a dark counterpart so columns don't fall through to MUI's light
  // default. Outside the flag, keep the original MUI tokens.
  const defaultBg = newCllExperience && isDark ? "#262626" : "background.paper";
  const hoverBg = newCllExperience && isDark ? "#333333" : "action.hover";
  const selectedBg = newCllExperience && isDark ? "#404040" : "action.selected";
  const textColor = newCllExperience && isDark ? "#ffffff" : "text.primary";

  return (
    <Box
      onClick={() => onColumnClick?.(id)}
      sx={{
        display: "flex",
        width: COLUMN_NODE_WIDTH,
        padding: "0px 10px",
        border: "1px solid",
        borderColor: changeStatus
          ? semantic.structural.neutral.border
          : "divider",
        backgroundColor: tintedBg
          ? tintedBg
          : isFocused
            ? selectedBg
            : isHovered
              ? hoverBg
              : defaultBg,
        borderLeft: accentColor ? `3px solid ${accentColor}` : undefined,
        filter: isHighlighted ? "none" : DIM_FILTER,
        cursor: "pointer",
        transition: "background-color 0.15s ease",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Box
        sx={{
          display: "flex",
          fontSize: "0.6875rem",
          color: textColor,
          width: "100%",
          gap: "6px",
          alignItems: "center",
          height: `${COLUMN_NODE_HEIGHT - 1}px`,
        }}
      >
        <HiddenLineageIndicator
          count={hiddenUpstreamColumnCount}
          direction="upstream"
        />

        {/* Structural status and transformation are independent meanings. */}
        {changeStatus && <ChangeStatusIndicator changeStatus={changeStatus} />}
        {(!showChangeAnalysis || !changeStatus) && (
          <TransformationIndicator transformationType={transformationType} />
        )}

        {/* Column name */}
        <Box
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flexGrow: 1,
            height: `${COLUMN_NODE_HEIGHT + 1}px`,
            lineHeight: `${COLUMN_NODE_HEIGHT + 1}px`,
          }}
        >
          {column}
        </Box>

        <HiddenLineageIndicator
          count={hiddenDownstreamColumnCount}
          direction="downstream"
        />

        {/* Column type or kebab menu */}
        {isHovered && onContextMenu ? (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              cursor: "pointer",
              "&:hover": { color: "text.primary" },
            }}
            onClick={(e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              onContextMenu(e, id);
            }}
            data-testid="column-kebab-menu"
          >
            <KebabMenuIcon size={14} />
          </Box>
        ) : (
          type && (
            <DataTypeIcon
              type={type}
              style={{ flexShrink: 0, opacity: 0.7, fontSize: "1rem" }}
            />
          )
        )}
      </Box>

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        style={{
          left: 0,
          visibility: "hidden",
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        style={{
          right: 0,
          visibility: "hidden",
        }}
      />
    </Box>
  );
}

export const LineageColumnNode = memo(LineageColumnNodeComponent);
LineageColumnNode.displayName = "LineageColumnNode";
