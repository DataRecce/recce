"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useState,
} from "react";

/**
 * Props for the CheckDescription component
 */
export interface CheckDescriptionProps {
  /** Current description value */
  value?: string;
  /** Callback when description is saved */
  onChange?: (value?: string) => void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Optional CSS class name */
  className?: string;
}

/**
 * CheckDescription Component
 *
 * A pure presentation component for displaying and editing check descriptions.
 * Supports click-to-edit with Cmd+Enter (Mac) or Ctrl+Enter (Windows) to save.
 *
 * @example Basic usage
 * ```tsx
 * import { CheckDescription } from '@datarecce/ui/primitives';
 *
 * function CheckDetail({ check }) {
 *   return (
 *     <CheckDescription
 *       value={check.description}
 *       onChange={(desc) => updateCheck(check.id, { description: desc })}
 *       placeholder="Add a description..."
 *     />
 *   );
 * }
 * ```
 *
 * @example Disabled state
 * ```tsx
 * <CheckDescription
 *   value={check.description}
 *   disabled
 *   placeholder="Description not available"
 * />
 * ```
 */
function CheckDescriptionComponent({
  value,
  onChange,
  placeholder = "Add description here",
  disabled = false,
  className,
}: CheckDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");

  // Sync edit value when external value changes
  useEffect(() => {
    setEditValue(value ?? "");
  }, [value]);

  const handleStartEdit = useCallback(() => {
    if (!disabled) {
      setIsEditing(true);
      setEditValue(value ?? "");
    }
  }, [disabled, value]);

  const handleSave = useCallback(() => {
    const trimmedValue = editValue.trim();
    onChange?.(trimmedValue || undefined);
    setIsEditing(false);
  }, [editValue, onChange]);

  const handleCancel = useCallback(() => {
    setEditValue(value ?? "");
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Cmd+Enter (Mac) or Ctrl+Enter (Windows) to save
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
      // Escape to cancel
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel],
  );

  // Editing mode
  if (isEditing) {
    return (
      <Box className={className} sx={{ height: "100%" }}>
        <TextField
          multiline
          fullWidth
          minRows={3}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus
          sx={{
            "& .MuiInputBase-root": {
              fontSize: "0.875rem",
            },
          }}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button variant="contained" size="small" onClick={handleSave}>
            Update
          </Button>
          <Link
            component="button"
            variant="body2"
            onClick={handleCancel}
            sx={{ cursor: "pointer" }}
          >
            Cancel
          </Link>
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.5 }}
        >
          {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to save,
          Escape to cancel
        </Typography>
      </Box>
    );
  }

  // View mode
  return (
    <Box
      className={className}
      onClick={handleStartEdit}
      sx={{
        height: "100%",
        overflow: "auto",
        cursor: disabled ? "default" : "pointer",
        padding: 1,
        borderRadius: 1,
        "&:hover": {
          backgroundColor: disabled ? "transparent" : "action.hover",
        },
      }}
    >
      {value ? (
        <Typography
          variant="body2"
          sx={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {value}
        </Typography>
      ) : (
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontStyle: "italic",
          }}
        >
          {placeholder}
        </Typography>
      )}
    </Box>
  );
}

export const CheckDescription = memo(CheckDescriptionComponent);
CheckDescription.displayName = "CheckDescription";
