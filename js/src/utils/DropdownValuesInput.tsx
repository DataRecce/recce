import React, { useState, useRef } from "react";
import {
  Box,
  Button,
  Icon,
  Input,
  InputGroup,
  InputProps,
  Menu,
  Portal,
  Tag,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { FaChevronDown } from "react-icons/fa6";

import { Tooltip } from "@/components/ui/tooltip";

export interface DropdownValuesInputProps extends InputProps {
  unitName: string;
  suggestionList?: string[];
  defaultValues?: string[];
  onValuesChange: (values: string[]) => void;
}

export const DropdownValuesInput = (props: DropdownValuesInputProps) => {
  const { defaultValues, suggestionList, onValuesChange, className } = props;
  const [values, setValues] = useState<string[]>(defaultValues ?? []);
  const [filter, setFilter] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const showNumberOfValuesSelected = (tags: string[]) => {
    if (tags.length > 1) {
      return `${tags.length} ${props.unitName}s selected`;
    } else if (tags.length === 1) {
      return tags[0];
    }
    return "";
  };

  const handleSelect = (value: string) => {
    if (!values.includes(value)) {
      setFilter("");
      setValues([...values, value]);
      onValuesChange([...values, value]);
    }
  };

  const handleClear = () => {
    setFilter("");
    setValues([]);
    onValuesChange([]);
  };

  const filteredList =
    suggestionList
      ?.filter((value) => filter === "" || value.includes(filter))
      .filter((value) => !values.includes(value)) ?? [];
  const limit = 10;

  return (
    <InputGroup
      width={props.width}
      className={className}
      endAddon={
        values.length > 0 && (
          <Button
            variant="ghost"
            color={"#3182CE"}
            fontSize={props.size}
            paddingTop="4px"
            paddingRight={"24px"}
            onClick={handleClear}>
            Clear
          </Button>
        )
      }>
      <Menu.Root lazyMount closeOnSelect={false} onOpenChange={() => inputRef.current?.focus()}>
        <Menu.Trigger asChild>
          <Button width={"100%"}>
            <InputGroup
              endAddon={
                values.length === 0 && (
                  <Icon as={FaChevronDown} color="blue.500" fontSize={props.size} mt="1" mr="6" />
                )
              }>
              <Input
                className="no-track-pii-safe"
                placeholder={props.placeholder}
                size={props.size}
                borderRadius={"4px"}
                value={showNumberOfValuesSelected(values)}
                onChange={() => {}} // Prevent input change
                backgroundColor={"white"}
              />
            </InputGroup>
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content
              zIndex={"popover"}
              fontSize={props.size}
              width={props.width}
              className="no-track-pii-safe">
              {/* Input Filter & Show Tags */}
              <Menu.ItemGroup>
                <Wrap
                  border={"1px solid #e2e8f0"}
                  borderRadius={"4px"}
                  width={"calc(100% - 8px)"}
                  marginX={"4px"}
                  padding={"4px"}>
                  {values.map((value, cid) => (
                    <WrapItem key={`tag-${cid}`}>
                      <Tag.Root
                        key={value}
                        size={
                          props.size === "sm"
                            ? props.size
                            : props.size === "md"
                              ? props.size
                              : props.size === "lg"
                                ? props.size
                                : "md"
                        }>
                        <Tag.Label paddingLeft={"8px"}>{value}</Tag.Label>
                        <Tag.EndElement>
                          <Tag.CloseTrigger
                            paddingRight={"8px"}
                            onClick={() => {
                              setValues(values.filter((v) => v !== value));
                              onValuesChange(values.filter((v) => v !== value));
                            }}
                          />
                        </Tag.EndElement>
                      </Tag.Root>
                    </WrapItem>
                  ))}
                  <WrapItem width={"100%"}>
                    <Input
                      ref={inputRef}
                      placeholder="Filter or add custom keys"
                      variant="subtle"
                      size={props.size}
                      value={filter}
                      onChange={(e) => {
                        setFilter(e.target.value);
                        setIsTyping(true);
                      }}
                      onKeyDown={(e) => {
                        const newText = e.currentTarget.value.trim().replace(",", "");
                        switch (e.key) {
                          case ",":
                          case "Enter":
                            handleSelect(newText);
                            setFilter("");
                            break;
                          case "Backspace":
                            if (e.currentTarget.value === "" && values.length > 0) {
                              setValues(values.slice(0, -1));
                              onValuesChange(values.slice(0, -1));
                            }
                            break;
                          default:
                            break;
                        }
                      }}
                      onBlur={() => {
                        if (inputRef.current && isTyping) inputRef.current.focus();
                      }}
                    />
                  </WrapItem>
                </Wrap>
              </Menu.ItemGroup>
              <Menu.Separator />
              {/* Suggestion List */}
              <Menu.ItemGroup>
                {filter !== "" && !suggestionList?.includes(filter) && (
                  <Menu.Item
                    key={"custom-value-by-filter"}
                    value="custom-value-by-filter"
                    onClick={() => {
                      handleSelect(filter);
                      setIsTyping(false);
                    }}>
                    Add &apos;{filter}&apos; to the list
                  </Menu.Item>
                )}
                {filteredList
                  .map((value, cid) => (
                    <Menu.Item
                      key={`option-${cid}`}
                      value={`option-${cid}`}
                      onClick={() => {
                        handleSelect(value);
                      }}>
                      {value}
                    </Menu.Item>
                  ))
                  .slice(0, limit)}
                {filteredList.length > limit && (
                  <Tooltip
                    content="Please use filter to find more items"
                    positioning={{ placement: "top" }}>
                    <Box px="12px" color="gray" fontSize="8pt">
                      and {filteredList.length - limit} more items...
                    </Box>
                  </Tooltip>
                )}
              </Menu.ItemGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </InputGroup>
  );
};
