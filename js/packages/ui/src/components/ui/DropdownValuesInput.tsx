/**
 * @file DropdownValuesInput.tsx
 * @description Multi-select dropdown input component with filtering and custom value support
 *
 * Features:
 * - Dropdown menu with suggestion list
 * - Filter/search functionality (case-insensitive)
 * - Chip-based value display with removal
 * - Keyboard navigation (Enter, comma, Backspace)
 * - Custom value addition
 * - Configurable size variants
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import InputBase from "@mui/material/InputBase";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import _ from "lodash";
import { type MouseEvent, useRef, useState } from "react";

/**
 * Size variants for the dropdown input
 */
export type DropdownValuesInputSize = "2xs" | "xs" | "sm" | "md" | "lg";

/**
 * Props for the DropdownValuesInput component
 */
export interface DropdownValuesInputProps {
  /** Unit name for pluralization in "X {unitName}s selected" display */
  unitName: string;
  /** List of suggested values to show in dropdown */
  suggestionList?: string[];
  /** Initial selected values */
  defaultValues?: string[];
  /** Callback when selected values change */
  onValuesChange: (values: string[]) => void;
  /** Optional CSS class name */
  className?: string;
  /** Size variant for the input */
  size?: DropdownValuesInputSize;
  /** Width of the input (CSS value or number in pixels) */
  width?: string | number;
  /** Placeholder text when no values are selected */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * A multi-select dropdown input component for selecting multiple values.
 *
 * Provides a dropdown menu with suggestion list, filtering, and the ability
 * to add custom values. Selected values are displayed as chips that can be
 * removed individually.
 *
 * @example
 * ```tsx
 * <DropdownValuesInput
 *   unitName="key"
 *   suggestionList={["id", "name", "email"]}
 *   defaultValues={["id"]}
 *   onValuesChange={(values) => console.log(values)}
 *   placeholder="Select or type to add keys"
 *   size="sm"
 *   width={240}
 * />
 * ```
 */
export const DropdownValuesInput = (props: DropdownValuesInputProps) => {
  const { defaultValues, suggestionList, onValuesChange, className } = props;
  const [values, setValues] = useState<string[]>(defaultValues ?? []);
  const [filter, setFilter] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const open = Boolean(anchorEl);

  const showNumberOfValuesSelected = (tags: string[]) => {
    if (tags.length > 1) {
      return `${tags.length} ${props.unitName}s selected`;
    } else if (tags.length === 1) {
      return tags[0];
    }
    return "";
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    // Focus input after menu opens
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setIsTyping(false);
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

  const handleRemoveValue = (value: string) => {
    setValues(values.filter((v) => v !== value));
    onValuesChange(values.filter((v) => v !== value));
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

  // Size mapping for font sizes
  const getFontSize = () => {
    switch (props.size) {
      case "2xs":
        return "0.625rem";
      case "xs":
        return "0.75rem";
      case "sm":
        return "0.875rem";
      default:
        return "0.875rem";
    }
  };

  const getHeight = () => {
    switch (props.size) {
      case "2xs":
        return 24;
      case "xs":
        return 28;
      case "sm":
        return 32;
      default:
        return 36;
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        width: props.width,
      }}
      className={className}
    >
      <Button
        variant="outlined"
        color="neutral"
        size="small"
        onClick={handleClick}
        disabled={props.disabled}
        sx={{
          width: "100%",
          height: getHeight(),
          justifyContent: "space-between",
          textTransform: "none",
          fontSize: getFontSize(),
          fontWeight: "normal",
          px: 1,
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: getFontSize(),
            color: values.length > 0 ? "text.primary" : "text.secondary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {showNumberOfValuesSelected(values) || props.placeholder || ""}
        </Typography>
        {values.length > 0 && (
          <Typography
            component="span"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            sx={{
              fontSize: getFontSize(),
              color: "primary.main",
              cursor: "pointer",
              ml: 1,
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Clear
          </Typography>
        )}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          paper: {
            sx: {
              width: props.width,
              fontSize: getFontSize(),
            },
          },
        }}
      >
        {/* Input Filter & Show Tags */}
        <Box sx={{ px: 0.5, py: 0.5 }}>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              p: 0.5,
              display: "flex",
              flexWrap: "wrap",
              gap: 0.5,
              alignItems: "center",
            }}
            className="no-track-pii-safe"
          >
            {values.map((value) => (
              <Chip
                key={value}
                label={value}
                size="small"
                onDelete={() => handleRemoveValue(value)}
                sx={{ height: 22, fontSize: getFontSize() }}
              />
            ))}
            <InputBase
              inputRef={inputRef}
              placeholder="Filter or add custom keys"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setIsTyping(true);
              }}
              onKeyDown={(e) => {
                // Stop propagation to prevent MUI Menu's typeahead navigation
                // from intercepting key presses (except Escape to close menu)
                if (e.key !== "Escape") {
                  e.stopPropagation();
                }

                const target = e.target as HTMLInputElement;
                const newText = target.value.trim().replace(",", "");
                switch (e.key) {
                  case ",":
                  case "Enter":
                    e.preventDefault();
                    if (newText) {
                      handleSelect(newText);
                      setFilter("");
                    }
                    break;
                  case "Backspace":
                    if (target.value === "" && values.length > 0) {
                      setValues(values.slice(0, -1));
                      onValuesChange(values.slice(0, -1));
                    }
                    break;
                  default:
                    break;
                }
              }}
              onBlur={() => {
                if (inputRef.current && isTyping) {
                  inputRef.current.focus();
                }
              }}
              sx={{
                flex: 1,
                minWidth: 120,
                fontSize: getFontSize(),
                "& input": {
                  p: 0.5,
                },
              }}
            />
          </Box>
        </Box>

        <Divider />

        {/* Suggestion List */}
        {filter !== "" && !suggestionList?.includes(filter) && (
          <MenuItem
            onClick={() => {
              handleSelect(filter);
              setIsTyping(false);
            }}
            sx={{ fontSize: getFontSize() }}
          >
            Add &apos;{filter}&apos; to the list
          </MenuItem>
        )}
        {filteredList.slice(0, limit).map((value, cid) => (
          <MenuItem
            key={_.uniqueId(`option-${cid}`)}
            onClick={() => {
              handleSelect(value);
            }}
            sx={{ fontSize: getFontSize() }}
          >
            {value}
          </MenuItem>
        ))}
        {filteredList.length > limit && (
          <MuiTooltip
            title="Please use filter to find more items"
            placement="top"
          >
            <Box px={1.5} py={0.5} color="text.secondary" fontSize="8pt">
              and {filteredList.length - limit} more items...
            </Box>
          </MuiTooltip>
        )}
      </Menu>
    </Box>
  );
};
