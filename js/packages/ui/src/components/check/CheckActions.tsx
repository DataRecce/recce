"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { type MouseEvent, memo, useState } from "react";

/**
 * Action types available for checks
 */
export type CheckActionType =
  | "run"
  | "approve"
  | "edit"
  | "delete"
  | "duplicate"
  | "copy"
  | "preset";

/**
 * Configuration for a check action
 */
export interface CheckAction {
  /** Action type identifier */
  type: CheckActionType;
  /** Display label */
  label: string;
  /** Icon element (optional) */
  icon?: React.ReactNode;
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Tooltip for disabled state */
  disabledTooltip?: string;
  /** Whether this is a destructive action (shown in red) */
  destructive?: boolean;
}

/**
 * Props for the CheckActions component
 */
export interface CheckActionsProps {
  /** ID of the check these actions are for */
  checkId: string;
  /** List of primary actions (shown as buttons) */
  primaryActions?: CheckAction[];
  /** List of secondary actions (shown in dropdown menu) */
  secondaryActions?: CheckAction[];
  /** Callback when an action is triggered */
  onAction?: (checkId: string, actionType: CheckActionType) => void;
  /** Render variant */
  variant?: "buttons" | "menu" | "combined";
  /** Size of buttons */
  size?: "small" | "medium";
  /** Icon for menu trigger button */
  menuIcon?: React.ReactNode;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Default menu icon (three vertical dots)
 */
const DefaultMenuIcon = () => (
  <Box
    component="span"
    sx={{
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      "& > span": {
        width: 4,
        height: 4,
        borderRadius: "50%",
        backgroundColor: "currentColor",
      },
    }}
  >
    <span />
    <span />
    <span />
  </Box>
);

/**
 * CheckActions Component
 *
 * A pure presentation component for displaying action buttons/menu for a check.
 * Supports primary actions as buttons and secondary actions in a dropdown menu.
 *
 * @example Basic usage with buttons
 * ```tsx
 * import { CheckActions } from '@datarecce/ui/primitives';
 *
 * <CheckActions
 *   checkId={check.id}
 *   primaryActions={[
 *     { type: 'run', label: 'Run' },
 *     { type: 'approve', label: 'Approve' },
 *   ]}
 *   onAction={(id, action) => handleAction(id, action)}
 * />
 * ```
 *
 * @example Combined buttons and menu
 * ```tsx
 * <CheckActions
 *   checkId={check.id}
 *   variant="combined"
 *   primaryActions={[
 *     { type: 'run', label: 'Run', icon: <PlayIcon /> },
 *   ]}
 *   secondaryActions={[
 *     { type: 'duplicate', label: 'Duplicate' },
 *     { type: 'copy', label: 'Copy Markdown' },
 *     { type: 'delete', label: 'Delete', destructive: true },
 *   ]}
 *   onAction={(id, action) => handleAction(id, action)}
 * />
 * ```
 *
 * @example Menu only
 * ```tsx
 * <CheckActions
 *   checkId={check.id}
 *   variant="menu"
 *   secondaryActions={allActions}
 *   onAction={(id, action) => handleAction(id, action)}
 * />
 * ```
 */
function CheckActionsComponent({
  checkId,
  primaryActions = [],
  secondaryActions = [],
  onAction,
  variant = "combined",
  size = "small",
  menuIcon,
  className,
}: CheckActionsProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (actionType: CheckActionType) => {
    handleMenuClose();
    onAction?.(checkId, actionType);
  };

  const renderActionButton = (action: CheckAction) => {
    const button = (
      <Button
        key={action.type}
        variant="outlined"
        size={size}
        disabled={action.disabled}
        onClick={() => handleAction(action.type)}
        startIcon={action.icon}
        color={action.destructive ? "error" : "inherit"}
      >
        {action.label}
      </Button>
    );

    if (action.disabled && action.disabledTooltip) {
      return (
        <Tooltip key={action.type} title={action.disabledTooltip}>
          <span>{button}</span>
        </Tooltip>
      );
    }

    return button;
  };

  // Menu-only variant
  if (variant === "menu") {
    const allActions = [...primaryActions, ...secondaryActions];
    return (
      <Box className={className}>
        <IconButton onClick={handleMenuClick} size={size}>
          {menuIcon || <DefaultMenuIcon />}
        </IconButton>
        <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
          {allActions.map((action) => (
            <MenuItem
              key={action.type}
              onClick={() => handleAction(action.type)}
              disabled={action.disabled}
              sx={{
                color: action.destructive ? "error.main" : "inherit",
              }}
            >
              {action.icon && (
                <Box component="span" sx={{ mr: 1, display: "flex" }}>
                  {action.icon}
                </Box>
              )}
              {action.label}
            </MenuItem>
          ))}
        </Menu>
      </Box>
    );
  }

  // Buttons-only variant
  if (variant === "buttons") {
    return (
      <Box className={className} sx={{ display: "flex", gap: 1 }}>
        <ButtonGroup size={size} variant="outlined">
          {primaryActions.map(renderActionButton)}
        </ButtonGroup>
      </Box>
    );
  }

  // Combined variant (buttons + menu)
  return (
    <Box className={className} sx={{ display: "flex", gap: 1 }}>
      {/* Primary action buttons */}
      {primaryActions.length > 0 && (
        <ButtonGroup size={size} variant="outlined">
          {primaryActions.map(renderActionButton)}
        </ButtonGroup>
      )}

      {/* Secondary actions menu */}
      {secondaryActions.length > 0 && (
        <>
          <IconButton onClick={handleMenuClick} size={size}>
            {menuIcon || <DefaultMenuIcon />}
          </IconButton>
          <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
            {secondaryActions.map((action) => (
              <MenuItem
                key={action.type}
                onClick={() => handleAction(action.type)}
                disabled={action.disabled}
                sx={{
                  color: action.destructive ? "error.main" : "inherit",
                }}
              >
                {action.icon && (
                  <Box component="span" sx={{ mr: 1, display: "flex" }}>
                    {action.icon}
                  </Box>
                )}
                {action.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  );
}

export const CheckActions = memo(CheckActionsComponent);
CheckActions.displayName = "CheckActions";
