import {
  LineageDiffViewOptions,
  createLineageDiffCheck,
} from "@/lib/api/lineagecheck";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";

import {
  HStack,
  Button,
  Icon,
  Box,
  Checkbox,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuDivider,
  MenuGroup,
  Input,
  ButtonGroup,
  Spacer,
  Text,
  Tooltip,
} from "@chakra-ui/react";

import { FiPackage } from "react-icons/fi";
import { getIconForResourceType } from "./styles";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { VscHistory } from "react-icons/vsc";
import { useLineageViewContext } from "./LineageViewContext";
import { findByRunType } from "../run/registry";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { trackHistoryAction } from "@/lib/api/track";
import { DisableTooltipMessages } from "@/constants/tooltipMessage";

const HistoryToggle = () => {
  const { isHistoryOpen, showHistory, closeHistory } = useRecceActionContext();
  return (
    <Button
      leftIcon={<Icon as={VscHistory} />}
      size="xs"
      variant="outline"
      onClick={() => {
        if (isHistoryOpen) {
          trackHistoryAction({ name: "hide" });
          closeHistory();
        } else {
          trackHistoryAction({ name: "show" });
          showHistory();
        }
      }}
    >
      {isHistoryOpen ? "Hide" : "Show"}
    </Button>
  );
};

const ViewModeSelectMenu = ({ isDisabled }: { isDisabled: boolean }) => {
  const { viewOptions, onViewOptionsChanged, selectMode } =
    useLineageViewContext();
  const viewMode = viewOptions.view_mode || "changed_models";
  const label = viewMode === "changed_models" ? "Changed Models" : "All";

  const handleSelect = (viewMode: LineageDiffViewOptions["view_mode"]) => {
    onViewOptionsChanged({
      ...viewOptions,
      view_mode: viewMode,
    });
  };

  return (
    <Menu>
      <MenuButton
        as={Button}
        minWidth="100px"
        leftIcon={<Icon as={getIconForResourceType("model").icon} />}
        size="xs"
        variant="outline"
        isDisabled={isDisabled}
      >
        {label}
      </MenuButton>

      <MenuList title="packages">
        <MenuItem
          as={Checkbox}
          size="sm"
          isChecked={viewMode === "changed_models"}
          onChange={() => handleSelect("changed_models")}
        >
          Changed Models
        </MenuItem>
        <MenuItem
          as={Checkbox}
          size="sm"
          isChecked={viewMode === "all"}
          onChange={() => handleSelect("all")}
        >
          All
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

const PackageSelectMenu = ({ isDisabled }: { isDisabled: boolean }) => {
  const { lineageGraph } = useLineageGraphContext();
  const { viewOptions, onViewOptionsChanged } = useLineageViewContext();

  // get unique package names
  const available = new Set<string>();
  const nodes = Object.values(lineageGraph?.nodes || {});
  for (const node of nodes) {
    if (node.packageName) {
      available.add(node.packageName);
    }
  }

  const projectName = lineageGraph?.manifestMetadata?.current?.project_name;

  const selected = viewOptions.packages
    ? new Set(viewOptions.packages)
    : projectName
    ? new Set([projectName])
    : available;
  const isSelectAll = selected.size === available.size;
  const isSelectNone = selected.size === 0;
  const label =
    selected.size === 1
      ? Array.from(selected)[0]
      : isSelectAll
      ? "All Packages"
      : isSelectNone
      ? "No Package"
      : `${selected.size} Packages`;

  const handleSelectAll = () => {
    if (isSelectAll) {
      onViewOptionsChanged({
        ...viewOptions,
        packages: [],
      });
    } else {
      onViewOptionsChanged({
        ...viewOptions,
        packages: Array.from(available),
      });
    }
  };

  const handleSelect = (pkg: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(pkg)) {
      newSelected.delete(pkg);
    } else {
      newSelected.add(pkg);
    }
    onViewOptionsChanged({
      ...viewOptions,
      packages: Array.from(newSelected),
    });
  };

  return (
    <Menu closeOnSelect={false}>
      <MenuButton
        as={Button}
        minWidth="100px"
        leftIcon={<Icon as={FiPackage} />}
        size="xs"
        variant="outline"
        isDisabled={isDisabled}
      >
        {label}
      </MenuButton>

      <MenuList title="packages">
        <MenuGroup title="Select Packages">
          <MenuItem
            as={Checkbox}
            size="sm"
            isIndeterminate={!isSelectAll && !isSelectNone}
            isChecked={isSelectAll}
            onChange={handleSelectAll}
          >
            Select All
          </MenuItem>
          <MenuDivider />

          {Array.from(available).map((pkg) => {
            const thePkg = pkg;

            return (
              <MenuItem
                key={pkg}
                as={Checkbox}
                size="sm"
                isChecked={selected.has(pkg)}
                onChange={() => {
                  handleSelect(thePkg);
                }}
              >
                {pkg}
              </MenuItem>
            );
          })}
        </MenuGroup>
      </MenuList>
    </Menu>
  );
};

const NodeSelectionInput = (props: {
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
}) => {
  const [inputValue, setInputValue] = useState(props.value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      (inputRef.current as any).value = props.value;
    }
  }, [props.value]);

  return (
    <Input
      ref={inputRef}
      height="24px"
      fontSize="10pt"
      placeholder="with selectors"
      isDisabled={props.isDisabled}
      value={inputValue}
      onChange={(event) => {
        setInputValue(event.target.value);
      }}
      onKeyUp={(event) => {
        if (event.key === "Enter") {
          props.onChange(inputValue);
        } else if (event.key === "Escape") {
          event.preventDefault();
          setInputValue(props.value);
          if (inputRef.current) {
            (inputRef.current as any).blur();
          }
        }
      }}
      onBlur={() => setInputValue(props.value)}
    />
  );
};

