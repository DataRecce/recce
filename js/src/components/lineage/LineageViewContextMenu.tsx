import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { ReactNode, useState } from "react";
import { BiArrowFromBottom, BiArrowToBottom } from "react-icons/bi";
import { FaRegDotCircle } from "react-icons/fa";
import SetupConnectionPopover from "@/components/app/SetupConnectionPopover";
import { SubmitRunTrackProps } from "@/lib/api/runs";
import {
  EXPLORE_ACTION,
  EXPLORE_SOURCE,
  LINEAGE_SELECTION_ACTION,
  trackExploreAction,
  trackLineageSelection,
} from "@/lib/api/track";
import { formatSelectColumns } from "@/lib/formatSelect";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { useAppLocation } from "@/lib/hooks/useAppRouter";
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
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: y, left: x }}
      slotProps={{
        paper: {
          sx: { fontSize: "0.85rem", width: "250px" },
        },
      }}
    >
      {menuItems.length === 0 ? (
        <MenuItem disabled key="no action">
          No action available
        </MenuItem>
      ) : (
        menuItems.map(
          ({ isSeparator, label, isDisabled, action, itemIcon }) => {
            if (isSeparator) {
              return <Divider key={label} />;
            } else {
              const menuItem = (
                <MenuItem
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
                </MenuItem>
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
    </Menu>
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
  const [, setLocation] = useAppLocation();

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
      itemIcon: <Box component={run.icon} sx={{ display: "inline-flex" }} />,
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
          itemIcon: (
            <Box component={run.icon} sx={{ display: "inline-flex" }} />
          ),
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
            itemIcon: (
              <Box component={run.icon} sx={{ display: "inline-flex" }} />
            ),
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
      itemIcon: (
        <Box
          component={rowCountAndRowCountRun.icon}
          sx={{ display: "inline-flex" }}
        />
      ),
      isDisabled: isQueryDisabled,
      action: () => {
        trackExploreAction({
          action: singleEnv
            ? EXPLORE_ACTION.ROW_COUNT
            : EXPLORE_ACTION.ROW_COUNT_DIFF,
          source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
          node_count: 1,
        });
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
      itemIcon: (
        <Box
          component={profileAndProfileDiffRun.icon}
          sx={{ display: "inline-flex" }}
        />
      ),
      isDisabled: isQueryDisabled,
      action: () => {
        const columns = Array.from(getNodeColumnSet(node.id));
        trackExploreAction({
          action: singleEnv
            ? EXPLORE_ACTION.PROFILE
            : EXPLORE_ACTION.PROFILE_DIFF,
          source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
          node_count: 1,
        });
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
        itemIcon: (
          <Box component={valueDiffRun.icon} sx={{ display: "inline-flex" }} />
        ),
        isDisabled: isQueryDisabled,
        action: () => {
          const columns = Array.from(getNodeColumnSet(node.id));
          trackExploreAction({
            action: EXPLORE_ACTION.VALUE_DIFF,
            source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
            node_count: 1,
          });
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
        trackLineageSelection({
          action: LINEAGE_SELECTION_ACTION.SELECT_PARENT_NODES,
        });
        selectParentNodes(node.id, 1);
      },
    });
    menuItems.push({
      label: "Select Child Nodes",
      itemIcon: <BiArrowToBottom />,
      action: () => {
        trackLineageSelection({
          action: LINEAGE_SELECTION_ACTION.SELECT_CHILD_NODES,
        });
        selectChildNodes(node.id, 1);
      },
    });
    menuItems.push({
      label: "Select All Upstream Nodes",
      itemIcon: <BiArrowFromBottom />,
      action: () => {
        trackLineageSelection({
          action: LINEAGE_SELECTION_ACTION.SELECT_ALL_UPSTREAM,
        });
        selectParentNodes(node.id);
      },
    });
    menuItems.push({
      label: "Select All Downstream Nodes",
      itemIcon: <BiArrowToBottom />,
      action: () => {
        trackLineageSelection({
          action: LINEAGE_SELECTION_ACTION.SELECT_ALL_DOWNSTREAM,
        });
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
    trackExploreAction({
      action: EXPLORE_ACTION.PROFILE_DIFF,
      source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
      node_count: 1,
    });
    runAction(
      "profile_diff",
      { model: modelNode.name, columns: [column] },
      { showForm: false, trackProps },
    );
  };

  const handleHistogramDiff = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.HISTOGRAM_DIFF,
      source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
      node_count: 1,
    });
    runAction(
      "histogram_diff",
      { model: modelNode.name, column_name: column, column_type: columnType },
      { showForm: false, trackProps },
    );
  };

  const handleTopkDiff = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.TOP_K_DIFF,
      source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
      node_count: 1,
    });
    runAction(
      "top_k_diff",
      { model: modelNode.name, column_name: column, k: 50 },
      { showForm: false, trackProps },
    );
  };

  const handleValueDiff = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.VALUE_DIFF,
      source: EXPLORE_SOURCE.LINEAGE_VIEW_CONTEXT_MENU,
      node_count: 1,
    });
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
    itemIcon: <Box component={run.icon} sx={{ display: "inline-flex" }} />,
    action: handleProfileDiff,
    isDisabled:
      addedOrRemoved || !isActionAvailable("profile_diff") || isQueryDisabled,
  });

  if (!singleEnv) {
    const isHistogramDiffRun = findByRunType("histogram_diff");
    menuItems.push({
      label: isHistogramDiffRun.title,
      itemIcon: (
        <Box
          component={isHistogramDiffRun.icon}
          sx={{ display: "inline-flex" }}
        />
      ),
      action: handleHistogramDiff,
      isDisabled:
        addedOrRemoved ||
        (columnType ? !supportsHistogramDiff(columnType) : true) ||
        isQueryDisabled,
    });
    const isTopKDiffRun = findByRunType("top_k_diff");
    menuItems.push({
      label: isTopKDiffRun.title,
      itemIcon: (
        <Box component={isTopKDiffRun.icon} sx={{ display: "inline-flex" }} />
      ),
      action: handleTopkDiff,
      isDisabled: addedOrRemoved || isQueryDisabled,
    });

    const isValueDiffRun = findByRunType("value_diff");
    menuItems.push({
      label: isValueDiffRun.title,
      itemIcon: (
        <Box component={isValueDiffRun.icon} sx={{ display: "inline-flex" }} />
      ),
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
  const [open, setOpen] = useState(false);
  const onOpen = () => setOpen(true);
  const onClose = () => setOpen(false);
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
