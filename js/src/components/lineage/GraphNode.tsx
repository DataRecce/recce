import { useThemeColors } from "@datarecce/ui/hooks";
import { deltaPercentageString } from "@datarecce/ui/utils";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import MuiTooltip from "@mui/material/Tooltip";
import { Handle, NodeProps, Position, useStore } from "@xyflow/react";
import React, { useState } from "react";
import { FaCheckSquare, FaRegDotCircle, FaRegSquare } from "react-icons/fa";
import { VscKebabVertical } from "react-icons/vsc";
import { RowCountDiff } from "@/lib/api/models";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { findByRunType } from "../run/registry";
import { isSchemaChanged } from "../schema/schemaDiff";
import { ActionTag } from "./ActionTag";
import { useLineageViewContextSafe } from "./LineageViewContext";
import { COLUMN_HEIGHT, LineageGraphNode } from "./lineage";
import { getIconForChangeStatus, getIconForResourceType } from "./styles";

import "./styles.css";
import { token } from "@/components/ui/mui-theme";

export type GraphNodeProps = NodeProps<LineageGraphNode>;

function _RowCountDiffTag({ rowCount }: { rowCount: RowCountDiff }) {
  const base = rowCount.base;
  const current = rowCount.curr;
  const baseLabel = rowCount.base === null ? "N/A" : `${rowCount.base} Rows`;
  const currentLabel = rowCount.curr === null ? "N/A" : `${rowCount.curr} Rows`;

  let tagLabel;
  let chipColor: "default" | "success" | "error" = "default";
  if (base === null && current === null) {
    tagLabel = "Failed to load";
    chipColor = "default";
  } else if (base === null || current === null) {
    tagLabel = `${baseLabel} -> ${currentLabel}`;
    chipColor = base === null ? "success" : "error";
  } else if (base === current) {
    tagLabel = "=";
    chipColor = "default";
  } else if (base !== current) {
    tagLabel = `${deltaPercentageString(base, current)} Rows`;
    chipColor = base < current ? "success" : "error";
  }

  const RowCountIcon = findByRunType("row_count_diff").icon;

  return (
    <Chip
      size="small"
      color={chipColor}
      icon={RowCountIcon ? <RowCountIcon /> : undefined}
      label={tagLabel}
      sx={{ height: 20, fontSize: "0.7rem" }}
    />
  );
}

const CHANGE_CATEGORY_MSGS = {
  breaking: "Breaking",
  non_breaking: "Non Breaking",
  partial_breaking: "Partial Breaking",
  unknown: "Unknown",
};

const NodeRunsAggregated = ({
  id,
  inverted,
}: {
  id: string;
  inverted: boolean;
}) => {
  const { lineageGraph, runsAggregated } = useLineageGraphContext();
  const { text, isDark } = useThemeColors();
  const runs = runsAggregated?.[id];
  const node = lineageGraph?.nodes[id];
  if (!runs && !node) {
    return <></>;
  }

  let schemaChanged;
  if (node?.data.data.base && node.data.data.current) {
    const baseColumns = node.data.data.base.columns;
    const currColumns = node.data.data.current.columns;
    schemaChanged = isSchemaChanged(baseColumns, currColumns);
  }

  let rowCountChanged;
  if (runs?.row_count_diff) {
    const rowCountDiff = runs.row_count_diff;
    const result = rowCountDiff.result as RowCountDiff;
    rowCountChanged = result.curr !== result.base;
  }

  const colorChanged = inverted
    ? text.inverted
    : getIconForChangeStatus("modified").color;
  const colorUnchanged = inverted
    ? text.secondary
    : isDark
      ? "grey.700"
      : "grey.100";

  const SchemaDiffIcon = findByRunType("schema_diff").icon;

  return (
    <Box sx={{ display: "flex", flex: 1, alignItems: "center" }}>
      {schemaChanged !== undefined && (
        <MuiTooltip
          title={`Schema (${schemaChanged ? "changed" : "no change"})`}
          enterDelay={500}
        >
          <Box sx={{ height: 16 }}>
            {SchemaDiffIcon && (
              <Box
                component={SchemaDiffIcon}
                sx={{ color: schemaChanged ? colorChanged : colorUnchanged }}
              />
            )}
          </Box>
        </MuiTooltip>
      )}
      <Box sx={{ flexGrow: 1 }} />
      {runs?.row_count_diff && rowCountChanged !== undefined && (
        <MuiTooltip
          title={`Row count (${rowCountChanged ? "changed" : "="})`}
          enterDelay={500}
        >
          <Box>
            <_RowCountDiffTag
              rowCount={runs.row_count_diff.result as RowCountDiff}
            />
          </Box>
        </MuiTooltip>
      )}
    </Box>
  );
};

