"use client";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { memo, type ReactNode, useState } from "react";

import {
  type CheckAction,
  CheckActions,
  type CheckActionType,
} from "./CheckActions";
import { CheckDescription } from "./CheckDescription";

/**
 * Tab configuration for CheckDetail
 */
export interface CheckDetailTab {
  /** Unique tab identifier */
  id: string;
  /** Tab label */
  label: string;
  /** Tab content */
  content: ReactNode;
}

/**
 * Props for the CheckDetail component
 */
export interface CheckDetailProps {
  /** Check ID */
  checkId: string;
  /** Check name (displayed as header) */
  name: string;
  /** Check type for display */
  type: string;
  /** Check description */
  description?: string;
  /** Whether the check is approved */
  isApproved?: boolean;
  /** Tabs to display (result, query, etc.) */
  tabs?: CheckDetailTab[];
  /** Default selected tab ID */
  defaultTab?: string;
  /** Primary actions for the check */
  primaryActions?: CheckAction[];
  /** Secondary actions for the check */
  secondaryActions?: CheckAction[];
  /** Callback when an action is triggered */
  onAction?: (checkId: string, actionType: CheckActionType) => void;
  /** Callback when description changes */
  onDescriptionChange?: (description?: string) => void;
  /** Callback when name changes */
  onNameChange?: (name: string) => void;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Optional header content (breadcrumbs, etc.) */
  headerContent?: ReactNode;
  /** Optional sidebar content */
  sidebarContent?: ReactNode;
  /** Optional CSS class name */
  className?: string;
}

/**
 * CheckDetail Component
 *
 * A pure presentation component for displaying detailed information
 * about a single check with tabs, actions, and editable fields.
 *
 * @example Basic usage
 * ```tsx
 * import { CheckDetail } from '@datarecce/ui/primitives';
 *
 * function CheckPage({ check, run }) {
 *   return (
 *     <CheckDetail
 *       checkId={check.id}
 *       name={check.name}
 *       type={check.type}
 *       description={check.description}
 *       isApproved={check.is_checked}
 *       tabs={[
 *         { id: 'result', label: 'Result', content: <ResultView run={run} /> },
 *         { id: 'query', label: 'Query', content: <QueryView sql={check.params.sql} /> },
 *       ]}
 *       primaryActions={[
 *         { type: 'run', label: 'Run' },
 *         { type: 'approve', label: check.is_checked ? 'Approved' : 'Pending' },
 *       ]}
 *       secondaryActions={[
 *         { type: 'delete', label: 'Delete', destructive: true },
 *       ]}
 *       onAction={(id, action) => handleAction(id, action)}
 *       onDescriptionChange={(desc) => updateCheck(id, { description: desc })}
 *     />
 *   );
 * }
 * ```
 *
 * @example With sidebar
 * ```tsx
 * <CheckDetail
 *   {...props}
 *   sidebarContent={<CheckTimeline checkId={check.id} />}
 * />
 * ```
 */
function CheckDetailComponent({
  checkId,
  name,
  type,
  description,
  isApproved = false,
  tabs = [],
  defaultTab,
  primaryActions = [],
  secondaryActions = [],
  onAction,
  onDescriptionChange,
  onNameChange,
  disabled = false,
  headerContent,
  sidebarContent,
  className,
}: CheckDetailProps) {
  const [selectedTab, setSelectedTab] = useState(defaultTab ?? tabs[0]?.id);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);

  const handleNameClick = () => {
    if (!disabled) {
      setIsEditingName(true);
      setEditedName(name);
    }
  };

  const handleNameSave = () => {
    if (editedName.trim() && editedName !== name) {
      onNameChange?.(editedName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameSave();
    } else if (e.key === "Escape") {
      setEditedName(name);
      setIsEditingName(false);
    }
  };

  const selectedTabContent = tabs.find((t) => t.id === selectedTab)?.content;

  return (
    <Box
      className={className}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        {headerContent}

        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          {/* Name */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {isEditingName ? (
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown}
                autoFocus
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 500,
                  border: "none",
                  borderBottom: "2px solid",
                  borderColor: "currentColor",
                  outline: "none",
                  background: "transparent",
                  width: "100%",
                }}
              />
            ) : (
              <Typography
                variant="h6"
                onClick={handleNameClick}
                sx={{
                  cursor: disabled ? "default" : "pointer",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  "&:hover": {
                    textDecoration: disabled ? "none" : "underline",
                  },
                }}
              >
                {name}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {type} {isApproved && "• Approved"}
            </Typography>
          </Box>

          {/* Actions */}
          <CheckActions
            checkId={checkId}
            primaryActions={primaryActions}
            secondaryActions={secondaryActions}
            onAction={onAction}
          />
        </Box>
      </Box>

      {/* Main content area */}
      <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
        {/* Main panel */}
        <Box
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Description */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Description
            </Typography>
            <CheckDescription
              value={description}
              onChange={onDescriptionChange}
              disabled={disabled}
            />
          </Box>

          {/* Tabs */}
          {tabs.length > 0 && (
            <>
              <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                  value={selectedTab}
                  onChange={(_e, newValue) => setSelectedTab(newValue)}
                >
                  {tabs.map((tab) => (
                    <Tab key={tab.id} value={tab.id} label={tab.label} />
                  ))}
                </Tabs>
              </Box>

              {/* Tab content */}
              <Box sx={{ flexGrow: 1, overflow: "auto", p: 2 }}>
                {selectedTabContent}
              </Box>
            </>
          )}
        </Box>

        {/* Sidebar */}
        {sidebarContent && (
          <>
            <Divider orientation="vertical" flexItem />
            <Box
              sx={{
                width: 350,
                flexShrink: 0,
                overflow: "auto",
              }}
            >
              {sidebarContent}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

export const CheckDetail = memo(CheckDetailComponent);
CheckDetail.displayName = "CheckDetail";
