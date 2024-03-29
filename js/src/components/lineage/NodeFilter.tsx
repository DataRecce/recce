import { LineageDiffViewOptions } from "@/lib/api/lineagecheck";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { SmallCloseIcon } from "@chakra-ui/icons";
import {
  HStack,
  Button,
  Icon,
  Box,
  ButtonGroup,
  IconButton,
  Checkbox,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuDivider,
  StackDivider,
  MenuGroup,
} from "@chakra-ui/react";
import _ from "lodash";

import { FiAlignLeft, FiPackage } from "react-icons/fi";
import { getIconForResourceType } from "./styles";

interface NodeFilterProps {
  viewOptions: LineageDiffViewOptions;
  onViewOptionsChanged: (options: LineageDiffViewOptions) => void;
  onClose: (fitView: boolean) => void;
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

export const NodeFilter = (props: NodeFilterProps) => {
  const { onClose } = props;

  return (
    <Box bg="white" rounded="md" shadow="dark-lg">
      <HStack
        p="5px 15px"
        mt="4"
        divider={<StackDivider borderColor="gray.200" />}
      >
        <HStack>
          <ViewModeSelectMenu {...props} />
          <PackageSelectMenu {...props} />
        </HStack>

        <ButtonGroup size="xs" isAttached variant="outline" rounded="xs">
          <Button onClick={() => onClose(true)}>Fit and Close</Button>
          <IconButton
            aria-label="Exit filter Mode"
            icon={<SmallCloseIcon />}
            onClick={() => onClose(false)}
          />
        </ButtonGroup>
      </HStack>
    </Box>
  );
};
