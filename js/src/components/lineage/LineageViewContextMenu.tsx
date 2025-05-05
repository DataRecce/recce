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
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { memoryUsage } from "process";

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
    label?: string;
    icon?: React.ReactElement;
    action?: () => void;
    isDisabled?: boolean;
    isSeparator?: boolean;
  }[] = [];

  const { selectParentNodes, selectChildNodes, getNodeColumnSet, selectMode } =
    useLineageViewContextSafe();
  const { runAction } = useRecceActionContext();
  const { isActionAvailable } = useLineageGraphContext();
  const { readOnly } = useRecceInstanceContext();
  const { data: flag } = useRecceServerFlag();
  const singleEnv = flag?.single_env_onboarding ?? false;

  if (readOnly) {
    // no items in the context menu
    // we should prevent to show the context menu in the readonly mode
  } else if (node?.type === "customNode") {
    const modelNode = node.data as LineageGraphNode;
    const resourceType = modelNode.resourceType;

    const handleRowCountDiff = () => {
      runAction("row_count_diff", { node_names: [modelNode.name] }, { showForm: false });
    };
    const handleProfileDiff = () => {
      const columns = Array.from(getNodeColumnSet(node.id));
      runAction("profile_diff", { model: modelNode.name, columns }, { showForm: true });
    };
    const handleValueDiff = () => {
      const columns = Array.from(getNodeColumnSet(node.id));
      runAction("value_diff", { model: modelNode.name, columns }, { showForm: true });
    };

    if (!singleEnv) {
      if (!selectMode && resourceType && ["model", "seed", "snapshot"].includes(resourceType)) {
        let entry = findByRunType("row_count_diff");
        menuItems.push({
          label: entry?.title ?? "Row count",
          icon: <Icon as={entry?.icon} />,
          action: () => {
            handleRowCountDiff();
          },
        });
        entry = findByRunType("profile_diff");
        menuItems.push({
          label: entry?.title ?? "Profile",
          icon: <Icon as={entry?.icon} />,
          action: () => {
            handleProfileDiff();
          },
        });
        entry = findByRunType("value_diff");
        menuItems.push({
          label: entry?.title ?? "Value Diff",
          icon: <Icon as={entry?.icon} />,
          action: () => {
            handleValueDiff();
          },
        });
        if (menuItems.length > 0) {
          menuItems.push({
            isSeparator: true,
          });
        }
      }

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
  } else if (node?.type === "customColumnNode") {
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

    let entry = findByRunType(singleEnv ? "profile" : "profile_diff");
    menuItems.push({
      label: entry?.title ?? "Profile",
      icon: <Icon as={entry?.icon} />,
      action: handleProfileDiff,
      isDisabled: addedOrRemoved || !isActionAvailable("profile_diff"),
    });

    if (!singleEnv) {
      entry = findByRunType("histogram_diff");
      menuItems.push({
        label: entry?.title ?? "Histogram Diff",
        icon: <Icon as={entry?.icon} />,
        action: handleHistogramDiff,
        isDisabled: addedOrRemoved || (columnType ? !supportsHistogramDiff(columnType) : true),
      });
      entry = findByRunType("top_k_diff");
      menuItems.push({
        label: entry?.title ?? "Top-K Diff",
        icon: <Icon as={entry?.icon} />,
        action: handleTopkDiff,
        isDisabled: addedOrRemoved,
      });
    }
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
            {menuItems.length === 0 ? (
              <MenuItem isDisabled>No action available</MenuItem>
            ) : (
              menuItems.map((item) => {
                if (item.isSeparator) {
                  return <MenuDivider />;
                } else {
                  return (
                    <MenuItem
                      icon={item.icon}
                      isDisabled={item.isDisabled}
                      onClick={() => {
                        if (item.action) {
                          item.action();
                        }
                        onClose();
                      }}>
                      {item.label}
                    </MenuItem>
                  );
                }
              })
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
