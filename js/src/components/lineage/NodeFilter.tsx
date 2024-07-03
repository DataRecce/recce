import { LineageDiffViewOptions } from "@/lib/api/lineagecheck";
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
} from "@chakra-ui/react";

import { FiAlignLeft, FiPackage } from "react-icons/fi";
import { getIconForResourceType } from "./styles";
import { CSSProperties, ChangeEvent, useEffect, useRef, useState } from "react";

interface NodeFilterProps {
  viewOptions: LineageDiffViewOptions;
  onViewOptionsChanged: (options: LineageDiffViewOptions) => void;
}

const ViewModeSelectMenu = ({
  viewOptions,
  onViewOptionsChanged,
}: NodeFilterProps) => {
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
        minWidth="150px"
        leftIcon={<Icon as={getIconForResourceType("model").icon} />}
        size="xs"
        variant="outline"
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

const PackageSelectMenu = ({
  viewOptions,
  onViewOptionsChanged,
}: NodeFilterProps) => {
  const { lineageGraph } = useLineageGraphContext();

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
        minWidth="150px"
        leftIcon={<Icon as={FiPackage} />}
        size="xs"
        variant="outline"
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
                  console.log("selected");
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
  return (
    <NodeSelectionInput
      value={props.viewOptions.select || ""}
      onChange={(value) => {
        props.onViewOptionsChanged({
          ...props.viewOptions,
          select: value ? value : undefined,
        });
      }}
    />
  );
};

const ExcludeFilter = (props: NodeFilterProps) => {
  return (
    <NodeSelectionInput
      value={props.viewOptions.exclude || ""}
      onChange={(value) => {
        props.onViewOptionsChanged({
          ...props.viewOptions,
          exclude: value ? value : undefined,
        });
      }}
    />
  );
};

const ControlItem = (props: {
  label: string;
  children: React.ReactNode;
  style?: CSSProperties;
  action?: boolean;
}) => {
  return (
    <Box style={props.style} maxWidth="300px">
      <Box fontSize="8pt">{props.label}</Box>
      {props.children}
    </Box>
  );
};

export const NodeFilter = (props: NodeFilterProps) => {
  return (
    <HStack width="100%" padding="4pt 8pt">
      <HStack flex="1">
        <ControlItem label="Mode">
          <ViewModeSelectMenu {...props} />
        </ControlItem>
        <ControlItem label="Package">
          <PackageSelectMenu {...props} />
        </ControlItem>
        <ControlItem label="Select" style={{ flex: "100 0 auto" }}>
          <SelectFilter {...props} />
        </ControlItem>
        <ControlItem label="Exclude" style={{ flex: "100 0 auto" }}>
          <ExcludeFilter {...props} />
        </ControlItem>
        <Spacer />

        <ControlItem label="Actions" action>
          <ButtonGroup isAttached variant="outline">
            <Button size="xs" fontSize="9pt">
              Select nodes
            </Button>
            <Button size="xs">...</Button>
          </ButtonGroup>
        </ControlItem>
      </HStack>
    </HStack>
  );
};
