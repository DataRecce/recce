import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  ChangeEvent,
  ChangeEventHandler,
  KeyboardEventHandler,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";

interface CheckDescriptionProps {
  value?: string;
  onChange?: (value?: string) => void;
}

export function CheckDescription({ value, onChange }: CheckDescriptionProps) {
  const { featureToggles } = useRecceInstanceContext();
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState<string>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEdit = () => {
    setTempValue(value ?? "");
    setEditing(true);
  };

  const handleCancel = () => {
    setTimeout(() => {
      setEditing(false);
    }, 100);
  };

  const handleUpdate = () => {
    if (onChange) {
      onChange(tempValue);
      setEditing(false);
    }
  };

  const handleKeyDown: KeyboardEventHandler = (event) => {
    if (event.key === "Escape") {
      setEditing(false);
    }
    if (
      (event.metaKey || event.ctrlKey) && // mac: cmd, windows: ctrl
      event.key === "Enter"
    ) {
      event.preventDefault();
      handleUpdate();
    }
  };

  const handleChange: ChangeEventHandler = (
    event: ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setTempValue(event.target.value);
  };

  useEffect(() => {
    if (editing && textareaRef.current) {
      const element = textareaRef.current;
      element.focus();
      element.setSelectionRange(element.value.length, element.value.length);
    }
  }, [editing]);

  if (editing) {
    return (
      <Stack
        direction="column"
        alignItems="flex-end"
        spacing={1}
        sx={{ height: "100%" }}
        className="no-track-pii-safe"
      >
        <TextField
          value={tempValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          inputRef={textareaRef}
          multiline
          fullWidth
          sx={{ flex: 1 }}
          slotProps={{
            input: {
              sx: { height: "100%", alignItems: "flex-start" },
            },
          }}
        />
        <Stack direction="row" spacing={4} alignItems="center">
          <Link
            onClick={handleCancel}
            sx={{ color: "primary.main", cursor: "pointer" }}
          >
            cancel
          </Link>
          <Button
            sx={{ mt: "8px" }}
            size="small"
            color="iochmara"
            variant="contained"
            onClick={handleUpdate}
          >
            Update
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Typography
      className="no-track-pii-safe"
      sx={{
        height: "100%",
        overflow: "auto",
        fontSize: "11pt",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        color: !value ? "lightgray" : "inherit",
        cursor: !featureToggles.disableUpdateChecklist ? "pointer" : "default",
      }}
      onClick={!featureToggles.disableUpdateChecklist ? handleEdit : undefined}
    >
      {(value ?? "").trim() || "Add description here"}
    </Typography>
  );
}