const SelectFilter = ({ isDisabled }: { isDisabled: boolean }) => {
  const { viewOptions, onViewOptionsChanged } = useLineageViewContext();

  return (
    <NodeSelectionInput
      isDisabled={isDisabled}
      value={viewOptions.select || ""}
      onChange={(value) => {
        onViewOptionsChanged({
          ...viewOptions,
          select: value ? value : undefined,
        });
      }}
    />
  );
};

const ExcludeFilter = ({ isDisabled }: { isDisabled: boolean }) => {
  const { viewOptions, onViewOptionsChanged } = useLineageViewContext();

  return (
    <NodeSelectionInput
      isDisabled={isDisabled}
      value={viewOptions.exclude || ""}
      onChange={(value) => {
        onViewOptionsChanged({
          ...viewOptions,
          exclude: value ? value : undefined,
        });
      }}
    />
  );
};

const ControlItem = (props: {
  label?: string;
  children: React.ReactNode;
  style?: CSSProperties;
}) => {
  return (
    <Box style={props.style} maxWidth="300px">
      <Box fontSize="8pt">{props?.label || <>&nbsp;</>}</Box>
      {props.children}
    </Box>
  );
};

export const LineageViewTopBar = () => {
  const { nodes, deselect, selectMode, ...lineageViewContext } =
    useLineageViewContext();
  const { isActionAvailable } = useLineageGraphContext();
  const selectNodes = useMemo(() => {
    return nodes.filter((node) => node.data.isSelected);
  }, [nodes]);

  const isSingleSelect = selectMode === "single" && selectNodes.length === 1;
  const isMultiSelect = selectMode === "multi" && selectNodes.length >= 1;
  const isNoSelect = selectMode === "single" && selectNodes.length === 0;

  const isFilterDisabled = selectMode !== "single";

  return (
    <HStack width="100%" padding="4pt 8pt">
      <HStack flex="1">
        <ControlItem label="History" style={{ flexShrink: "1" }}>
          <HistoryToggle />
        </ControlItem>
        <ControlItem label="Mode" style={{ flexShrink: "1" }}>
          <ViewModeSelectMenu isDisabled={isFilterDisabled} />
        </ControlItem>
        <ControlItem label="Package" style={{ flexShrink: "1" }}>
          <PackageSelectMenu isDisabled={isFilterDisabled} />
        </ControlItem>
        <ControlItem label="Select" style={{ flex: "100 1 auto" }}>
          <SelectFilter isDisabled={isFilterDisabled} />
        </ControlItem>
        <ControlItem label="Exclude" style={{ flex: "100 1 auto" }}>
          <ExcludeFilter isDisabled={isFilterDisabled} />
        </ControlItem>
        <Spacer />
        {selectMode === "multi" && (
          <>
            <ControlItem label="" style={{ flexShrink: "0" }}>
              <Text fontSize="9pt" color="gray.500">
                {selectNodes.length > 1
                  ? `${selectNodes.length} nodes selected`
                  : `${selectNodes.length} node selected`}
              </Text>
            </ControlItem>

            <ControlItem label="">
              <Button
                variant={"outline"}
                size="xs"
                fontSize="9pt"
                isDisabled={selectMode !== "multi"}
                onClick={() => {
                  deselect();
                }}
              >
                Deselect
              </Button>
            </ControlItem>
          </>
        )}
        <ControlItem label="Explore">
          <ButtonGroup isAttached variant="outline">
            <Menu placement="bottom-end">
              <MenuButton
                as={Button}
                size={"xs"}
                rightIcon={<ChevronDownIcon />}
              >
                Actions
              </MenuButton>

              <MenuList>
                <MenuGroup title="Diff" m="0" p="4px 12px">
                  <MenuItem
                    as={Text}
                    size="sm"
                    fontSize="10pt"
                    isDisabled={
                      !(isNoSelect || isSingleSelect || isMultiSelect)
                    }
                    icon={<Icon as={findByRunType("row_count_diff")?.icon} />}
                    onClick={() => {
                      lineageViewContext.runRowCountDiff();
                    }}
                  >
                    Row Count Diff
                  </MenuItem>
                  <Tooltip
                    label={
                      !isActionAvailable("value_diff")
                        ? DisableTooltipMessages.audit_helper
                        : null
                    }
                    placement="left"
                  >
                    <MenuItem
                      as={Text}
                      size="sm"
                      fontSize="10pt"
                      isDisabled={
                        !(isNoSelect || isSingleSelect || isMultiSelect) ||
                        !isActionAvailable("value_diff")
                      }
                      icon={<Icon as={findByRunType("value_diff")?.icon} />}
                      onClick={() => {
                        lineageViewContext.runValueDiff();
                      }}
                    >
                      Value Diff
                    </MenuItem>
                  </Tooltip>
                </MenuGroup>
                <MenuDivider />
                <MenuGroup title="Add to Checklist" m="0" px="12px">
                  <MenuItem
                    as={Text}
                    size="sm"
                    fontSize="10pt"
                    isDisabled={
                      !(isNoSelect || (isMultiSelect && selectNodes.length > 1))
                    }
                    icon={<Icon as={findByRunType("lineage_diff")?.icon} />}
                    onClick={() => {
                      lineageViewContext.addLineageDiffCheck(
                        lineageViewContext.viewOptions.view_mode
                      );
                    }}
                  >
                    Lineage Diff
                  </MenuItem>
                  <MenuItem
                    as={Text}
                    size="sm"
                    fontSize="10pt"
                    isDisabled={
                      !(isNoSelect || isSingleSelect || isMultiSelect)
                    }
                    icon={<Icon as={findByRunType("schema_diff")?.icon} />}
                    onClick={() => {
                      lineageViewContext.addSchemaDiffCheck();
                    }}
                  >
                    Schema Diff
                  </MenuItem>
                </MenuGroup>
              </MenuList>
            </Menu>
          </ButtonGroup>
        </ControlItem>
      </HStack>
    </HStack>
  );
};
