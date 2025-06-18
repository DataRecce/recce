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
import useModelColumns from "@/lib/hooks/useModelColumns";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { useLocation } from "wouter";
import { SubmitRunTrackProps } from "@/lib/api/runs";
import { formatSelectColumns } from "@/lib/formatSelect";

interface LineageViewContextMenuProps {
  x: number;
  y: number;
  node?: Node | NodeProps;
  isOpen: boolean;
  onClose: () => void;
}

interface ContextMenuItem {
  label?: string;
  icon?: React.ReactElement;
  action?: () => void;
  isDisabled?: boolean;
  isSeparator?: boolean;
}

interface ContextMenuProps {
  menuItems: ContextMenuItem[];
  isOpen: boolean;
  onClose: () => void;
  x: number;
  y: number;
}

const ContextMenu = ({ menuItems, isOpen, onClose, x, y }: ContextMenuProps) => {
  return (
    <Menu isOpen={isOpen} onClose={onClose}>
      <MenuList
        fontSize="10pt"
        position="absolute"
        width="250px"
        style={{
          left: `${x}px`,
          top: `${y}px`,
        }}>
        {menuItems.length === 0 ? (
          <MenuItem isDisabled key="no action">
            No action available
          </MenuItem>
        ) : (
          menuItems.map((item) => {
            if (item.isSeparator) {
              return <MenuDivider key={item.label} />;
            } else {
              return (
                <MenuItem
                  key={item.label}
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
  );
};

export const ModelNodeContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
}: LineageViewContextMenuProps) => {
  const menuItems: ContextMenuItem[] = [];

  const {
    selectParentNodes,
    selectChildNodes,
    getNodeColumnSet,
    selectMode,
    viewOptions,
    showColumnLevelLineage,
  } = useLineageViewContextSafe();
  const { runAction } = useRecceActionContext();
  const { isActionAvailable } = useLineageGraphContext();
  const { data: flag } = useRecceServerFlag();
  const singleEnv = flag?.single_env_onboarding ?? false;

  // query
  const { primaryKey } = useModelColumns((node?.data as LineageGraphNode | undefined)?.name);
  const { setSqlQuery, setPrimaryKeys } = useRecceQueryContext();
  const [, setLocation] = useLocation();

  if (!node?.data) {
    return <></>;
  }

  const modelNode = node.data as LineageGraphNode;
  const resourceType = modelNode.resourceType;
  const columns = Array.from(getNodeColumnSet(node.id));
  const trackProps: SubmitRunTrackProps = {
    source: "lineage_model_node",
  };

  if (!selectMode && resourceType && ["model", "seed", "snapshot"].includes(resourceType)) {
    // query
    let entry = findByRunType(singleEnv ? "query" : "query_diff");
    const baseColumns = Object.keys(modelNode.data.base?.columns ?? {});
    const currentColumns = Object.keys(modelNode.data.current?.columns ?? {});
    const formattedColumns = formatSelectColumns(baseColumns, currentColumns);
    let query = `select * from {{ ref("${modelNode.name}") }}`;
    if (formattedColumns.length) {
      query = `select \n  ${formattedColumns.join("\n  ")}\nfrom {{ ref("${modelNode.name}") }}`;
    }

    menuItems.push({
      label: "Query",
      icon: <Icon as={entry?.icon} />,
      action: () => {
        setSqlQuery(query);
        if (isActionAvailable("query_diff_with_primary_key")) {
          // Only set primary key if the action is available
          setPrimaryKeys(primaryKey !== undefined ? [primaryKey] : undefined);
        }
        setLocation("/query");
      },
    });

    if (columns.length > 0) {
      if (viewOptions.column_level_lineage !== undefined) {
        const allColumns = new Set<string>();
        if (primaryKey) {
          allColumns.add(primaryKey);
        }
        columns.forEach((column) => {
          allColumns.add(column);
        });

        menuItems.push({
          label: "Query Related Columns",
          icon: <Icon as={entry?.icon} />,
          action: () => {
            const query = `select \n  ${Array.from(allColumns).join(",\n  ")}\nfrom {{ ref("${modelNode.name}") }}`;
            setSqlQuery(query);
            if (isActionAvailable("query_diff_with_primary_key")) {
              // Only set primary key if the action is available
              setPrimaryKeys(primaryKey !== undefined ? [primaryKey] : undefined);
            }
            setLocation("/query");
          },
        });
      } else {
        // modified columns
        const changedColumns = Object.entries(modelNode.change?.columns ?? {})
          .filter(([, value]) => value === "modified")
          .map(([key]) => key);
        if (changedColumns.length > 0) {
          const allColumns = new Set<string>();
          if (primaryKey) {
            allColumns.add(primaryKey);
          }
          changedColumns.forEach((column) => {
            allColumns.add(column);
          });

          menuItems.push({
            label: "Query Modified Columns",
            icon: <Icon as={entry?.icon} />,
            action: () => {
              const query = `select \n  ${Array.from(allColumns).join(",\n  ")}\nfrom {{ ref("${modelNode.name}") }}`;
              setSqlQuery(query);
              if (isActionAvailable("query_diff_with_primary_key")) {
                // Only set primary key if the action is available
                setPrimaryKeys(primaryKey !== undefined ? [primaryKey] : undefined);
              }
              setLocation("/query");
            },
          });
        }
      }
    }

    // row count & row count diff
    entry = findByRunType(singleEnv ? "row_count" : "row_count_diff");
    menuItems.push({
      label: entry?.title ?? "Row count",
      icon: <Icon as={entry?.icon} />,
      action: () => {
        runAction(
          singleEnv ? "row_count" : "row_count_diff",
          { node_names: [modelNode.name] },
          { showForm: false, trackProps },
        );
      },
    });

    // profile & profile diff
    entry = findByRunType(singleEnv ? "profile" : "profile_diff");
    menuItems.push({
      label: entry?.title ?? "Profile",
      icon: <Icon as={entry?.icon} />,
      action: () => {
        const columns = Array.from(getNodeColumnSet(node.id));
        runAction(
          singleEnv ? "profile" : "profile_diff",
          { model: modelNode.name, columns },
          { showForm: true, trackProps },
        );
      },
    });

    // value diff
    if (!singleEnv) {
      entry = findByRunType("value_diff");
      menuItems.push({
        label: entry?.title ?? "Value Diff",
        icon: <Icon as={entry?.icon} />,
        action: () => {
          const columns = Array.from(getNodeColumnSet(node.id));
          runAction(
            "value_diff",
            { model: modelNode.name, columns },
            { showForm: true, trackProps },
          );
        },
      });
    }
  }

  if (!singleEnv) {
    if (menuItems.length > 0) {
      menuItems.push({
        label: "select group",
        isSeparator: true,
      });
    }
    menuItems.push({
      label: "Select Parent Nodes",
      icon: <BiArrowFromBottom />,
      action: () => {
        selectParentNodes(node.id, 1);
      },
    });
    menuItems.push({
      label: "Select Child Nodes",
      icon: <BiArrowToBottom />,
      action: () => {
        selectChildNodes(node.id, 1);
      },
    });
    menuItems.push({
      label: "Select All Upstream Nodes",
      icon: <BiArrowFromBottom />,
      action: () => {
        selectParentNodes(node.id);
      },
    });
    menuItems.push({
      label: "Select All Downstream Nodes",
      icon: <BiArrowToBottom />,
      action: () => {
        selectChildNodes(node.id);
      },
    });
    menuItems.push({
      label: "Show Impcat Radius",
      icon: <BiArrowToBottom />,
      action: () => {
        void showColumnLevelLineage(node.id);
      },
    });
  }

  return <ContextMenu x={x} y={y} menuItems={menuItems} isOpen={isOpen} onClose={onClose} />;
};

export const ColumnNodeContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
}: LineageViewContextMenuProps) => {
  const menuItems: ContextMenuItem[] = [];

  const { runAction } = useRecceActionContext();
  const { isActionAvailable } = useLineageGraphContext();
  const { data: flag } = useRecceServerFlag();
  const singleEnv = flag?.single_env_onboarding ?? false;

  if (node?.data === undefined) {
    return <></>;
  }

  const columnNode = node.data as LinageGraphColumnNode;
  const modelNode = columnNode.node;
  const column = columnNode.column;
  const columnType = columnNode.type;
  const trackProps: SubmitRunTrackProps = {
    source: "lineage_column_node",
  };

  const handleProfileDiff = () => {
    runAction(
      "profile_diff",
      { model: modelNode.name, columns: [column] },
      { showForm: false, trackProps },
    );
  };

  const handleHistogramDiff = () => {
    runAction(
      "histogram_diff",
      { model: modelNode.name, column_name: column, column_type: columnType },
      { showForm: false, trackProps },
    );
  };

  const handleTopkDiff = () => {
    runAction(
      "top_k_diff",
      { model: modelNode.name, column_name: column, k: 50 },
      { showForm: false, trackProps },
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

  return <ContextMenu x={x} y={y} menuItems={menuItems} isOpen={isOpen} onClose={onClose} />;
};

export const LineageViewContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
}: LineageViewContextMenuProps) => {
  const { readOnly } = useRecceInstanceContext();
  if (readOnly) {
    <ContextMenu menuItems={[]} isOpen={isOpen} onClose={onClose} x={x} y={y} />;
  } else if (node?.type === "customNode") {
    return <ModelNodeContextMenu x={x} y={y} isOpen={isOpen} onClose={onClose} node={node} />;
  } else if (node?.type === "customColumnNode") {
    return <ColumnNodeContextMenu x={x} y={y} isOpen={isOpen} onClose={onClose} node={node} />;
  }
};

export const useLineageViewContextMenu = () => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [node, setNode] = useState<Node | NodeProps>();

  const showContextMenu = (x: number, y: number, node: Node | NodeProps) => {
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
