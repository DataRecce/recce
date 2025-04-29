import { Menu, MenuList, MenuItem, MenuDivider, useDisclosure, Icon } from "@chakra-ui/react";
import { useState } from "react";
import { BiArrowFromBottom, BiArrowToBottom } from "react-icons/bi";
import { Node, NodeProps } from "reactflow";
import { findByRunType } from "../run/registry";

interface LineageViewContextMenuProps {
  x: number;
  y: number;
  node?: Node | NodeProps;
  isOpen: boolean;
  onClose: () => void;
}

export const LineageViewContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
}: LineageViewContextMenuProps) => {
  const menuItems = [];

  const menuItemsModel = [
    {
      label: "Select parent nodes",
      icon: <BiArrowFromBottom />,
      action: () => {
        // selectParentNodes(1);
      },
    },
    {
      label: "Select child nodes",
      icon: <BiArrowToBottom />,
      action: () => {
        // selectChildNodes(1);
      },
    },
    {
      label: "Select all upstream nodes",
      icon: <BiArrowFromBottom />,
      action: () => {
        // selectParentNodes();
      },
    },
    {
      label: "Select all downstream nodes",
      icon: <BiArrowToBottom />,
      action: () => {
        // selectChildNodes();
      },
    },
  ];

  const menuItemsColumn = [
    {
      label: "Profile diff",
      icon: <Icon as={findByRunType("profile_diff")?.icon} />,
      action: () => {
        // selectChildNodes();
      },
    },
    {
      label: "Histogram diff",
      icon: <Icon as={findByRunType("histogram_diff")?.icon} />,
      action: () => {
        // selectChildNodes();
      },
    },
    {
      label: "Top-k diff",
      icon: <Icon as={findByRunType("top_k_diff")?.icon} />,
      action: () => {
        // selectChildNodes();
      },
    },
  ];

  if (node?.type === "customNode") {
    menuItems.push(...menuItemsModel);
  }

  if (node?.type === "customColumnNode") {
    menuItems.push(...menuItemsColumn);
  }

  return (
    <>
      {isOpen && (
        // Only render context menu when select mode is action
        <Menu isOpen={true} onClose={onClose}>
          <MenuList
            fontSize="9pt"
            position="absolute"
            width="250px"
            style={{
              left: `${x}px`,
              top: `${y}px`,
            }}>
            {menuItems.map((item, index) => (
              <MenuItem
                key={index}
                icon={item.icon as any}
                onClick={() => {
                  item.action();
                  onClose();
                }}>
                {item.label}
              </MenuItem>
            ))}
          </MenuList>
        </Menu>
      )}
    </>
  );
};

export const useLineageViewContextMenu = ({
  offsetX,
  offsetY,
}: {
  offsetX: number;
  offsetY: number;
}) => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [node, setNode] = useState<Node | NodeProps>();

  const showContextMenu = (event: React.MouseEvent, node: Node | NodeProps) => {
    const x = event.clientX + offsetX;
    const y = event.clientY + offsetY;

    setPosition({ x, y });
    setNode(node);
    onOpen();
  };

  const closeContextMenu = () => {
    setPosition({ x: 0, y: 0 });
    setNode(undefined);
    onClose();
  };

  const props: LineageViewContextMenuProps = {
    x: position.x,
    y: position.y,
    node,
    isOpen,
    onClose,
  };

  return {
    props,
    showContextMenu,
    closeContextMenu,
  };
};
