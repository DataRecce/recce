import React, {
  useState,
  useEffect,
  useRef,
  ChangeEventHandler,
  KeyboardEventHandler,
  ChangeEvent,
} from "react";
import {
  Input,
  InputGroup,
  InputProps,
  Tag,
  TagCloseButton,
  TagLabel,
  Wrap,
  WrapItem,
  forwardRef,
} from "@chakra-ui/react";

export interface TagInputProps extends InputProps {
  tags?: string[];
  onValueChange: (value: string) => void;
  onTagChange: (tag: string | undefined, action: string) => void;
}

export const TagInput = forwardRef((props: TagInputProps, ref) => {
  const { ...inputProps } = props;
  const size = props.size || "md";
  const selectedTags = props.tags || [];

  const clearInputValue = () => {
    props.onValueChange("");
  };

  return (
    <Wrap
      border={"1px solid #e2e8f0"}
      borderRadius={"4px"}
      width={"calc(100% - 8px)"}
      marginX={"4px"}
      padding={"4px"}
    >
      {selectedTags.map((tag) => (
        <WrapItem key={tag}>
          <Tag key={tag} size={size}>
            <TagLabel paddingLeft={"8px"}>{tag}</TagLabel>
            <TagCloseButton
              paddingRight={"8px"}
              onClick={() => {
                props.onTagChange(tag, "remove");
              }}
            />
          </Tag>
        </WrapItem>
      ))}
      <WrapItem>
        <InputGroup>
          <Input
            {...inputProps}
            ref={ref}
            variant={"unstyled"}
            onChange={(e) => {
              props.onValueChange(e.target.value);
            }}
            onKeyDown={(e) => {
              const newText = e.currentTarget.value.trim().replace(",", "");
              switch (e.key) {
                case ",":
                case "Enter":
                  props.onTagChange(newText, "add");
                  clearInputValue();
                  break;
                case "Backspace":
                  if (e.currentTarget.value === "" && selectedTags.length > 0) {
                    props.onTagChange(selectedTags.pop(), "remove");
                  }
                  break;
                default:
                  break;
              }
            }}
            onBlur={() => {
              if (ref) ref?.current?.focus();
            }}
          />
        </InputGroup>
      </WrapItem>
    </Wrap>
  );
});
