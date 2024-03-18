import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import {
  Menu,
  MenuButton,
  Button,
  MenuList,
  MenuOptionGroup,
  MenuItemOption,
} from "@chakra-ui/react";
import { on } from "events";

interface SelectPackageMenuProps {
  packages?: string[];
  onPackagesUpdated?: (packages: string[]) => void;
}

export const SelectPackageMenu = ({
  packages,
  onPackagesUpdated,
}: SelectPackageMenuProps) => {
  const { lineageGraph } = useLineageGraphContext();

  // get unique package names
  const availablePackages = new Set<string>();
  const nodes = Object.values(lineageGraph?.nodes || {});
  for (const node of nodes) {
    if (node.packageName) {
      availablePackages.add(node.packageName);
    }
  }

  return (
    <Menu closeOnSelect={false}>
      <MenuButton as={Button} colorScheme="blue">
        MenuItem
      </MenuButton>
      <MenuList minWidth="240px">
        <MenuOptionGroup
          type="checkbox"
          value={
            packages !== undefined ? packages : Array.from(availablePackages)
          }
          onChange={(values) => {
            onPackagesUpdated && onPackagesUpdated(values as any);
          }}
        >
          {Array.from(availablePackages).map((packageName) => (
            <MenuItemOption key={packageName} value={packageName}>
              {packageName}
            </MenuItemOption>
          ))}
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  );
};