const GraphNodeCheckbox = ({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick?: React.MouseEventHandler;
}) => {
  return (
    <Box
      onClick={onClick}
      sx={{
        alignSelf: "center",
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
      }}
    >
      {checked ? (
        <Box component={FaCheckSquare} sx={{ fontSize: 20 }} />
      ) : (
        <Box component={FaRegSquare} sx={{ fontSize: 20 }} />
      )}
    </Box>
  );
};

const GraphNodeTitle = ({
  name,
  color,
  resourceType,
}: {
  name: string;
  color: string;
  resourceType?: string;
}) => {
  return (
    <Box
      sx={{
        flex: 1,
        color,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      <MuiTooltip
        title={resourceType === "model" ? name : `${name} (${resourceType})`}
        placement="top"
      >
        <span>{name}</span>
      </MuiTooltip>
    </Box>
  );
};

export function GraphNode(nodeProps: GraphNodeProps) {
  const { data } = nodeProps;
  const { id, resourceType, changeStatus } = data;

  const showContent = useStore((s) => s.transform[2] > 0.3);
  const { background, text, isDark } = useThemeColors();

  const { icon: ResourceIcon } = getIconForResourceType(resourceType);
  const [isHovered, setIsHovered] = useState(false);
  const {
    interactive,
    selectNode,
    selectMode,
    focusedNode,
    getNodeAction,
    getNodeColumnSet,
    isNodeHighlighted,
    isNodeSelected,
    isNodeShowingChangeAnalysis,
    showContextMenu,
    viewOptions,
    cll,
    showColumnLevelLineage,
  } = useLineageViewContextSafe();
  const changeCategory = cll?.current.nodes[id]?.change_category;

  const _isNonBreakingChange = changeCategory === "non_breaking";
  const isHighlighted = isNodeHighlighted(id);
  const isSelected = isNodeSelected(id);
  const isFocusedByImpactRadius =
    viewOptions.column_level_lineage?.node_id === id &&
    viewOptions.column_level_lineage.column === undefined;
  const isFocused = focusedNode?.id === id || isFocusedByImpactRadius;

  const isShowingChangeAnalysis = isNodeShowingChangeAnalysis(id);

  // text color, icon
  const {
    icon: IconChangeStatus,
    color: colorChangeStatus,
    backgroundColor: backgroundColorChangeStatus,
  } = changeStatus
    ? getIconForChangeStatus(changeStatus, isDark)
    : {
        icon: undefined,
        color: String(token("colors.gray.400")),
        backgroundColor: isDark
          ? String(token("colors.gray.700"))
          : String(token("colors.gray.100")),
      };

  // border width and color
  const borderWidth = "2px";
  const borderColor = colorChangeStatus;

  const name = data.name;
  const columnSet = getNodeColumnSet(data.id);
  const showColumns = columnSet.size > 0;
  const action =
    selectMode === "action_result" ? getNodeAction(data.id) : undefined;

  const nodeBackgroundColor = (function () {
    if (showContent) {
      if (selectMode === "selecting") {
        return isSelected ? colorChangeStatus : background.paper;
      } else if (selectMode === "action_result") {
        if (!action) {
          return background.paper;
        } else {
          return isFocused || isSelected || isHovered
            ? backgroundColorChangeStatus
            : colorChangeStatus;
        }
      } else {
        return isFocused || isSelected || isHovered
          ? backgroundColorChangeStatus
          : background.paper;
      }
    } else {
      return isFocused || isSelected || isHovered
        ? colorChangeStatus
        : backgroundColorChangeStatus;
    }
  })();
  const titleColor = (function () {
    if (selectMode === "selecting") {
      return isSelected ? text.inverted : text.primary;
    } else if (selectMode === "action_result") {
      return !!action && !isSelected ? text.inverted : text.primary;
    } else {
      return text.primary;
    }
  })();
  const iconResourceColor = (function () {
    if (selectMode === "selecting") {
      return isSelected ? text.inverted : text.primary;
    } else if (selectMode === "action_result") {
      return !!action && !isSelected ? text.inverted : text.primary;
    } else {
      return text.primary;
    }
  })();
  const iconChangeStatusColor = (function () {
    if (selectMode === "selecting") {
      return isSelected ? text.inverted : colorChangeStatus;
    } else if (selectMode === "action_result") {
      return !!action && !isSelected ? text.inverted : text.primary;
    } else {
      return colorChangeStatus;
    }
  })();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: 300,
        cursor: selectMode === "selecting" ? "pointer" : "inherit",
        transition: "box-shadow 0.2s ease-in-out",
        padding: 0,
        filter: (function () {
          if (selectMode === "action_result") {
            return action ? "none" : "opacity(0.2) grayscale(50%)";
          } else {
            return isHighlighted || isFocused || isSelected || isHovered
              ? "none"
              : "opacity(0.2) grayscale(50%)";
          }
        })(),
      }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      <Box
        sx={{
          display: "flex",
          borderColor,
          borderWidth,
          borderStyle: "solid",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderBottomLeftRadius: showColumns ? 0 : 8,
          borderBottomRightRadius: showColumns ? 0 : 8,
          backgroundColor: nodeBackgroundColor,
          height: 60,
        }}
      >
        <Box
          sx={{
            display: "flex",
            bgcolor: colorChangeStatus,
            padding: interactive ? "8px" : "2px",
            borderRightWidth: borderWidth,
            borderRightStyle: "solid",
            borderColor: selectMode === "selecting" ? "#00000020" : borderColor,
            alignItems: "top",
            visibility: showContent ? "inherit" : "hidden",
          }}
        >
          {interactive && (
            <GraphNodeCheckbox
              checked={
                (selectMode === "selecting" && isSelected) ||
                (selectMode === "action_result" && !!action)
              }
              onClick={(e) => {
                if (selectMode === "action_result") {
                  return;
                }
                e.stopPropagation();
                selectNode(data.id);
              }}
            />
          )}
        </Box>

        <Box
          sx={{
            display: "flex",
            flex: "1 0 auto",
            mx: 0.5,
            width: 100,
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              display: "flex",
              width: "100%",
              textAlign: "left",
              fontWeight: 600,
              flex: 1,
              p: 0.5,
              gap: "5px",
              alignItems: "center",
              visibility: showContent ? "inherit" : "hidden",
            }}
          >
            <GraphNodeTitle
              name={name}
              color={titleColor}
              resourceType={resourceType}
            />

            {isHovered ? (
              <>
                {changeStatus === "modified" && (
                  <MuiTooltip
                    title="Show Impact Radius"
                    placement="top"
                    enterDelay={500}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Box
                        component={FaRegDotCircle}
                        sx={{
                          fontSize: 14,
                          color: text.secondary,
                          cursor: "pointer",
                          "&:hover": { color: text.primary },
                        }}
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();

                          void showColumnLevelLineage({
                            node_id: id,
                            change_analysis: true,
                            no_upstream: true,
                          });
                        }}
                      />
                    </Box>
                  </MuiTooltip>
                )}
                <Box
                  component={VscKebabVertical}
                  sx={{
                    color: text.secondary,
                    cursor: "pointer",
                    "&:hover": { color: text.primary },
                  }}
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showContextMenu(
                      e,
                      nodeProps as unknown as LineageGraphNode,
                    );
                  }}
                />
              </>
            ) : (
              <>
                {ResourceIcon && (
                  <Box
                    component={ResourceIcon}
                    sx={{ fontSize: 16, color: iconResourceColor }}
                  />
                )}
                {changeStatus && IconChangeStatus && (
                  <Box
                    component={IconChangeStatus}
                    sx={{ color: iconChangeStatusColor }}
                  />
                )}
              </>
            )}
          </Box>

          <Box
            sx={{
              display: "flex",
              flex: "1 0 auto",
              mx: 0.5,
              flexDirection: "column",
              paddingBottom: 0.5,
              visibility: showContent ? "inherit" : "hidden",
            }}
          >
            <Stack direction="row" spacing={1}>
              {action ? (
                <>
                  <Box sx={{ flexGrow: 1 }} />
                  <ActionTag
                    node={data as unknown as LineageGraphNode}
                    action={action}
                  />
                </>
              ) : isShowingChangeAnalysis ? (
                <Box
                  sx={{
                    height: 20,
                    color: text.secondary,
                    fontSize: "9pt",
                    margin: 0,
                    fontWeight: 600,
                  }}
                >
                  {changeCategory ? CHANGE_CATEGORY_MSGS[changeCategory] : ""}
                </Box>
              ) : selectMode !== "action_result" &&
                data.resourceType === "model" ? (
                <NodeRunsAggregated
                  id={data.id}
                  inverted={(function () {
                    if (selectMode === "selecting") {
                      return isSelected;
                    } else {
                      return false;
                    }
                  })()}
                />
              ) : (
                <></>
              )}
            </Stack>
          </Box>
        </Box>
      </Box>
      {showColumns && (
        <Box
          sx={{
            p: "10px 10px",
            borderColor,
            borderWidth,
            borderStyle: "solid",
            borderTopWidth: 0,
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
          }}
        >
          <Box
            sx={{
              height: `${columnSet.size * COLUMN_HEIGHT}px`,
              overflow: "auto",
            }}
          />
        </Box>
      )}
      {Object.keys(data.parents).length > 0 && (
        <Handle type="target" position={Position.Left} isConnectable={false} />
      )}
      {Object.keys(data.children).length > 0 && (
        <Handle type="source" position={Position.Right} isConnectable={false} />
      )}
    </Box>
  );
}
