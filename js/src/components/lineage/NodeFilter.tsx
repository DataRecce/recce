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
} from "@chakra-ui/react";
import _ from "lodash";

import { FiAlignLeft } from "react-icons/fi";

interface NodeFilterProps {
  viewOptions: LineageDiffViewOptions;
  onViewOptionsChanged: (options: LineageDiffViewOptions) => void;
  onClose: () => void;
}

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

  const selected = viewOptions.packages
    ? new Set(viewOptions.packages)
    : available;
  const isSelectAll = selected.size === available.size;
  const isSelectNone = selected.size === 0;

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
        leftIcon={<Icon as={FiAlignLeft} />}
        size="xs"
        variant="outline"
      >
        Packages
      </MenuButton>

      <MenuList title="packages">
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
      </MenuList>
    </Menu>
  );
};

export const NodeFilter = (props: NodeFilterProps) => {
  const { onClose } = props;

  return (
    <Box bg="white" rounded="md" shadow="dark-lg">
      <HStack>
        <PackageSelectMenu {...props} />

        <ButtonGroup
          size="xs"
          isAttached
          variant="outline"
          rounded="xs"
          onClick={onClose}
        >
          <Button>Apply</Button>
          <IconButton aria-label="Exit filter Mode" icon={<SmallCloseIcon />} />
        </ButtonGroup>
      </HStack>
    </Box>
  );
};
