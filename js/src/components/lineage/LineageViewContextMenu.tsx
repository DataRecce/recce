import { Menu, MenuList, MenuItem, MenuDivider, useDisclosure } from "@chakra-ui/react";
import { useState } from "react";
import { BiArrowFromBottom, BiArrowToBottom } from "react-icons/bi";
import { Node } from "reactflow";

interface LineageViewContextMenuProps {
  x: number;
  y: number;
  node?: Node;
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
            <MenuItem
              icon={<BiArrowFromBottom />}
              onClick={() => {
                // selectParentNodes(1);
              }}>
              Select parent nodes
            </MenuItem>
            <MenuItem
              icon={<BiArrowToBottom />}
              onClick={() => {
                // selectChildNodes(1);
              }}>
              Select child nodes
            </MenuItem>
            <MenuDivider></MenuDivider>
            <MenuItem
              icon={<BiArrowFromBottom />}
              onClick={() => {
                // selectParentNodes();
              }}>
              Select all upstream nodes
            </MenuItem>
            <MenuItem
              icon={<BiArrowToBottom />}
              onClick={() => {
                // selectChildNodes();
              }}>
              Select all downstream nodes
            </MenuItem>
            {node?.type === "customColumnNode" && (
              <MenuItem
                icon={<BiArrowToBottom />}
                onClick={() => {
                  // selectChildNodes();
                }}>
                Select all downstream columns
              </MenuItem>
            )}
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
  const [node, setNode] = useState<Node>();

  const showContextMenu = (event: React.MouseEvent, node: Node) => {
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
    node: node,
    isOpen,
    onClose,
  };

  return {
    props,
    showContextMenu,
    closeContextMenu,
  };
};
