import { Menu, MenuList, MenuItem, MenuDivider, useDisclosure, Icon } from "@chakra-ui/react";
import { useState } from "react";
import { BiArrowFromBottom, BiArrowToBottom } from "react-icons/bi";
import { Node, NodeProps } from "reactflow";
import { findByRunType } from "../run/registry";
import { useLineageViewContextSafe } from "./LineageViewContext";
import { LinageGraphColumnNode, LineageGraphNode } from "./lineage";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { supportsHistogramDiff } from "../histogram/HistogramDiffForm";

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
  const menuItems: {
    label: string;
    icon: React.ReactNode;
    action: () => void;
    isDisabled?: boolean;
  }[] = [];

  const { selectParentNodes, selectChildNodes } = useLineageViewContextSafe();
  const { runAction } = useRecceActionContext();
  const { isActionAvailable } = useLineageGraphContext();

  if (node?.type === "customNode") {
    menuItems.push({
      label: "Select parent nodes",
      icon: <BiArrowFromBottom />,
      action: () => {
        selectParentNodes(node.id, 1);
      },
    });
    menuItems.push({
      label: "Select child nodes",
      icon: <BiArrowToBottom />,
      action: () => {
        selectChildNodes(node.id, 1);
      },
    });
    menuItems.push({
      label: "Select all upstream nodes",
      icon: <BiArrowFromBottom />,
      action: () => {
        selectParentNodes(node.id);
      },
    });
    menuItems.push({
      label: "Select all downstream nodes",
      icon: <BiArrowToBottom />,
      action: () => {
        selectChildNodes(node.id);
      },
    });
  }

  if (node?.type === "customColumnNode") {
    const columnNode = node.data as LinageGraphColumnNode;
    const modelNode = columnNode.node;
    const column = columnNode.column;
    const columnType = columnNode.type;

    const handleProfileDiff = () => {
      runAction("profile_diff", { model: modelNode.name, columns: [column] }, { showForm: false });
    };

    const handleHistogramDiff = () => {
      runAction(
        "histogram_diff",
        { model: modelNode.name, column_name: column, column_type: columnType },
        { showForm: false },
      );
    };

    const handleTopkDiff = () => {
      runAction(
        "top_k_diff",
        { model: modelNode.name, column_name: column, k: 50 },
        { showForm: false },
      );
    };
    const addedOrRemoved =
      modelNode.data.base?.columns?.[column] === undefined ||
      modelNode.data.current?.columns?.[column] === undefined;

    menuItems.push({
      label: "Profile diff",
      icon: <Icon as={findByRunType("profile_diff")?.icon} />,
      action: handleProfileDiff,
      isDisabled: addedOrRemoved || !isActionAvailable("profile_diff"),
    });
    menuItems.push({
      label: "Histogram diff",
      icon: <Icon as={findByRunType("histogram_diff")?.icon} />,
      action: handleHistogramDiff,
      isDisabled: addedOrRemoved || (columnType ? !supportsHistogramDiff(columnType) : true),
    });
    menuItems.push({
      label: "Top-k diff",
      icon: <Icon as={findByRunType("top_k_diff")?.icon} />,
      action: handleTopkDiff,
      isDisabled: addedOrRemoved,
    });
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
                isDisabled={item.isDisabled}
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
