import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

interface CheckBreadcrumbProps {
  name: string;
  setName: (name: string) => void;
}

export function CheckBreadcrumb({ name, setName }: CheckBreadcrumbProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    setEditValue(name);
    setIsEditing(true);
  };

  const handleCommit = useCallback(() => {
    setName(editValue);
    setIsEditing(false);
  }, [setName, editValue]);

  const handleKeyDown: React.KeyboardEventHandler = (event) => {
    if (event.key === "Enter") {
      setName(editValue);
      setIsEditing(false);
    } else if (event.key === "Escape") {
      setEditValue(name);
      setIsEditing(false);
    }
  };

  const handleChange: React.ChangeEventHandler = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setEditValue(event.target.value);
  };

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

  return (
    <Box
      sx={{
        flex: "2",
        fontSize: "1rem",
        fontWeight: 500,
        overflow: "hidden",
        color: "text.primary",
        cursor: "pointer",
      }}
      className="no-track-pii-safe"
    >
      {isEditing ? (
        <TextField
          inputRef={editInputRef}
          value={editValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
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
          }}
          onClick={handleClick}
        >
          {name}
        </Box>
      )}
    </Box>
  );
}
