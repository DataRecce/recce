"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { memo, type ReactNode } from "react";

/**
 * Props for the CheckEmptyState component
 */
export interface CheckEmptyStateProps {
  /** Main title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Icon element to display */
  icon?: ReactNode;
  /** Primary action button text */
  actionText?: string;
  /** Callback when primary action is clicked */
  onAction?: () => void;
  /** Whether the action is loading */
  isLoading?: boolean;
  /** Optional helper text below the action */
  helperText?: string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * CheckEmptyState Component
 *
 * A pure presentation component for displaying an empty state
 * when no checks exist in the list.
 *
 * @example Basic usage
 * ```tsx
 * import { CheckEmptyState } from '@datarecce/ui/primitives';
 *
 * function MyCheckList() {
 *   if (checks.length === 0) {
 *     return (
 *       <CheckEmptyState
 *         title="No checks yet"
 *         description="Create your first check to start validating data"
 *         actionText="Create Schema Diff Check"
 *         onAction={() => createSchemaDiffCheck()}
 *       />
 *     );
 *   }
 *   return <CheckList checks={checks} />;
 * }
 * ```
 *
 * @example Custom icon
 * ```tsx
 * import { TbChecklist } from 'react-icons/tb';
 *
 * <CheckEmptyState
 *   icon={<TbChecklist size={48} />}
 *   title="No checks found"
 *   description="Checks help you validate your data changes"
 * />
 * ```
 */
function CheckEmptyStateComponent({
  title = "No checks yet",
  description = "Create your first check to start validating data changes",
  icon,
  actionText,
  onAction,
  isLoading = false,
  helperText,
  className,
}: CheckEmptyStateProps) {
  return (
    <Box
      className={className}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 4,
        minHeight: 300,
      }}
    >
      <Stack spacing={2} alignItems="center">
        {/* Icon */}
        {icon && (
          <Box
            sx={{
              color: "text.secondary",
              fontSize: 48,
              mb: 1,
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
            color: "text.primary",
          }}
        >
          {title}
        </Typography>

        {/* Description */}
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            maxWidth: 400,
          }}
        >
          {description}
        </Typography>

        {/* Action button */}
        {actionText && onAction && (
          <Button
            variant="contained"
            onClick={onAction}
            disabled={isLoading}
            sx={{ mt: 2 }}
          >
            {isLoading ? "Creating..." : actionText}
          </Button>
        )}

        {/* Helper text */}
        {helperText && (
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              mt: 1,
            }}
          >
            {helperText}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export const CheckEmptyState = memo(CheckEmptyStateComponent);
CheckEmptyState.displayName = "CheckEmptyState";
