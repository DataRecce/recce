import React, { useState, useRef, useEffect } from "react";
import {
  Button,
  Icon,
  Input,
  InputGroup,
  InputProps,
  InputRightElement,
  Menu,
  MenuButton,
  MenuDivider,
  MenuGroup,
  MenuItem,
  MenuList,
  Portal,
  Tag,
  TagCloseButton,
  TagLabel,
  Tooltip,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { FaChevronDown } from "react-icons/fa6";

import { DisableTooltipMessages } from "@/constants/tooltipMessage";

export interface DropdownValuesInputProps extends InputProps {
  unitName: string;
  suggestionList?: string[];
  defaultValues?: string[];
  onValuesChange: (values: string[]) => void;
}

export const DropdownValuesInput = (props: DropdownValuesInputProps) => {
  const { defaultValues, suggestionList, onValuesChange, isDisabled } = props;
  const [values, setValues] = useState<string[]>(defaultValues || []);
  const [filter, setFilter] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const showNumberOfValuesSelected = (tags: string[]) => {
    if (tags.length > 1) {
      return `${tags.length} ${props.unitName}s selected`;
    } else if (tags.length === 1) {
      return `${tags[0]}`;
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

  if (isDisabled) {
    return (
      <Tooltip label={DisableTooltipMessages.audit_helper}>
        <Input size="xs" disabled placeholder="Unavailable" />
      </Tooltip>
    );
  }

  return (
    <InputGroup size={props.size} width={props.width}>
      <Menu
        isLazy
        closeOnSelect={false}
        onOpen={() => inputRef?.current?.focus()}
      >
        <MenuButton width={"100%"}>
          <Input
            placeholder={props.placeholder}
            size={props.size}
            borderRadius={"4px"}
            value={showNumberOfValuesSelected(values)}
            onChange={() => {}} // Prevent input change
            backgroundColor={"white"}
          />
          {values.length === 0 && (
            <InputRightElement>
              <Icon
                as={FaChevronDown}
                color="blue.500"
                fontSize={props.size}
                mt="1"
                mr="6"
              />
            </InputRightElement>
          )}
        </MenuButton>
        <Portal>
          <MenuList
            zIndex={"popover"}
            fontSize={props.size}
            width={props.width}
          >
            {/* Input Filter & Show Tags */}
            <MenuGroup>
              <Wrap
                border={"1px solid #e2e8f0"}
                borderRadius={"4px"}
                width={"calc(100% - 8px)"}
                marginX={"4px"}
                padding={"4px"}
              >
                {values.map((value, cid) => (
                  <WrapItem key={`tag-${cid}`}>
                    <Tag key={value} size={props.size}>
                      <TagLabel paddingLeft={"8px"}>{value}</TagLabel>
                      <TagCloseButton
                        paddingRight={"8px"}
                        onClick={() => {
                          setValues(values.filter((v) => v !== value));
                          onValuesChange(values.filter((v) => v !== value));
                        }}
                      />
                    </Tag>
                  </WrapItem>
                ))}
                <WrapItem width={"100%"}>
                  <Input
                    ref={inputRef}
                    placeholder="Filter or add custom keys"
                    variant={"unstyled"}
                    size={props.size}
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setIsTyping(true);
                    }}
                    onKeyDown={(e) => {
                      const newText = e.currentTarget.value
                        .trim()
                        .replace(",", "");
                      switch (e.key) {
                        case ",":
                        case "Enter":
                          handleSelect(newText);
                          setFilter("");
                          break;
                        case "Backspace":
                          if (
                            e.currentTarget.value === "" &&
                            values.length > 0
                          ) {
                            setValues(values.slice(0, -1));
                            onValuesChange(values.slice(0, -1));
                          }
                          break;
                        default:
                          break;
                      }
                    }}
                    onBlur={() => {
                      if (inputRef && isTyping) inputRef?.current?.focus();
                    }}
                  />
                </WrapItem>
              </Wrap>
            </MenuGroup>
            <MenuDivider />
            {/* Suggestion List */}
            <MenuGroup>
              {filter !== "" && !suggestionList?.includes(filter) && (
                <MenuItem
                  key={"custom-value-by-filter"}
                  onClick={() => {
                    handleSelect(filter);
                    setIsTyping(false);
                  }}
                >
                  Add &apos;{filter}&apos; to the list
                </MenuItem>
              )}
              {suggestionList
                ?.filter((value) => filter === "" || value.includes(filter))
                .filter((value) => !values.includes(value))
                ?.map((value, cid) => (
                  <MenuItem
                    key={`option-${cid}`}
                    onClick={() => handleSelect(value)}
                  >
                    {value}
                  </MenuItem>
                ))
                .slice(0, 10)}
            </MenuGroup>
          </MenuList>
        </Portal>
      </Menu>
      {values.length > 0 && (
        <InputRightElement>
          <Button
            variant={"link"}
            color={"#3182CE"}
            fontSize={props.size}
            paddingTop="4px"
            paddingRight={"24px"}
            onClick={handleClear}
          >
            Clear
          </Button>
        </InputRightElement>
      )}
    </InputGroup>
  );
};
