"use client";

/**
 * @file LineageNode.tsx
 * @description Pure presentation component for displaying nodes in a lineage graph
 *
 * This component is designed to work with @xyflow/react and receives all data via props.
 * It does not perform any data fetching or state management - it is purely presentational.
 *
 * Features:
 * - Change status visualization (added, removed, modified, unchanged)
 * - Selection modes (normal, selecting, action_result)
 * - Interactive checkbox for multi-select
 * - Action tag display for run status
 * - Resource type and change status icons
 * - Hover menu with context actions
 * - Column container support
 *
 * Source: Enhanced from UI package primitive + OSS js/src/components/lineage/GraphNode.tsx
 */

import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Handle, Position } from "@xyflow/react";
import { type MouseEvent, memo, type ReactNode, useState } from "react";
import { getIconForChangeStatus, getIconForResourceType } from "../styles";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Change status for node visualization
 */
export type NodeChangeStatus = "added" | "removed" | "modified" | "unchanged";

/**
 * Selection mode for the node
 */
export type SelectMode = "normal" | "selecting" | "action_result";

/**
 * Change category from column-level lineage analysis
 */
export type ChangeCategory =
  | "breaking"
  | "non_breaking"
  | "partial_breaking"
  | "unknown";

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
  /** Whether the node is selected (from React Flow) */
  selected?: boolean;

  // === Interactive Mode Props ===
  /** Enable interactive mode with checkbox */
  interactive?: boolean;
  /** Selection mode */
  selectMode?: SelectMode;
  /** Whether the node is selected (checkbox state) */
  isNodeSelected?: boolean;
  /** Whether the node is focused */
  isFocused?: boolean;
  /** Whether the node is highlighted */
  isHighlighted?: boolean;
  /** Whether to show content (zoom level visibility) */
  showContent?: boolean;

  // === Action Display Props ===
  /** Action tag to display (for action_result mode) */
  actionTag?: ReactNode;
  /** Whether to show change analysis mode */
  showChangeAnalysis?: boolean;
  /** Change category text */
  changeCategory?: ChangeCategory;
  /** Runs aggregated display component */
  runsAggregatedTag?: ReactNode;

  // === Layout Props ===
  /** Whether node has parent nodes (show left handle) */
  hasParents?: boolean;
  /** Whether node has child nodes (show right handle) */
  hasChildren?: boolean;
  /** Number of columns for column container height */
  columnCount?: number;
  /** Height per column in pixels */
  columnHeight?: number;

  // === Theme Props ===
  /** Whether dark mode is active */
  isDark?: boolean;

  // === Callbacks ===
  /** Callback when node is clicked */
  onNodeClick?: (nodeId: string) => void;
  /** Callback when node is double-clicked */
  onNodeDoubleClick?: (nodeId: string) => void;
  /** Callback when checkbox is clicked */
  onSelect?: (nodeId: string) => void;
  /** Callback when context menu is requested */
  onContextMenu?: (event: MouseEvent, nodeId: string) => void;
  /** Callback when impact radius button is clicked */
  onShowImpactRadius?: (nodeId: string) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CHANGE_CATEGORY_LABELS: Record<ChangeCategory, string> = {
  breaking: "Breaking",
  non_breaking: "Non Breaking",
  partial_breaking: "Partial Breaking",
  unknown: "Unknown",
};

const DEFAULT_COLUMN_HEIGHT = 28;

// =============================================================================
// ICONS
// =============================================================================

/**
 * Kebab menu icon
 */
const KebabIcon = () => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 16 16"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M8 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm0 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm0 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
  </svg>
);

/**
 * Impact radius icon (dot circle)
 */
const ImpactRadiusIcon = () => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 512 512"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M256 56c110.532 0 200 89.451 200 200 0 110.532-89.451 200-200 200-110.532 0-200-89.451-200-200 0-110.532 89.451-200 200-200m0-48C119.033 8 8 119.033 8 256s111.033 248 248 248 248-111.033 248-248S392.967 8 256 8zm0 168c-44.183 0-80 35.817-80 80s35.817 80 80 80 80-35.817 80-80-35.817-80-80-80z" />
  </svg>
);

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/**
 * Node title with tooltip
 */
