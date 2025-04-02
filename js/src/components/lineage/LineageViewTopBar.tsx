import { LineageDiffViewOptions, createLineageDiffCheck } from "@/lib/api/lineagecheck";
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
  VStack,
  Code,
  Link,
} from "@chakra-ui/react";

import { FiPackage } from "react-icons/fi";
import { getIconForResourceType } from "./styles";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { VscHistory } from "react-icons/vsc";
import { useLineageViewContextSafe } from "./LineageViewContext";
import { findByRunType } from "../run/registry";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { trackHistoryAction } from "@/lib/api/track";
import { DisableTooltipMessages } from "@/constants/tooltipMessage";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";

const SelectFilterTooltip = () => {
  return (
    <VStack align={"start"} spacing={0}>
      <Text fontSize="10pt" color={"gray.500"} pb={1}>
        Select nodes by dbt node selector syntax
      </Text>
      <Text fontSize="8pt">
        <Code fontSize={"8pt"}>model_name</Code> Select a node
      </Text>
      <Text fontSize="8pt">
        <Code fontSize={"8pt"}>model_name+</Code> Select downstream nodes
      </Text>
      <Text fontSize="8pt">
        <Code fontSize={"8pt"}>+model_name</Code> Select upstream nodes
      </Text>
      <Text fontSize="8pt">
        <Code fontSize={"8pt"}>model*</Code> Select by wildcard
      </Text>
    </VStack>
  );
};

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
      }}>
      {isHistoryOpen ? "Hide" : "Show"}
    </Button>
  );
};

const ViewModeSelectMenu = ({ isDisabled }: { isDisabled: boolean }) => {
  const { viewOptions, onViewOptionsChanged } = useLineageViewContextSafe();
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
        rightIcon={<ChevronDownIcon />}>
        {label}
      </MenuButton>

      <MenuList title="packages">
        <MenuItem
          as={Checkbox}
          size="sm"
          isChecked={viewMode === "changed_models"}
          onChange={() => {
            handleSelect("changed_models");
          }}>
          Changed Models
        </MenuItem>
        <MenuItem
          as={Checkbox}
          size="sm"
          isChecked={viewMode === "all"}
          onChange={() => {
            handleSelect("all");
          }}>
          All
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

const PackageSelectMenu = ({ isDisabled }: { isDisabled: boolean }) => {
  const { lineageGraph } = useLineageGraphContext();
  const { viewOptions, onViewOptionsChanged } = useLineageViewContextSafe();

  // get unique package names
  const available = new Set<string>();
  const nodes = Object.values(lineageGraph?.nodes || {});
  for (const node of nodes) {
    if (node.packageName) {
      available.add(node.packageName);
    }
  }

  const projectName = lineageGraph?.manifestMetadata.current?.project_name;

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
        rightIcon={<ChevronDownIcon />}>
        {label}
      </MenuButton>

      <MenuList title="packages">
        <MenuGroup title="Select Packages">
          <MenuItem
            as={Checkbox}
            size="sm"
            isIndeterminate={!isSelectAll && !isSelectNone}
            isChecked={isSelectAll}
            onChange={handleSelectAll}>
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
                }}>
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
  tooltipComponent?: React.ReactNode;
}) => {
  const [inputValue, setInputValue] = useState(props.value);
  const { data: flags } = useRecceServerFlag();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = props.value;
    }
  }, [props.value]);

  return (
    <Tooltip
      // Custom tooltip style
      width={"300px"}
      padding={2}
      shadow={"md"}
      borderWidth={1}
      rounded={"md"}
      styleConfig={{
        zIndex: "dropdown",
      }}
      label={props.tooltipComponent}
      placement="bottom-start"
      color={"black"}
      backgroundColor={"white"}
      closeOnClick={false}
      isDisabled={!flags?.single_env_onboarding}>
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
              inputRef.current.blur();
            }
          }
        }}
        onBlur={() => {
          setInputValue(props.value);
        }}
      />
    </Tooltip>
  );
};

const SelectFilter = ({ isDisabled }: { isDisabled: boolean }) => {
  const { viewOptions, onViewOptionsChanged } = useLineageViewContextSafe();

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
      tooltipComponent={<SelectFilterTooltip />}
    />
  );
};

const ExcludeFilter = ({ isDisabled }: { isDisabled: boolean }) => {
  const { viewOptions, onViewOptionsChanged } = useLineageViewContextSafe();

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
      <Box fontSize="8pt">{props.label || <>&nbsp;</>}</Box>
      {props.children}
    </Box>
  );
};

