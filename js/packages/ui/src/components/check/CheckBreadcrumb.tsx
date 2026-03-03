"use client";

import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import {
  type ChangeEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Props for the CheckBreadcrumb component
 */
export interface CheckBreadcrumbProps {
  /** Current name value */
  name: string;
  /** Callback when name is saved */
  onNameChange?: (name: string) => void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Optional CSS class name */
  className?: string;
}

/**
 * CheckBreadcrumb Component
 *
 * A pure presentation component for displaying and editing a check name inline.
 * Supports click-to-edit behavior with Enter to save and Escape to cancel.
 * Also commits changes when clicking outside the input.
 *
 * @example Basic usage
 * ```tsx
 * import { CheckBreadcrumb } from '@datarecce/ui/primitives';
 *
 * function CheckHeader({ check }) {
 *   return (
 *     <CheckBreadcrumb
 *       name={check.name}
 *       onNameChange={(name) => updateCheck(check.id, { name })}
 *     />
 *   );
 * }
 * ```
 *
 * @example Disabled state
 * ```tsx
 * <CheckBreadcrumb
 *   name={check.name}
 *   disabled
 *   placeholder="Unnamed check"
 * />
 * ```
 *
 * @example With placeholder
 * ```tsx
 * <CheckBreadcrumb
 *   name=""
 *   placeholder="Enter check name..."
 *   onNameChange={(name) => updateCheck(check.id, { name })}
 * />
 * ```
 */
function CheckBreadcrumbComponent({
  name,
  onNameChange,
  placeholder = "Unnamed check",
  disabled = false,
  className,
}: CheckBreadcrumbProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Sync edit value when external name changes
  useEffect(() => {
    setEditValue(name);
  }, [name]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      setEditValue(name);
      setIsEditing(true);
    }
  }, [disabled, name]);

  const handleCommit = useCallback(() => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== name) {
      onNameChange?.(trimmedValue);
    }
    setIsEditing(false);
  }, [editValue, name, onNameChange]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleCommit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setEditValue(name);
        setIsEditing(false);
      }
    },
    [handleCommit, name],
  );

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEditValue(event.target.value);
  }, []);

  // Handle click outside to commit changes
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        editInputRef.current &&
        !editInputRef.current.contains(event.target as Node | null)
      ) {
        handleCommit();
      }
    };

    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing, handleCommit]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  return (
    <Box
      className={className}
      sx={{
        flex: "2",
        fontSize: "1rem",
        fontWeight: 500,
        overflow: "hidden",
        color: "text.primary",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {isEditing ? (
        <TextField
          inputRef={editInputRef}
          value={editValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          size="small"
          sx={{ width: "100%" }}
          variant="outlined"
        />
      ) : (
        <Box
          sx={{
            flex: "0 1 auto",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            overflow: "hidden",
            "&:hover": {
              textDecoration: disabled ? "none" : "underline",
            },
          }}
          onClick={handleClick}
        >
          {name || (
            <Box
              component="span"
              sx={{ color: "text.secondary", fontStyle: "italic" }}
            >
              {placeholder}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export const CheckBreadcrumb = memo(CheckBreadcrumbComponent);
CheckBreadcrumb.displayName = "CheckBreadcrumb";
