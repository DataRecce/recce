"use client";

import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { type MouseEvent, memo } from "react";

/**
 * Check type categories for icon display
 */
export type CheckType =
  | "query"
  | "query_base"
  | "query_diff"
  | "schema_diff"
  | "lineage_diff"
  | "profile"
  | "profile_diff"
  | "row_count"
  | "row_count_diff"
  | "value_diff"
  | "histogram_diff"
  | "top_k_diff"
  | "simple";

/**
 * Status of a check run
 */
export type CheckRunStatus = "pending" | "running" | "success" | "error";

/**
 * Data structure for check display
 */
export interface CheckCardData {
  /** Unique check identifier */
  id: string;
  /** Display name of the check */
  name: string;
  /** Type of check for icon display */
  type: CheckType;
  /** Whether the check is approved */
  isApproved?: boolean;
  /** Run status of the check */
  runStatus?: CheckRunStatus;
  /** Whether the check is a preset */
  isPreset?: boolean;
}

/**
 * Props for the CheckCard component
 */
export interface CheckCardProps {
  /** Check data to display */
  check: CheckCardData;
  /** Whether this card is currently selected */
  isSelected?: boolean;
  /** Callback when card is clicked */
  onClick?: (checkId: string) => void;
  /** Callback when approval checkbox is toggled */
  onApprovalChange?: (checkId: string, isApproved: boolean) => void;
  /** Whether approval checkbox is disabled */
  disableApproval?: boolean;
  /** Tooltip text for disabled approval */
  disabledApprovalTooltip?: string;
  /** Whether the entire card is disabled */
  disabled?: boolean;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Get icon symbol for check type
 */
function getCheckTypeIcon(type: CheckType): string {
  const icons: Record<CheckType, string> = {
    query: "Q",
    query_base: "Q",
    query_diff: "QD",
    schema_diff: "SD",
    lineage_diff: "LD",
    profile: "P",
    profile_diff: "PD",
    row_count: "R",
    row_count_diff: "RD",
    value_diff: "VD",
    histogram_diff: "H",
    top_k_diff: "TK",
    simple: "•",
  };
  return icons[type] || "?";
}

/**
 * Get color for check type icon
 */
function getCheckTypeColor(type: CheckType): string {
  const colors: Record<CheckType, string> = {
    query: "#3b82f6", // blue
    query_base: "#3b82f6", // blue
    query_diff: "#8b5cf6", // purple
    schema_diff: "#06b6d4", // cyan
    lineage_diff: "#10b981", // emerald
    profile: "#f59e0b", // amber
    profile_diff: "#f97316", // orange
    row_count: "#ec4899", // pink
    row_count_diff: "#ef4444", // red
    value_diff: "#6366f1", // indigo
    histogram_diff: "#14b8a6", // teal
    top_k_diff: "#a855f7", // violet
    simple: "#6b7280", // gray
  };
  return colors[type] || "#6b7280";
}

/**
 * Get status color for run status
 * Note: Prefixed with underscore as it's reserved for future use
 */
function _getStatusColor(status?: CheckRunStatus): string {
  if (!status) return "transparent";
  const colors: Record<CheckRunStatus, string> = {
    pending: "#6b7280", // gray
    running: "#3b82f6", // blue
    success: "#22c55e", // green
    error: "#ef4444", // red
  };
  return colors[status];
}

/**
 * Get status label for tooltip
 * Note: Prefixed with underscore as it's reserved for future use
 */
function _getStatusLabel(status?: CheckRunStatus): string {
  if (!status) return "";
  const labels: Record<CheckRunStatus, string> = {
    pending: "Pending",
    running: "Running",
    success: "Ready",
    error: "Error",
  };
  return labels[status];
}

/**
 * CheckCard Component
 *
 * A pure presentation component for displaying a single check in a list.
 * Shows check type icon, name, approval status, and run status.
 *
 * @example Basic usage
 * ```tsx
 * import { CheckCard } from '@datarecce/ui/primitives';
 *
 * function CheckListItem({ check }) {
 *   return (
 *     <CheckCard
 *       check={{
 *         id: check.check_id,
 *         name: check.name,
 *         type: check.type,
 *         isApproved: check.is_checked,
 *       }}
 *       isSelected={selectedId === check.check_id}
 *       onClick={(id) => setSelectedId(id)}
 *       onApprovalChange={(id, approved) => updateCheck(id, { is_checked: approved })}
 *     />
 *   );
 * }
 * ```
 *
 * @example Disabled state
 * ```tsx
 * <CheckCard
 *   check={check}
 *   disableApproval
 *   disabledApprovalTooltip="Run the check first to enable approval"
 * />
 * ```
 */
function CheckCardComponent({
  check,
  isSelected = false,
  onClick,
  onApprovalChange,
  disableApproval = false,
  disabledApprovalTooltip,
  disabled = false,
  className,
}: CheckCardProps) {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick(check.id);
    }
  };

  const handleApprovalClick = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const handleApprovalChange = (
    _e: React.ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ) => {
    if (onApprovalChange) {
      onApprovalChange(check.id, checked);
    }
  };

  const approvalCheckbox = (
    <Checkbox
      checked={check.isApproved ?? false}
      onChange={handleApprovalChange}
      onClick={handleApprovalClick}
      disabled={disableApproval || disabled}
      size="small"
      sx={{
        padding: "4px",
        "&.Mui-disabled": {
          opacity: 0.5,
        },
      }}
    />
  );

  return (
    <Box
      className={className}
      onClick={handleClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        padding: "8px 12px",
        borderRadius: 1,
        cursor: disabled ? "default" : "pointer",
        borderLeft: isSelected ? "3px solid" : "3px solid transparent",
        borderLeftColor: isSelected ? "primary.main" : "transparent",
        backgroundColor: isSelected ? "action.selected" : "transparent",
        opacity: disabled ? 0.6 : 1,
        transition: "background-color 0.15s ease",
        "&:hover": {
          backgroundColor: disabled
            ? "transparent"
            : isSelected
              ? "action.selected"
              : "action.hover",
        },
      }}
    >
      {/* Type icon */}
      <Chip
        label={getCheckTypeIcon(check.type)}
        size="small"
        sx={{
          minWidth: 32,
          height: 24,
          fontSize: "0.7rem",
          fontWeight: 600,
          backgroundColor: `${getCheckTypeColor(check.type)}20`,
          color: getCheckTypeColor(check.type),
          "& .MuiChip-label": {
            px: 1,
          },
        }}
      />

      {/* Check name */}
      <Typography
        variant="body2"
        sx={{
          flexGrow: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {check.name}
      </Typography>

      {/* Run status indicator */}
      {/*{check.runStatus && (*/}
      {/*  <Tooltip title={getStatusLabel(check.runStatus)}>*/}
      {/*    <Box*/}
      {/*      sx={{*/}
      {/*        width: 8,*/}
      {/*        height: 8,*/}
      {/*        borderRadius: "50%",*/}
      {/*        backgroundColor: getStatusColor(check.runStatus),*/}
      {/*        flexShrink: 0,*/}
      {/*      }}*/}
      {/*    />*/}
      {/*  </Tooltip>*/}
      {/*)}*/}

      {/* Preset badge */}
      {check.isPreset && (
        <Chip
          label="Preset"
          size="small"
          variant="outlined"
          sx={{
            height: 20,
            fontSize: "0.65rem",
          }}
        />
      )}

      {/* Approval checkbox */}
      {disableApproval && disabledApprovalTooltip ? (
        <Tooltip title={disabledApprovalTooltip}>
          <span>{approvalCheckbox}</span>
        </Tooltip>
      ) : (
        approvalCheckbox
      )}
    </Box>
  );
}

export const CheckCard = memo(CheckCardComponent);
CheckCard.displayName = "CheckCard";
