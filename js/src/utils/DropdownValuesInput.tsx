import {
  Box,
  Button,
  Input,
  InputGroup,
  InputProps,
  Menu,
  Portal,
  Tag,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import _ from "lodash";
import React, { useRef, useState } from "react";
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

  // Filter the suggestion list without case sensitivity based on the current input
  const lowerCaseFilter = filter.toLowerCase();
  const filteredList =
    suggestionList
      ?.filter(
        (value) =>
          lowerCaseFilter === "" ||
          value.toLowerCase().includes(lowerCaseFilter),
      )
      .filter((value) => !values.includes(value)) ?? [];
  const limit = 10;

  const endElement =
    values.length > 0 ? (
      <Button
        size="2xs"
        variant="ghost"
        color={"#3182CE"}
        fontSize={props.size}
        paddingTop="0"
        me={-2}
        onClick={handleClear}
      >
        Clear
      </Button>
    ) : undefined;

  return (
    <InputGroup
      width={props.width}
      className={className}
      endElement={endElement}
    >
      <Menu.Root
        size="sm"
        lazyMount
        closeOnSelect={false}
        onOpenChange={() => inputRef.current?.focus()}
      >
        <Menu.Trigger asChild>
          <Button
            width={"100%"}
            size="2xs"
            colorPalette="gray"
            variant="outline"
            justifyContent="flex-start"
          >
            {showNumberOfValuesSelected(values)}
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content
              zIndex={"popover"}
              fontSize={props.size}
              width={props.width}
              className="no-track-pii-safe"
            >
              {/* Input Filter & Show Tags */}
              <Menu.ItemGroup>
                <Wrap
                  border={"1px solid #e2e8f0"}
                  borderRadius={"4px"}
                  width={"calc(100% - 8px)"}
                  marginX={"4px"}
                  padding={"4px"}
                >
                  {values.map((value) => (
                    <WrapItem key={value}>
                      <Tag.Root
                        key={value}
                        paddingX={"0.5rem"}
                        size={
                          props.size === "sm"
                            ? props.size
                            : props.size === "md"
                              ? props.size
                              : props.size === "lg"
                                ? props.size
                                : "md"
                        }
                      >
                        <Tag.Label>{value}</Tag.Label>
                        <Tag.EndElement>
                          <Tag.CloseTrigger
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
                        if (inputRef.current && isTyping)
                          inputRef.current.focus();
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
                    }}
                  >
                    Add &apos;{filter}&apos; to the list
                  </Menu.Item>
                )}
                {filteredList
                  .map((value, cid) => (
                    <Menu.Item
                      key={_.uniqueId(`option-${cid}`)}
                      value={`option-${cid}`}
                      onClick={() => {
                        handleSelect(value);
                      }}
                    >
                      {value}
                    </Menu.Item>
                  ))
                  .slice(0, limit)}
                {filteredList.length > limit && (
                  <Tooltip
                    content="Please use filter to find more items"
                    positioning={{ placement: "top" }}
                  >
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