function NodeTitle({
  name,
  color,
  resourceType,
}: {
  name: string;
  color: string;
  resourceType?: string;
}) {
  const tooltipTitle =
    resourceType === "model" ? name : `${name} (${resourceType || "unknown"})`;

  return (
    <Box
      sx={{
        flex: 1,
        color,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      <Tooltip title={tooltipTitle} placement="top">
        <span>{name}</span>
      </Tooltip>
    </Box>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * LineageNode - Pure presentation component for displaying nodes in a lineage graph
 *
 * This component is designed to be used with @xyflow/react and receives all data via props.
 * It does not perform any data fetching or state management - it is purely presentational.
 *
 * @example Basic usage
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
 *
 * @example Interactive mode with selection
 * ```tsx
 * <LineageNode
 *   id="model.my_model"
 *   data={{ label: "my_model", changeStatus: "added" }}
 *   interactive
 *   selectMode="selecting"
 *   isNodeSelected={selectedNodes.has("model.my_model")}
 *   onSelect={(nodeId) => toggleSelection(nodeId)}
 * />
 * ```
 *
 * @example Action result mode
 * ```tsx
 * <LineageNode
 *   id="model.my_model"
 *   data={{ label: "my_model", changeStatus: "modified" }}
 *   selectMode="action_result"
 *   actionTag={<ActionTag status="running" progress={{ percentage: 0.5 }} />}
 * />
 * ```
 */
function LineageNodeComponent({
  id,
  data,
  selected,
  // Interactive props
  interactive = false,
  selectMode = "normal",
  isNodeSelected = false,
  isFocused = false,
  isHighlighted = true,
  showContent = true,
  // Action display props
  actionTag,
  showChangeAnalysis = false,
  changeCategory,
  runsAggregatedTag,
  // Layout props
  hasParents = true,
  hasChildren = true,
  columnCount = 0,
  columnHeight = DEFAULT_COLUMN_HEIGHT,
  // Theme props
  isDark = false,
  // Callbacks
  onNodeClick,
  onNodeDoubleClick,
  onSelect,
  onContextMenu,
  onShowImpactRadius,
}: LineageNodeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const {
    label,
    changeStatus = "unchanged",
    isSelected: dataIsSelected,
    resourceType,
  } = data;

  // Use isNodeSelected prop, fall back to data.isSelected, then to selected
  const isSelected = isNodeSelected || dataIsSelected || selected || false;
  const showColumns = columnCount > 0;
  const hasAction = selectMode === "action_result" && actionTag;

  // Get icons and colors
  const {
    icon: IconChangeStatus,
    color: colorChangeStatus,
    backgroundColor: backgroundColorChangeStatus,
  } = getIconForChangeStatus(changeStatus, isDark);
  const { icon: ResourceIcon } = getIconForResourceType(resourceType);

  // Calculate styles based on state
  const borderWidth = "2px";
  const borderColor = colorChangeStatus;

  // Node background color logic
  const nodeBackgroundColor = (() => {
    const paperBg = isDark ? "#1e1e1e" : "#ffffff";

    if (showContent) {
      if (selectMode === "selecting") {
        return isSelected ? colorChangeStatus : paperBg;
      }
      if (selectMode === "action_result") {
        if (!hasAction) return paperBg;
        return isFocused || isSelected || isHovered
          ? backgroundColorChangeStatus
          : colorChangeStatus;
      }
      return isFocused || isSelected || isHovered
        ? backgroundColorChangeStatus
        : paperBg;
    }
    return isFocused || isSelected || isHovered
      ? colorChangeStatus
      : backgroundColorChangeStatus;
  })();

  // Text color logic
  const titleColor = (() => {
    const primaryText = isDark ? "#ffffff" : "#000000";
    const invertedText = isDark ? "#000000" : "#ffffff";

    if (selectMode === "selecting") {
      return isSelected ? invertedText : primaryText;
    }
    if (selectMode === "action_result") {
      return hasAction && !isSelected ? invertedText : primaryText;
    }
    return primaryText;
  })();

  const iconColor = (() => {
    const primaryText = isDark ? "#ffffff" : "#000000";
    const invertedText = isDark ? "#000000" : "#ffffff";

    if (selectMode === "selecting") {
      return isSelected ? invertedText : primaryText;
    }
    if (selectMode === "action_result") {
      return hasAction && !isSelected ? invertedText : primaryText;
    }
    return primaryText;
  })();

  const changeStatusIconColor = (() => {
    const primaryText = isDark ? "#ffffff" : "#000000";
    const invertedText = isDark ? "#000000" : "#ffffff";

    if (selectMode === "selecting") {
      return isSelected ? invertedText : colorChangeStatus;
    }
    if (selectMode === "action_result") {
      return hasAction && !isSelected ? invertedText : primaryText;
    }
    return colorChangeStatus;
  })();

  // Filter for dimming
  const nodeFilter = (() => {
    if (selectMode === "action_result") {
      return hasAction ? "none" : "opacity(0.2) grayscale(50%)";
    }
    return isHighlighted || isFocused || isSelected || isHovered
      ? "none"
      : "opacity(0.2) grayscale(50%)";
  })();

  const handleCheckboxClick = (e: MouseEvent) => {
    if (selectMode === "action_result") return;
    e.stopPropagation();
    onSelect?.(id);
  };

  const handleContextMenuClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, id);
  };

  const handleImpactRadiusClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onShowImpactRadius?.(id);
  };

  return (
    <Box
      onClick={() => onNodeClick?.(id)}
      onDoubleClick={() => onNodeDoubleClick?.(id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        display: "flex",
        flexDirection: "column",
        width: 300,
        cursor: selectMode === "selecting" ? "pointer" : "inherit",
        transition: "box-shadow 0.2s ease-in-out",
        padding: 0,
        filter: nodeFilter,
      }}
    >
      {/* Main node container */}
      <Box
        sx={{
          display: "flex",
          borderColor,
          borderWidth,
          borderStyle: "solid",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderBottomLeftRadius: showColumns ? 0 : 8,
          borderBottomRightRadius: showColumns ? 0 : 8,
          backgroundColor: nodeBackgroundColor,
          height: 60,
        }}
      >
        {/* Left panel with checkbox */}
        <Box
          sx={{
            display: "flex",
            bgcolor: colorChangeStatus,
            padding: interactive ? "8px" : "2px",
            borderRightWidth: borderWidth,
            borderRightStyle: "solid",
            borderColor: selectMode === "selecting" ? "#00000020" : borderColor,
            alignItems: "top",
            visibility: showContent ? "inherit" : "hidden",
          }}
        >
          {interactive && (
            <Checkbox
              checked={
                (selectMode === "selecting" && isSelected) ||
                (selectMode === "action_result" && !!hasAction)
              }
              onClick={handleCheckboxClick}
              disabled={selectMode === "action_result"}
              size="small"
              sx={{
                padding: 0,
                color: "inherit",
                "&.Mui-checked": { color: "inherit" },
              }}
            />
          )}
        </Box>

        {/* Content area */}
        <Box
          sx={{
            display: "flex",
            flex: "1 0 auto",
            mx: 0.5,
            width: 100,
            flexDirection: "column",
          }}
        >
          {/* Title row */}
          <Box
            sx={{
              display: "flex",
              width: "100%",
              textAlign: "left",
              fontWeight: 600,
              flex: 1,
              p: 0.5,
              gap: "5px",
              alignItems: "center",
              visibility: showContent ? "inherit" : "hidden",
            }}
          >
            <NodeTitle
              name={label}
              color={titleColor}
              resourceType={resourceType}
            />

            {/* Hover actions vs icons */}
            {isHovered ? (
              <>
                {changeStatus === "modified" && onShowImpactRadius && (
                  <Tooltip title="Show Impact Radius" placement="top">
                    <Box
                      onClick={handleImpactRadiusClick}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "text.secondary",
                        "&:hover": { color: "text.primary" },
                      }}
                    >
                      <ImpactRadiusIcon />
                    </Box>
                  </Tooltip>
                )}
                {onContextMenu && (
                  <Box
                    onClick={handleContextMenuClick}
                    sx={{
                      cursor: "pointer",
                      color: "text.secondary",
                      "&:hover": { color: "text.primary" },
                    }}
                  >
                    <KebabIcon />
                  </Box>
                )}
              </>
            ) : (
              <>
                {ResourceIcon && (
                  <Box sx={{ fontSize: 16, color: iconColor }}>
                    <ResourceIcon />
                  </Box>
                )}
                {changeStatus && IconChangeStatus && (
                  <Box sx={{ color: changeStatusIconColor }}>
                    <IconChangeStatus />
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* Bottom row - action tags, change analysis, or runs aggregated */}
          <Box
            sx={{
              display: "flex",
              flex: "1 0 auto",
              mx: 0.5,
              flexDirection: "column",
              paddingBottom: 0.5,
              visibility: showContent ? "inherit" : "hidden",
            }}
          >
            <Stack direction="row" spacing={1}>
              {actionTag ? (
                <>
                  <Box sx={{ flexGrow: 1 }} />
                  {actionTag}
                </>
              ) : showChangeAnalysis && changeCategory ? (
                <Typography
                  sx={{
                    height: 20,
                    color: "text.secondary",
                    fontSize: "9pt",
                    margin: 0,
                    fontWeight: 600,
                  }}
                >
                  {CHANGE_CATEGORY_LABELS[changeCategory]}
                </Typography>
              ) : selectMode !== "action_result" && runsAggregatedTag ? (
                runsAggregatedTag
              ) : null}
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* Column container */}
      {showColumns && (
        <Box
          sx={{
            p: "10px 10px",
            borderColor,
            borderWidth,
            borderStyle: "solid",
            borderTopWidth: 0,
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
          }}
        >
          <Box
            sx={{
              height: `${columnCount * columnHeight}px`,
              overflow: "auto",
            }}
          />
        </Box>
      )}

      {/* Handles */}
      {hasParents && (
        <Handle type="target" position={Position.Left} isConnectable={false} />
      )}
      {hasChildren && (
        <Handle type="source" position={Position.Right} isConnectable={false} />
      )}
    </Box>
  );
}

export const LineageNode = memo(LineageNodeComponent);
LineageNode.displayName = "LineageNode";
