"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { Handle, Position } from "@xyflow/react";
import { memo, useState } from "react";

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
  changeStatus?: "added" | "removed" | "modified";
  /** Whether the column is highlighted */
  isHighlighted?: boolean;
  /** Whether the column is selected/focused */
  isFocused?: boolean;
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
  /** Callback when column is clicked */
  onColumnClick?: (columnId: string) => void;
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
 * Colors for change status indicators
 */
const changeStatusColors: Record<string, string> = {
  added: "#22c55e",
  removed: "#ef4444",
  modified: "#f59e0b",
};

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
 * ChangeStatusIndicator - Shows change status icon
 */
function ChangeStatusIndicator({
  changeStatus,
}: {
  changeStatus?: "added" | "removed" | "modified";
}) {
  if (!changeStatus) {
    return null;
  }

  const color = changeStatusColors[changeStatus];
  const symbols: Record<string, string> = {
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
 */
function LineageColumnNodeComponent({
  id,
  data,
  onColumnClick,
}: LineageColumnNodeProps) {
  const {
    column,
    type,
    transformationType,
    changeStatus,
    isHighlighted = true,
    isFocused = false,
  } = data;

  const [isHovered, setIsHovered] = useState(false);

  return (
    <Box
      onClick={() => onColumnClick?.(id)}
      sx={{
        display: "flex",
        width: COLUMN_NODE_WIDTH,
        padding: "0px 10px",
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: isFocused
          ? "action.selected"
          : isHovered
            ? "action.hover"
            : "background.paper",
        filter: isHighlighted ? "none" : "opacity(0.2) grayscale(50%)",
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
          color: "text.primary",
          width: "100%",
          gap: "6px",
          alignItems: "center",
          height: `${COLUMN_NODE_HEIGHT - 1}px`,
        }}
      >
        {/* Status indicator */}
        {changeStatus ? (
          <ChangeStatusIndicator changeStatus={changeStatus} />
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
          }}
        >
          {column}
        </Box>

        {/* Column type */}
        {type && (
          <Box
            sx={{
              color: "text.secondary",
              fontSize: "10px",
              flexShrink: 0,
            }}
          >
            {type}
          </Box>
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
