"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";

/**
 * Change status for node visualization
 */
export type NodeChangeStatus = "added" | "removed" | "modified" | "unchanged";

/**
 * Data structure for lineage node
 */
export interface LineageNodeData extends Record<string, unknown> {
  /** Display label for the node */
  label: string;
  /** Node type (model, source, seed, etc.) */
  nodeType?: string;
  /** Change status for diff visualization */
  changeStatus?: NodeChangeStatus;
  /** Whether this node is currently selected */
  isSelected?: boolean;
  /** Resource type for icon display */
  resourceType?: string;
  /** Package name */
  packageName?: string;
  /** Whether to show column-level details */
  showColumns?: boolean;
  /** Column data if showing columns */
  columns?: Array<{
    name: string;
    type?: string;
    changeStatus?: NodeChangeStatus;
  }>;
}

/**
 * Props for LineageNode component
 */
export interface LineageNodeProps {
  /** Node ID */
  id: string;
  /** Node data */
  data: LineageNodeData;
  /** Whether the node is selected */
  selected?: boolean;
  /** Callback when node is clicked */
  onNodeClick?: (nodeId: string) => void;
  /** Callback when node is double-clicked */
  onNodeDoubleClick?: (nodeId: string) => void;
}

const statusColors: Record<NodeChangeStatus, string> = {
  added: "#22c55e", // green
  removed: "#ef4444", // red
  modified: "#f59e0b", // amber
  unchanged: "#6b7280", // gray
};

/**
 * LineageNode - Pure presentation component for displaying nodes in a lineage graph
 *
 * This component is designed to be used with @xyflow/react and receives all data via props.
 * It does not perform any data fetching or state management - it is purely presentational.
 *
 * @example
 * ```tsx
 * <LineageNode
 *   id="model.my_model"
 *   data={{
 *     label: "my_model",
 *     nodeType: "model",
 *     changeStatus: "modified",
 *     resourceType: "model"
 *   }}
 *   selected={false}
 *   onNodeClick={(nodeId) => console.log("Clicked:", nodeId)}
 * />
 * ```
 */
function LineageNodeComponent({
  id,
  data,
  selected,
  onNodeClick,
  onNodeDoubleClick,
}: LineageNodeProps) {
  const {
    label,
    nodeType,
    changeStatus = "unchanged",
    isSelected,
    packageName,
  } = data;

  const borderColor = statusColors[changeStatus];
  const isActive = selected || isSelected;

  return (
    <Box
      onClick={() => onNodeClick?.(id)}
      onDoubleClick={() => onNodeDoubleClick?.(id)}
      sx={{
        minWidth: 150,
        maxWidth: 250,
        padding: "8px 12px",
        borderRadius: "8px",
        border: `2px solid ${borderColor}`,
        backgroundColor: isActive ? "action.selected" : "background.paper",
        cursor: "pointer",
        transition: "all 0.2s ease",
        "&:hover": {
          backgroundColor: "action.hover",
        },
      }}
    >
      <Handle type="target" position={Position.Left} />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {nodeType && (
          <Chip
            label={nodeType}
            size="small"
            sx={{ fontSize: "0.65rem", height: 18 }}
          />
        )}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Typography>
      </Box>

      {packageName && (
        <Typography variant="caption" color="text.secondary">
          {packageName}
        </Typography>
      )}

      <Handle type="source" position={Position.Right} />
    </Box>
  );
}

export const LineageNode = memo(LineageNodeComponent);
LineageNode.displayName = "LineageNode";
