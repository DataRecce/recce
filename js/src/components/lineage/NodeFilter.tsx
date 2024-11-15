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
} from "@chakra-ui/react";

import { FiPackage } from "react-icons/fi";
import { getIconForResourceType } from "./styles";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { createSchemaDiffCheck } from "@/lib/api/schemacheck";
import { useLocation } from "wouter";
import { Check } from "@/lib/api/checks";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { VscHistory } from "react-icons/vsc";
import { useLineageViewContext } from "./LineageViewContext";

interface NodeFilterProps {
  isDisabled?: boolean;
  onSelectNodesClicked: () => void;
}

const HistoryToggle = () => {
  const { isHistoryOpen, showHistory, closeHistory } = useRecceActionContext();
  return (
    <Button
      leftIcon={<Icon as={VscHistory} />}
      size="xs"
      variant="outline"
      onClick={isHistoryOpen ? closeHistory : showHistory}
    >
      {isHistoryOpen ? "Hide" : "Show"}
    </Button>
  );
};

const ViewModeSelectMenu = ({ isDisabled }: NodeFilterProps) => {
  const { viewOptions, onViewOptionsChanged } = useLineageViewContext();
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

const PackageSelectMenu = ({ isDisabled }: NodeFilterProps) => {
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
      placeholder="<selection>"
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

const SelectFilter = (props: NodeFilterProps) => {
  const { viewOptions, onViewOptionsChanged } = useLineageViewContext();

  return (
    <NodeSelectionInput
      isDisabled={props.isDisabled}
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

const ExcludeFilter = (props: NodeFilterProps) => {
  const { viewOptions, onViewOptionsChanged } = useLineageViewContext();

  return (
    <NodeSelectionInput
      isDisabled={props.isDisabled}
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

const MoreActionMenu = (props: NodeFilterProps) => {
  const [, setLocation] = useLocation();
  const { runAction } = useRecceActionContext();
  const { viewOptions } = useLineageViewContext();
  const handleNavToCheck = useCallback(
    (check: Check) => {
      if (check.check_id) {
        setLocation(`/checks/${check.check_id}`);
      }
    },
    [setLocation]
  );

  return (
    <Menu placement="bottom-end">
      <MenuButton as={Button} size={"xs"}>
        Actions
      </MenuButton>

      <MenuList>
        <MenuGroup title="Diff" m="0" p="4px 12px">
          <MenuItem
            as={Text}
            size="sm"
            fontSize="10pt"
            onClick={() => {
              runAction("row_count_diff", {
                select: viewOptions.select,
                exclude: viewOptions.exclude,
              });
            }}
          >
            Row Count Diff
          </MenuItem>
          <MenuItem
            as={Text}
            size="sm"
            isDisabled
            fontSize="10pt"
            onClick={() => {}}
          >
            Value Diff
          </MenuItem>
        </MenuGroup>
        <MenuDivider />
        <MenuGroup title="Add to Checklist" m="0" px="12px">
          <MenuItem
            as={Text}
            size="sm"
            fontSize="10pt"
            onClick={async () => {
              const check = await createLineageDiffCheck(viewOptions);
              if (check) {
                handleNavToCheck(check);
              }
            }}
          >
            Lineage Diff
          </MenuItem>
          <MenuItem
            as={Text}
            size="sm"
            fontSize="10pt"
            onClick={async () => {
              const check = await createSchemaDiffCheck({
                select: viewOptions.select,
                exclude: viewOptions.exclude,
              });
              if (check) {
                handleNavToCheck(check);
              }
            }}
          >
            Schema Diff
          </MenuItem>
        </MenuGroup>
      </MenuList>
    </Menu>
  );
};

export const NodeFilter = (props: NodeFilterProps) => {
  return (
    <HStack width="100%" padding="4pt 8pt">
      <HStack flex="1">
        <ControlItem label="History" style={{ flexShrink: "1" }}>
          <HistoryToggle />
        </ControlItem>
        <ControlItem label="Mode" style={{ flexShrink: "1" }}>
          <ViewModeSelectMenu {...props} />
        </ControlItem>
        <ControlItem label="Package" style={{ flexShrink: "1" }}>
          <PackageSelectMenu {...props} />
        </ControlItem>
        <ControlItem label="Select" style={{ flex: "100 1 auto" }}>
          <SelectFilter {...props} />
        </ControlItem>
        <ControlItem label="Exclude" style={{ flex: "100 1 auto" }}>
          <ExcludeFilter {...props} />
        </ControlItem>
        <Spacer />

        <ControlItem label="">
          <Text fontSize="9pt" color="gray.500">
            3 nodes selected
          </Text>
        </ControlItem>

        <ControlItem label="">
          <Button
            size="xs"
            fontSize="9pt"
            onClick={props.onSelectNodesClicked}
            isDisabled={props.isDisabled}
          >
            Deselect
          </Button>
        </ControlItem>

        <ControlItem label="Explore">
          <ButtonGroup isAttached variant="outline">
            <MoreActionMenu {...props} />
          </ButtonGroup>
        </ControlItem>
      </HStack>
    </HStack>
  );
};
