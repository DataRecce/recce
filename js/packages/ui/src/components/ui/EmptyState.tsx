"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { memo, type ReactNode } from "react";

/**
 * Props for the EmptyState component
 */
export interface EmptyStateProps {
  /** Main title text */
  title: string;
  /** Description text */
  description?: string;
  /** Icon to display */
  icon?: ReactNode;
  /** Primary action button text */
  actionLabel?: string;
  /** Primary action callback */
  onAction?: () => void;
  /** Secondary action button text */
  secondaryActionLabel?: string;
  /** Secondary action callback */
  onSecondaryAction?: () => void;
  /** Theme mode */
  theme?: "light" | "dark";
  /** Vertical padding */
  paddingY?: number;
  /** Optional CSS class */
  className?: string;
  /** Additional content below actions */
  children?: ReactNode;
}

/**
 * EmptyState Component
 *
 * A pure presentation component for displaying empty states
 * with optional icon, actions, and custom content.
 *
 * @example Basic usage
 * ```tsx
 * import { EmptyState } from '@datarecce/ui/primitives';
 *
 * function ChecksPanel({ checks }) {
 *   if (checks.length === 0) {
 *     return (
 *       <EmptyState
 *         title="No checks yet"
 *         description="Create your first check to get started"
 *       />
 *     );
 *   }
 *   // ... render checks
 * }
 * ```
 *
 * @example With action button
 * ```tsx
 * <EmptyState
 *   title="No results found"
 *   description="Try adjusting your search criteria"
 *   actionLabel="Clear Filters"
 *   onAction={() => clearFilters()}
 * />
 * ```
 *
 * @example With icon and multiple actions
 * ```tsx
 * <EmptyState
 *   icon={<FolderIcon />}
 *   title="No files"
 *   description="Upload files to get started"
 *   actionLabel="Upload File"
 *   onAction={handleUpload}
 *   secondaryActionLabel="Learn More"
 *   onSecondaryAction={() => window.open(docsUrl)}
 * />
 * ```
 */
function EmptyStateComponent({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  theme = "light",
  paddingY = 8,
  className,
  children,
}: EmptyStateProps) {
  const isDark = theme === "dark";

  return (
    <Box
      className={className}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        py: paddingY,
        px: 4,
        height: "100%",
        minHeight: 200,
      }}
    >
      {/* Icon */}
      {icon && (
        <Box
          sx={{
            mb: 2,
            color: isDark ? "grey.500" : "grey.400",
            "& svg": {
              width: 48,
              height: 48,
            },
          }}
        >
          {icon}
        </Box>
      )}

      {/* Title */}
      <Typography
        variant="h6"
        sx={{
          fontWeight: 500,
          color: isDark ? "grey.300" : "grey.700",
          mb: description ? 1 : 0,
        }}
      >
        {title}
      </Typography>

      {/* Description */}
      {description && (
        <Typography
          variant="body2"
          sx={{
            color: isDark ? "grey.400" : "grey.500",
            maxWidth: 400,
            mb: actionLabel || secondaryActionLabel ? 3 : 0,
          }}
        >
          {description}
        </Typography>
      )}

      {/* Actions */}
      {(actionLabel || secondaryActionLabel) && (
        <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
          {actionLabel && onAction && (
            <Button variant="contained" onClick={onAction} size="small">
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outlined" onClick={onSecondaryAction} size="small">
              {secondaryActionLabel}
            </Button>
          )}
        </Box>
      )}

      {/* Additional content */}
      {children && <Box sx={{ mt: 3 }}>{children}</Box>}
    </Box>
  );
}

export const EmptyState = memo(EmptyStateComponent);
EmptyState.displayName = "EmptyState";