export const LineageViewTopBar = () => {
  const { deselect, focusedNode, selectedNodes, ...lineageViewContext } =
    useLineageViewContextSafe();
  const { isActionAvailable } = useLineageGraphContext();
  const { readOnly } = useRecceInstanceContext();
  const { data: flags } = useRecceServerFlag();
  const isSingleEnvOnboarding = flags?.single_env_onboarding;

  const isSingleSelect = !!focusedNode;
  const isMultiSelect = selectedNodes.length > 0;
  const isNoSelect = !isSingleSelect && !isMultiSelect;
  const isFilterDisabled = isMultiSelect;

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
        {isMultiSelect && (
          <>
            <ControlItem label="" style={{ flexShrink: "0" }}>
              <Text fontSize="9pt" color="gray.500">
                {selectedNodes.length > 1
                  ? `${selectedNodes.length} nodes selected`
                  : `${selectedNodes.length} node selected`}
              </Text>
            </ControlItem>

            <ControlItem label="">
              <Button
                variant={"outline"}
                size="xs"
                fontSize="9pt"
                onClick={() => {
                  deselect();
                }}>
                Deselect
              </Button>
            </ControlItem>
            {isSingleEnvOnboarding && (
              <ControlItem label="Explore">
                <ButtonGroup isAttached variant="outline">
                  <Menu placement="bottom-end">
                    <MenuButton as={Button} size={"xs"} rightIcon={<ChevronDownIcon />}>
                      Actions
                    </MenuButton>
                    <MenuList>
                      <MenuItem
                        as={Text}
                        size="sm"
                        fontSize="10pt"
                        isDisabled={!(isNoSelect || isSingleSelect || isMultiSelect)}
                        icon={<Icon as={findByRunType("row_count_diff")?.icon} />}
                        onClick={async () => {
                          await lineageViewContext.runRowCount();
                        }}>
                        Row Count
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </ButtonGroup>
              </ControlItem>
            )}
          </>
        )}
        {!isSingleEnvOnboarding && (
          <ControlItem label="Explore">
            <ButtonGroup isAttached variant="outline">
              <Menu placement="bottom-end">
                <MenuButton
                  as={Button}
                  size={"xs"}
                  rightIcon={<ChevronDownIcon />}
                  isDisabled={readOnly}>
                  Actions
                </MenuButton>

                <MenuList>
                  <MenuGroup title="Diff" m="0" p="4px 12px">
                    <MenuItem
                      as={Text}
                      size="sm"
                      fontSize="10pt"
                      isDisabled={!(isNoSelect || isSingleSelect || isMultiSelect)}
                      icon={<Icon as={findByRunType("row_count_diff")?.icon} />}
                      onClick={async () => {
                        await lineageViewContext.runRowCountDiff();
                      }}>
                      Row Count Diff
                    </MenuItem>
                    <Tooltip
                      label={
                        !isActionAvailable("value_diff")
                          ? DisableTooltipMessages.audit_helper
                          : null
                      }
                      placement="left">
                      <MenuItem
                        as={Text}
                        size="sm"
                        fontSize="10pt"
                        isDisabled={
                          !(isNoSelect || isSingleSelect || isMultiSelect) ||
                          !isActionAvailable("value_diff")
                        }
                        icon={<Icon as={findByRunType("value_diff")?.icon} />}
                        onClick={async () => {
                          await lineageViewContext.runValueDiff();
                        }}>
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
                      isDisabled={!(isNoSelect || (isMultiSelect && selectedNodes.length > 1))}
                      icon={<Icon as={findByRunType("lineage_diff")?.icon} />}
                      onClick={() => {
                        lineageViewContext.addLineageDiffCheck(
                          lineageViewContext.viewOptions.view_mode,
                        );
                      }}>
                      Lineage Diff
                    </MenuItem>
                    <MenuItem
                      as={Text}
                      size="sm"
                      fontSize="10pt"
                      isDisabled={!(isNoSelect || isSingleSelect || isMultiSelect)}
                      icon={<Icon as={findByRunType("schema_diff")?.icon} />}
                      onClick={() => {
                        lineageViewContext.addSchemaDiffCheck();
                      }}>
                      Schema Diff
                    </MenuItem>
                  </MenuGroup>
                </MenuList>
              </Menu>
            </ButtonGroup>
          </ControlItem>
        )}
      </HStack>
    </HStack>
  );
};
