import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Code,
  HStack,
  Icon,
  Input,
  Menu,
  Portal,
  Spacer,
  Text,
  VStack,
} from "@chakra-ui/react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { FiPackage } from "react-icons/fi";
import { PiCaretDown } from "react-icons/pi";
import SetupConnectionPopover from "@/components/app/SetupConnectionPopover";
import HistoryToggle from "@/components/shared/HistoryToggle";
import { Tooltip } from "@/components/ui/tooltip";
import { LineageDiffViewOptions } from "@/lib/api/lineagecheck";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { findByRunType } from "../run/registry";
import { useLineageViewContextSafe } from "./LineageViewContext";
import { getIconForResourceType } from "./styles";

const SelectFilterTooltip = () => {
  return (
    <VStack align={"start"} gap={0}>
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

const ViewModeSelectMenu = ({ isDisabled }: { isDisabled: boolean }) => {
  const { viewOptions, onViewOptionsChanged } = useLineageViewContextSafe();
  const viewMode = viewOptions.view_mode ?? "changed_models";
  const label = viewMode === "changed_models" ? "Changed Models" : "All";

  const handleSelect = (viewMode: LineageDiffViewOptions["view_mode"]) => {
    onViewOptionsChanged({
      ...viewOptions,
      view_mode: viewMode,
    });
  };

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          minWidth="100px"
          size="2xs"
          variant="outline"
          disabled={isDisabled}
        >
          <Icon as={getIconForResourceType("model").icon} /> {label}{" "}
          <PiCaretDown />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.RadioItemGroup
              value={viewMode}
              onValueChange={(e) => {
                handleSelect(e.value as typeof viewMode);
              }}
            >
              <Menu.ItemGroupLabel>mode</Menu.ItemGroupLabel>
              <Menu.RadioItem value="changed_models">
                Changed Models
                <Menu.ItemIndicator />
              </Menu.RadioItem>
              <Menu.RadioItem value="all">
                All
                <Menu.ItemIndicator />
              </Menu.RadioItem>
            </Menu.RadioItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

const PackageSelectMenu = ({ isDisabled }: { isDisabled: boolean }) => {
  const { lineageGraph } = useLineageGraphContext();
  const { viewOptions, onViewOptionsChanged } = useLineageViewContextSafe();

  // get unique package names
  const available = new Set<string>();
  const nodes = Object.values(lineageGraph?.nodes ?? {});
  for (const node of nodes) {
    if (node.data.packageName) {
      available.add(node.data.packageName);
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
    <Menu.Root closeOnSelect={false}>
      <Menu.Trigger asChild>
        <Button
          minWidth="100px"
          size="2xs"
          variant="outline"
          disabled={isDisabled}
        >
          <Icon as={FiPackage} /> {label} <PiCaretDown />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>Select Packages</Menu.ItemGroupLabel>
              <Menu.Item value="" asChild>
                <Checkbox.Root
                  checked={
                    !isSelectAll && !isSelectNone
                      ? "indeterminate"
                      : isSelectAll
                  }
                  onCheckedChange={handleSelectAll}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>Select All</Checkbox.Label>
                </Checkbox.Root>
              </Menu.Item>

              <Menu.Separator />

              {Array.from(available).map((pkg) => {
                const thePkg = pkg;
                return (
                  <Menu.Item key={pkg} value={pkg}>
                    <Checkbox.Root
                      checked={selected.has(pkg)}
                      onCheckedChange={() => {
                        handleSelect(thePkg);
                      }}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label className="no-track-pii-safe">
                        {pkg}
                      </Checkbox.Label>
                    </Checkbox.Root>
                  </Menu.Item>
                );
              })}
            </Menu.ItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
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
      contentProps={{
        width: "300px",
        padding: 2,
        shadow: "md",
        borderWidth: 1,
        rounded: "md",
        color: "black",
        backgroundColor: "white",
      }}
      content={props.tooltipComponent}
      positioning={{ placement: "bottom-start" }}
      closeOnClick={false}
      disabled={!flags?.single_env_onboarding}
    >
      <Input
        ref={inputRef}
        height="24px"
        fontSize="10pt"
        placeholder="with selectors"
        disabled={props.isDisabled}
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
      value={viewOptions.select ?? ""}
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
      value={viewOptions.exclude ?? ""}
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
      <Box fontSize="8pt">{(props.label ?? "").trim() || <>&nbsp;</>}</Box>
      {props.children}
    </Box>
  );
};

export const LineageViewTopBar = () => {
  const { deselect, focusedNode, selectedNodes, ...lineageViewContext } =
    useLineageViewContextSafe();
  const { featureToggles } = useRecceInstanceContext();
  const { data: flags } = useRecceServerFlag();
  const isSingleEnvOnboarding = flags?.single_env_onboarding;

  const isSingleSelect = !!focusedNode;
  const isMultiSelect = selectedNodes.length > 0;
  const isNoSelect = !isSingleSelect && !isMultiSelect;
  const isFilterDisabled = isMultiSelect;

  return (
    <HStack width="100%" padding="4pt 8pt" className="chakra-style-reset">
      <HStack flex="1">
        <HistoryToggle />
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
                size="2xs"
                fontSize="9pt"
                onClick={() => {
                  deselect();
                }}
              >
                Deselect
              </Button>
            </ControlItem>
            {isSingleEnvOnboarding && (
              <ControlItem label="Explore">
                <ButtonGroup attached variant="outline">
                  <Menu.Root positioning={{ placement: "bottom-end" }}>
                    <Menu.Trigger asChild>
                      <Button size="2xs">
                        Actions <PiCaretDown />
                      </Button>
                    </Menu.Trigger>
                    <Portal>
                      <Menu.Positioner>
                        <Menu.Content>
                          <Menu.Item
                            value="row-count"
                            disabled={featureToggles.disableDatabaseQuery}
                            onClick={async () => {
                              await lineageViewContext.runRowCount();
                            }}
                          >
                            <Text textStyle="sm">
                              <Icon as={findByRunType("row_count_diff").icon} />{" "}
                              Row Count
                            </Text>
                          </Menu.Item>
                        </Menu.Content>
                      </Menu.Positioner>
                    </Portal>
                  </Menu.Root>
                </ButtonGroup>
              </ControlItem>
            )}
          </>
        )}
        {!isSingleEnvOnboarding && (
          <ControlItem label="Explore">
            <ButtonGroup attached variant="outline">
              <Menu.Root positioning={{ placement: "bottom-end" }}>
                <Menu.Trigger asChild>
                  <Button
                    size="2xs"
                    disabled={featureToggles.disableViewActionDropdown}
                  >
                    Actions <PiCaretDown />
                  </Button>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.ItemGroup m="0" p="4px 12px">
                        <Menu.ItemGroupLabel>Diff</Menu.ItemGroupLabel>
                        <SetupConnectionPopover
                          display={featureToggles.mode === "metadata only"}
                        >
                          <Menu.Item
                            value="row-count-diff"
                            disabled={featureToggles.disableDatabaseQuery}
                            onClick={async () => {
                              await lineageViewContext.runRowCountDiff();
                            }}
                          >
                            <Text textStyle="sm">
                              <Icon as={findByRunType("row_count_diff").icon} />{" "}
                              Row Count Diff
                            </Text>
                          </Menu.Item>
                        </SetupConnectionPopover>
                        <SetupConnectionPopover
                          display={featureToggles.mode === "metadata only"}
                        >
                          <Menu.Item
                            value="value-diff"
                            disabled={featureToggles.disableDatabaseQuery}
                            onClick={async () => {
                              await lineageViewContext.runValueDiff();
                            }}
                          >
                            <Text textStyle="sm">
                              <Icon as={findByRunType("value_diff").icon} />{" "}
                              Value Diff
                            </Text>
                          </Menu.Item>
                        </SetupConnectionPopover>
                      </Menu.ItemGroup>

                      <Menu.Separator />

                      <Menu.ItemGroup m="0" px="12px">
                        <Menu.ItemGroupLabel>
                          Add to Checklist
                        </Menu.ItemGroupLabel>
                        <Menu.Item
                          value="lineage-diff"
                          disabled={
                            !(
                              isNoSelect ||
                              (isMultiSelect && selectedNodes.length > 1)
                            )
                          }
                          onClick={() => {
                            lineageViewContext.addLineageDiffCheck(
                              lineageViewContext.viewOptions.view_mode,
                            );
                          }}
                        >
                          <Text textStyle="sm">
                            <Icon as={findByRunType("lineage_diff").icon} />{" "}
                            Lineage Diff
                          </Text>
                        </Menu.Item>
                        <Menu.Item
                          value="schema-diff"
                          disabled={false}
                          onClick={() => {
                            lineageViewContext.addSchemaDiffCheck();
                          }}
                        >
                          <Text textStyle="sm">
                            <Icon as={findByRunType("schema_diff").icon} />{" "}
                            Schema Diff
                          </Text>
                        </Menu.Item>
                      </Menu.ItemGroup>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            </ButtonGroup>
          </ControlItem>
        )}
      </HStack>
    </HStack>
  );
};
