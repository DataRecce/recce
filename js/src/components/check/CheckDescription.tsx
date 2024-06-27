import { Button, Flex, Link, Text, Textarea } from "@chakra-ui/react";
import {
  ChangeEventHandler,
  KeyboardEventHandler,
  useEffect,
  useRef,
  useState,
} from "react";

interface CheckDescriptionProps {
  value?: string;
  onChange?: (value?: string) => void;
}

export function CheckDescription({ value, onChange }: CheckDescriptionProps) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState<string>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEdit = () => {
    setTempValue(value || "");
    setEditing(true);
  };

  const handleKeyDown: KeyboardEventHandler = (event) => {
    if (event.key === "Escape") {
      setEditing(false);
    }
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

  const handleChange: ChangeEventHandler = (event) => {
    setTempValue((event.target as any).value);
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
      <Flex direction="column" align="flex-end" height="100%">
        <Textarea
          value={tempValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          ref={textareaRef}
          flex={1}
        ></Textarea>
        <Flex gap="12px" alignItems="flex-end">
          <Link onClick={handleCancel} colorScheme="blue">
            cancel
          </Link>
          <Button mt="8px" size="sm" colorScheme="blue" onClick={handleUpdate}>
            Update
          </Button>
        </Flex>
      </Flex>
    );
  }

  return (
    <Text
      overflow="auto"
      fontSize="11pt"
      onClick={handleEdit}
      whiteSpace="pre"
      color={!value ? "lightgray" : "inherit"}
    >
      {!value ? "Add description here" : value}
    </Text>
  );
}
