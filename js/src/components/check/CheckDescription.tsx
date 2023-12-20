import { Button, Flex, Text, Textarea } from "@chakra-ui/react";
import { ChangeEventHandler, KeyboardEventHandler, useState } from "react";

interface CheckDescriptionProps {
  value?: string;
  onChange?: (value?: string) => void;
}

export function CheckDescription({ value, onChange }: CheckDescriptionProps) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState<string>();

  if (editing) {
  }

  const handleEdit = () => {
    setTempValue(value || "");
    setEditing(true);
  };

  const handleKeyDown: KeyboardEventHandler = (event) => {
    if (event.key === "Escape") {
      setEditing(false);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setEditing(false);
    }, 100);
  };

  const handleUpdate = () => {
    if (onChange) {
      onChange(tempValue);
    }
  };

  const handleChange: ChangeEventHandler = (event) => {
    setTempValue((event.target as any).value);
  };

  if (editing) {
    return (
      <Flex direction="column" align="flex-end">
        <Textarea
          h="200px"
          value={tempValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        ></Textarea>
        <Button mt="8px" size="sm" colorScheme="blue" onClick={handleUpdate}>
          Update
        </Button>
      </Flex>
    );
  }

  return (
    <Text
      onClick={handleEdit}
      whiteSpace="pre-line"
      color={!value ? "lightgray" : "inherit"}
    >
      {!value ? "Add description here" : value}
    </Text>
  );
}
