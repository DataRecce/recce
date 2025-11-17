import { Icon, Menu, Portal, useDisclosure } from "@chakra-ui/react";
import { ReactNode, useState } from "react";
import { BiArrowFromBottom, BiArrowToBottom } from "react-icons/bi";
import { FaRegDotCircle } from "react-icons/fa";
import { useLocation } from "wouter";
import SetupConnectionPopover from "@/components/app/SetupConnectionPopover";
import { SubmitRunTrackProps } from "@/lib/api/runs";
import { formatSelectColumns } from "@/lib/formatSelect";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import useModelColumns from "@/lib/hooks/useModelColumns";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { supportsHistogramDiff } from "../histogram/HistogramDiffForm";
import { findByRunType } from "../run/registry";
import { useLineageViewContextSafe } from "./LineageViewContext";
import {
  isLineageGraphColumnNode,
  isLineageGraphNode,
  LineageGraphColumnNode,
  LineageGraphNode,
  LineageGraphNodes,
} from "./lineage";

interface LineageViewContextMenuProps<T> {
  x: number;
  y: number;
  node?: T;
  isOpen: boolean;
  onClose: () => void;
}

interface ContextMenuItem {
  label?: string;
  itemIcon?: ReactNode;
  action?: () => void;
  isDisabled?: boolean;
  isSeparator?: boolean;
}

interface ContextMenuProps {
  menuItems: ContextMenuItem[];
  open: boolean;
  onClose: () => void;
  x: number;
  y: number;
}

