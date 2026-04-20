"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { Handle, Position } from "@xyflow/react";
import type { MouseEvent } from "react";
import { memo, useState } from "react";
import { DataTypeIcon } from "../../ui/DataTypeIcon";
import { DIM_FILTER } from "../config/zoomConstants";
import {
  changeStatusColors,
  cllChangeStatusBackgroundsDark,
  cllChangeStatusBackgroundsLight,
  cllChangeStatusColors,
  getStyleForImpacted,
} from "../styles";

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
  newCllExperience,
}: {
  changeStatus?: ColumnChangeStatus;
  newCllExperience: boolean;
}) {
  if (!changeStatus) {
    return null;
  }

  const palette = newCllExperience ? cllChangeStatusColors : changeStatusColors;
  const color = palette[changeStatus];
  const symbols: Record<ColumnChangeStatus, string> = {
    added: "+",
    removed: "-",
    modified: "~",
  };

  return (
    <Box
      sx={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        backgroundColor: color,
        color: "white",
        fontSize: 10,
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {symbols[changeStatus]}
    </Box>
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
  } = data;
  const newCllExperience =
    newCllExperienceProp ?? data.newCllExperience ?? false;

  const [isHovered, setIsHovered] = useState(false);

  // Hide node when showContent is false (low zoom level)
  if (!showContent) {
    return null;
  }

  // Determine what indicator to show based on showChangeAnalysis mode
  const shouldShowChangeStatus = showChangeAnalysis && changeStatus;

  // Resolve tinted background + left accent for this row.
  // In new CLL experience: changeStatus → tinted bg + accent; impacted →
  // amber bg (only when no changeStatus). Outside the flag: only impacted
  // gets a tinted bg (original behavior); no accent border.
  const statusBg =
    newCllExperience && changeStatus
      ? (isDark
          ? cllChangeStatusBackgroundsDark
          : cllChangeStatusBackgroundsLight)[changeStatus]
      : undefined;
  const statusAccent =
    newCllExperience && changeStatus
      ? cllChangeStatusColors[changeStatus]
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
        borderColor: "divider",
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
          fontSize: "11px",
          color: textColor,
          width: "100%",
          gap: "6px",
          alignItems: "center",
          height: `${COLUMN_NODE_HEIGHT - 1}px`,
        }}
      >
        {/* Status indicator - based on showChangeAnalysis mode */}
        {shouldShowChangeStatus ? (
          <ChangeStatusIndicator
            changeStatus={changeStatus}
            newCllExperience={newCllExperience}
          />
        ) : (
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
