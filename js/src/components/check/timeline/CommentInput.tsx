/**
 * CommentInput - Text area for adding new comments to a check timeline.
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useState } from "react";

interface CommentInputProps {
  onSubmit: (content: string) => void;
  isSubmitting?: boolean;
  placeholder?: string;
}

export function CommentInput({
  onSubmit,
  isSubmitting = false,
  placeholder = "Add a comment...",
}: CommentInputProps) {
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Submit on Cmd+Enter or Ctrl+Enter
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Box>
      <TextField
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        size="small"
        multiline
        fullWidth
        minRows={3}
        disabled={isSubmitting}
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: "white",
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "grey.400",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "iochmara.400",
              boxShadow: "0 0 0 1px #4299E1",
            },
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
          {isSubmitting ? "Submitting..." : "Comment"}
        </Button>
      </Stack>
    </Box>
  );
}
