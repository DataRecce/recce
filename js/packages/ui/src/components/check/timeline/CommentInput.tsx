"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { memo, useCallback, useState } from "react";
import { useIsDark } from "../../../hooks/useIsDark";

/**
 * Props for the CommentInput component
 */
export interface CommentInputProps {
  /** Callback when comment is submitted */
  onSubmit: (content: string) => void;
  /** Whether submission is in progress */
  isSubmitting?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Button text (defaults to "Comment") */
  submitLabel?: string;
  /** Submitting button text (defaults to "Submitting...") */
  submittingLabel?: string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * CommentInput Component
 *
 * A pure presentation component for adding comments to a timeline.
 * Supports Cmd+Enter (Mac) or Ctrl+Enter (Windows) keyboard shortcut to submit.
 *
 * @example Basic usage
 * ```tsx
 * import { CommentInput } from '@datarecce/ui/primitives';
 *
 * function CheckTimeline({ checkId }) {
 *   const [isSubmitting, setIsSubmitting] = useState(false);
 *
 *   const handleSubmit = async (content: string) => {
 *     setIsSubmitting(true);
 *     await addComment(checkId, content);
 *     setIsSubmitting(false);
 *   };
 *
 *   return (
 *     <CommentInput
 *       onSubmit={handleSubmit}
 *       isSubmitting={isSubmitting}
 *     />
 *   );
 * }
 * ```
 *
 * @example Custom labels
 * ```tsx
 * <CommentInput
 *   onSubmit={handleSubmit}
 *   placeholder="Leave feedback..."
 *   submitLabel="Send"
 *   submittingLabel="Sending..."
 * />
 * ```
 */
function CommentInputComponent({
  onSubmit,
  isSubmitting = false,
  placeholder = "Add a comment...",
  submitLabel = "Comment",
  submittingLabel = "Submitting...",
  className,
}: CommentInputProps) {
  const isDark = useIsDark();
  const [content, setContent] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setContent("");
    }
  }, [content, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Submit on Cmd+Enter or Ctrl+Enter
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setContent(e.target.value);
    },
    [],
  );

  return (
    <Box className={className}>
      <TextField
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        size="small"
        multiline
        fullWidth
        minRows={3}
        disabled={isSubmitting}
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: "background.paper",
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? "grey.500" : "grey.400",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "iochmara.400",
              boxShadow: "0 0 0 1px #4299E1",
            },
          },
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: isDark ? "grey.600" : undefined,
          },
        }}
      />
      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
        <Button
          size="small"
          color="iochmara"
          variant="contained"
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      </Stack>
    </Box>
  );
}

export const CommentInput = memo(CommentInputComponent);
CommentInput.displayName = "CommentInput";