const ContextMenu = ({ menuItems, open, onClose, x, y }: ContextMenuProps) => {
  const { featureToggles } = useRecceInstanceContext();

  return (
    <Menu.Root open={open} onOpenChange={onClose}>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            fontSize="0.85rem"
            position="absolute"
            width="250px"
            style={{
              left: `${x}px`,
              top: `${y}px`,
            }}
          >
            {menuItems.length === 0 ? (
              <Menu.Item value="no-action" disabled key="no action">
                No action available
              </Menu.Item>
            ) : (
              menuItems.map(
                ({ isSeparator, label, isDisabled, action, itemIcon }) => {
                  if (isSeparator) {
                    return <Menu.Separator key={label} />;
                  } else {
                    const menuItem = (
                      <Menu.Item
                        value={String(label)}
                        key={label}
                        disabled={isDisabled}
                        onClick={() => {
                          if (action) {
                            action();
                          }
                          onClose();
                        }}
                      >
                        {itemIcon} {label}
                      </Menu.Item>
                    );

                    // Wrap disabled items with SetupConnectionPopover
                    if (isDisabled) {
                      return (
                        <SetupConnectionPopover
                          display={featureToggles.mode === "metadata only"}
                          key={label}
                        >
                          {menuItem}
                        </SetupConnectionPopover>
                      );
                    }

                    return menuItem;
                  }
                },
              )
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

export const ModelNodeContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
}: LineageViewContextMenuProps<LineageGraphNode>) => {
  const menuItems: ContextMenuItem[] = [];

  const {
    selectParentNodes,
    selectChildNodes,
    getNodeColumnSet,
    selectMode,
    cll,
    showColumnLevelLineage,
  } = useLineageViewContextSafe();
  const { runAction } = useRecceActionContext();
  const { featureToggles } = useRecceInstanceContext();
  const { isActionAvailable } = useLineageGraphContext();
  const { data: flag } = useRecceServerFlag();
  const { lineageGraph } = useLineageGraphContext();
  const noCatalogCurrent = !lineageGraph?.catalogMetadata.current;
  const singleEnv = flag?.single_env_onboarding ?? false;
  const isQueryDisabled = featureToggles.disableDatabaseQuery;

  // query
  const { primaryKey } = useModelColumns(
    (node?.data as LineageGraphNode | undefined)?.data.name,
  );
  const { setSqlQuery, setPrimaryKeys } = useRecceQueryContext();
  const [, setLocation] = useLocation();

  if (!node?.data) {
    return <></>;
  }

  const modelNode = node.data;
  const resourceType = modelNode.resourceType;
  const columns = Array.from(getNodeColumnSet(node.id));
  const trackProps: SubmitRunTrackProps = {
    source: "lineage_model_node",
  };
  const changeStatus = modelNode.changeStatus;

  if (changeStatus === "modified") {
    menuItems.push({
      label: "Show Impact Radius",
      itemIcon: <FaRegDotCircle />,
      isDisabled: noCatalogCurrent,
      action: () => {
        void showColumnLevelLineage({
          node_id: node.id,
          change_analysis: true,
          no_upstream: true,
        });
      },
    });
  }

  if (
    !selectMode &&
    resourceType &&
    ["model", "seed", "snapshot"].includes(resourceType)
  ) {
    if (menuItems.length > 0) {
      menuItems.push({
        label: "select group one",
        isSeparator: true,
      });
    }

    // query
    const run = findByRunType(singleEnv ? "query" : "query_diff");
    const baseColumns = Object.keys(modelNode.data.base?.columns ?? {});
    const currentColumns = Object.keys(modelNode.data.current?.columns ?? {});
    const formattedColumns = formatSelectColumns(baseColumns, currentColumns);
    let query = `select * from {{ ref("${modelNode.name}") }}`;
    if (formattedColumns.length) {
      query = `select \n  ${formattedColumns.join("\n  ")}\nfrom {{ ref("${modelNode.name}") }}`;
    }

    menuItems.push({
      label: "Query",
      itemIcon: <Icon as={run.icon} />,
      isDisabled: isQueryDisabled,
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
      if (cll !== undefined) {
        const allColumns = new Set<string>();
        if (primaryKey) {
          allColumns.add(primaryKey);
        }
        columns.forEach((column) => {
          allColumns.add(column);
        });

        menuItems.push({
          label: "Query Related Columns",
          itemIcon: <Icon as={run.icon} />,
          isDisabled: isQueryDisabled,
          action: () => {
            const query = `select \n  ${Array.from(allColumns).join(",\n  ")}\nfrom {{ ref("${modelNode.name}") }}`;
            setSqlQuery(query);
            if (isActionAvailable("query_diff_with_primary_key")) {
              // Only set primary key if the action is available
              setPrimaryKeys(
                primaryKey !== undefined ? [primaryKey] : undefined,
              );
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
            itemIcon: <Icon as={run.icon} />,
            isDisabled: isQueryDisabled,
            action: () => {
              const query = `select \n  ${Array.from(allColumns).join(",\n  ")}\nfrom {{ ref("${modelNode.name}") }}`;
              setSqlQuery(query);
              if (isActionAvailable("query_diff_with_primary_key")) {
                // Only set primary key if the action is available
                setPrimaryKeys(
                  primaryKey !== undefined ? [primaryKey] : undefined,
                );
              }
              setLocation("/query");
            },
          });
        }
      }
    }

    // row count & row count diff
    const rowCountAndRowCountRun = findByRunType(
      singleEnv ? "row_count" : "row_count_diff",
    );
    menuItems.push({
      label: rowCountAndRowCountRun.title,
      itemIcon: <Icon as={rowCountAndRowCountRun.icon} />,
      isDisabled: isQueryDisabled,
      action: () => {
        runAction(
          singleEnv ? "row_count" : "row_count_diff",
          { node_names: [modelNode.name] },
          { showForm: false, trackProps },
        );
      },
    });

    // profile & profile diff
    const profileAndProfileDiffRun = findByRunType(
      singleEnv ? "profile" : "profile_diff",
    );
    menuItems.push({
      label: profileAndProfileDiffRun.title,
      itemIcon: <Icon as={profileAndProfileDiffRun.icon} />,
      isDisabled: isQueryDisabled,
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
      const valueDiffRun = findByRunType("value_diff");
      menuItems.push({
        label: valueDiffRun.title,
        itemIcon: <Icon as={valueDiffRun.icon} />,
        isDisabled: isQueryDisabled,
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
        label: "select group two",
        isSeparator: true,
      });
    }
    menuItems.push({
      label: "Select Parent Nodes",
      itemIcon: <BiArrowFromBottom />,
      action: () => {
        selectParentNodes(node.id, 1);
      },
    });
    menuItems.push({
      label: "Select Child Nodes",
      itemIcon: <BiArrowToBottom />,
      action: () => {
        selectChildNodes(node.id, 1);
      },
    });
    menuItems.push({
      label: "Select All Upstream Nodes",
      itemIcon: <BiArrowFromBottom />,
      action: () => {
        selectParentNodes(node.id);
      },
    });
    menuItems.push({
      label: "Select All Downstream Nodes",
      itemIcon: <BiArrowToBottom />,
      action: () => {
        selectChildNodes(node.id);
      },
    });
  }

  return (
    <ContextMenu
      x={x}
      y={y}
      menuItems={menuItems}
      open={isOpen}
      onClose={onClose}
    />
  );
};

export const ColumnNodeContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
}: LineageViewContextMenuProps<LineageGraphColumnNode>) => {
  const menuItems: ContextMenuItem[] = [];

  const { runAction } = useRecceActionContext();
  const { isActionAvailable } = useLineageGraphContext();
  const { featureToggles } = useRecceInstanceContext();
  const { data: flag } = useRecceServerFlag();
  const singleEnv = flag?.single_env_onboarding ?? false;
  const isQueryDisabled = featureToggles.disableDatabaseQuery;

  if (node?.data === undefined) {
    return <></>;
  }

  const columnNode = node.data;
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

  const handleValueDiff = () => {
    runAction(
      "value_diff",
      { model: modelNode.name, columns: [column] },
      { showForm: true, trackProps },
    );
  };

  const addedOrRemoved =
    modelNode.data.base?.columns?.[column] === undefined ||
    modelNode.data.current?.columns?.[column] === undefined;

  const run = findByRunType(singleEnv ? "profile" : "profile_diff");
  menuItems.push({
    label: run.title,
    itemIcon: <Icon as={run.icon} />,
    action: handleProfileDiff,
    isDisabled:
      addedOrRemoved || !isActionAvailable("profile_diff") || isQueryDisabled,
  });

  if (!singleEnv) {
    const isHistogramDiffRun = findByRunType("histogram_diff");
    menuItems.push({
      label: isHistogramDiffRun.title,
      itemIcon: <Icon as={isHistogramDiffRun.icon} />,
      action: handleHistogramDiff,
      isDisabled:
        addedOrRemoved ||
        (columnType ? !supportsHistogramDiff(columnType) : true) ||
        isQueryDisabled,
    });
    const isTopKDiffRun = findByRunType("top_k_diff");
    menuItems.push({
      label: isTopKDiffRun.title,
      itemIcon: <Icon as={isTopKDiffRun.icon} />,
      action: handleTopkDiff,
      isDisabled: addedOrRemoved || isQueryDisabled,
    });

    const isValueDiffRun = findByRunType("value_diff");
    menuItems.push({
      label: isValueDiffRun.title,
      itemIcon: <Icon as={isValueDiffRun.icon} />,
      action: handleValueDiff,
      isDisabled: addedOrRemoved || isQueryDisabled,
    });
  }

  return (
    <ContextMenu
      x={x}
      y={y}
      menuItems={menuItems}
      open={isOpen}
      onClose={onClose}
    />
  );
};

export const LineageViewContextMenu = ({
  isOpen,
  onClose,
  x,
  y,
  node,
}: LineageViewContextMenuProps<LineageGraphNodes>) => {
  const { featureToggles } = useRecceInstanceContext();
  if (featureToggles.disableViewActionDropdown) {
    return (
      <ContextMenu menuItems={[]} open={isOpen} onClose={onClose} x={x} y={y} />
    );
  } else if (node && isLineageGraphNode(node)) {
    return (
      <ModelNodeContextMenu
        x={x}
        y={y}
        isOpen={isOpen}
        onClose={onClose}
        node={node}
      />
    );
  } else if (node && isLineageGraphColumnNode(node)) {
    return (
      <ColumnNodeContextMenu
        x={x}
        y={y}
        isOpen={isOpen}
        onClose={onClose}
        node={node}
      />
    );
  }
};

export const useLineageViewContextMenu = () => {
  const { open, onClose, onOpen } = useDisclosure();
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [node, setNode] = useState<LineageGraphNodes>();

  const showContextMenu = (x: number, y: number, node: LineageGraphNodes) => {
    setPosition({ x, y });
    setNode(node);
    onOpen();
  };

  const closeContextMenu = () => {
    setPosition({ x: 0, y: 0 });
    setNode(undefined);
    onClose();
  };

  const props: LineageViewContextMenuProps<LineageGraphNodes> = {
    x: position.x,
    y: position.y,
    node,
    isOpen: open,
    onClose,
  };

  return {
    props,
    showContextMenu,
    closeContextMenu,
  };
};
