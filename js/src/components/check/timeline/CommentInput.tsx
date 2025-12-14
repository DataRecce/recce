/**
 * CommentInput - Text area for adding new comments to a check timeline.
 */

import { Box, Button, Flex, Textarea } from "@/components/ui/mui";
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd+Enter or Ctrl+Enter
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Box>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        size="sm"
        resize="vertical"
        minH="80px"
        bg="white"
        borderColor="gray.200"
        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #4299E1" }}
        disabled={isSubmitting}
      />
      <Flex justify="flex-end" mt={2}>
        <Button
          size="sm"
          colorPalette="blue"
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          loading={isSubmitting}
        >
          Comment
        </Button>
      </Flex>
    </Box>
  );
}
