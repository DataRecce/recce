import { Box, Center, Flex, HStack, Icon, Spacer, Tag } from "@chakra-ui/react";
import { Handle, NodeProps, Position, useStore } from "@xyflow/react";
import React, { useState } from "react";
import { COLUMN_HEIGHT, LineageGraphNode } from "./lineage";
import { getIconForChangeStatus, getIconForResourceType } from "./styles";

import "./styles.css";

import { FaCheckSquare, FaRegDotCircle, FaRegSquare } from "react-icons/fa";
import { VscKebabVertical } from "react-icons/vsc";
import { Tooltip } from "@/components/ui/tooltip";
import { RowCountDiff } from "@/lib/api/models";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { deltaPercentageString } from "../rowcount/delta";
import { findByRunType } from "../run/registry";
import { isSchemaChanged } from "../schema/schemaDiff";
import { ActionTag } from "./ActionTag";
import { useLineageViewContextSafe } from "./LineageViewContext";

export type GraphNodeProps = NodeProps<LineageGraphNode>;

function _RowCountDiffTag({ rowCount }: { rowCount: RowCountDiff }) {
  const base = rowCount.base;
  const current = rowCount.curr;
  const baseLabel = rowCount.base === null ? "N/A" : `${rowCount.base} Rows`;
  const currentLabel = rowCount.curr === null ? "N/A" : `${rowCount.curr} Rows`;

  let tagLabel;
  let colorPalette;
  if (base === null && current === null) {
    tagLabel = "Failed to load";
    colorPalette = "gray";
  } else if (base === null || current === null) {
    tagLabel = `${baseLabel} -> ${currentLabel}`;
    colorPalette = base === null ? "green" : "red";
  } else if (base === current) {
    tagLabel = "=";
    colorPalette = "gray";
  } else if (base !== current) {
    tagLabel = `${deltaPercentageString(base, current)} Rows`;
    colorPalette = base < current ? "green" : "red";
  }

  return (
    <Tag.Root colorPalette={colorPalette}>
      <Flex gap={1} alignItems="center">
        <Icon as={findByRunType("row_count_diff").icon} />
        <Tag.Label>{tagLabel}</Tag.Label>
      </Flex>
    </Tag.Root>
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
    ? "white"
    : getIconForChangeStatus("modified").color;
  const colorUnchanged = inverted ? "gray" : "gray.100";

  return (
    <Flex flex="1">
      {schemaChanged !== undefined && (
        <Tooltip
          content={`Schema (${schemaChanged ? "changed" : "no change"})`}
          openDelay={500}
        >
          <Box height="16px">
            <Icon
              as={findByRunType("schema_diff").icon}
              color={schemaChanged ? colorChanged : colorUnchanged}
            />
          </Box>
        </Tooltip>
      )}
      <Spacer />
      {runs?.row_count_diff && rowCountChanged !== undefined && (
        <Tooltip
          content={`Row count (${rowCountChanged ? "changed" : "="})`}
          openDelay={500}
        >
          <Box>
            <_RowCountDiffTag
              rowCount={runs.row_count_diff.result as RowCountDiff}
            />
          </Box>
        </Tooltip>
      )}
    </Flex>
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
    <Flex
      onClick={onClick}
      alignSelf="center"
      alignItems="center"
      cursor={"pointer"}
    >
      {checked ? (
        <Icon boxSize="20px" as={FaCheckSquare} />
      ) : (
        <Icon boxSize="20px" as={FaRegSquare} />
      )}
    </Flex>
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
      flex="1"
      color={color}
      overflow="hidden"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
    >
      <Tooltip
        content={resourceType === "model" ? name : `${name} (${resourceType})`}
        positioning={{ placement: "top" }}
      >
        <span>{name}</span>
      </Tooltip>
    </Box>
  );
};

export function GraphNode(nodeProps: GraphNodeProps) {
  const { data } = nodeProps;
  const { id, resourceType, changeStatus } = data;

  const showContent = useStore((s) => s.transform[2] > 0.3);

  const { icon: resourceIcon } = getIconForResourceType(resourceType);
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
    icon: iconChangeStatus,
    color: colorChangeStatus,
    backgroundColor: backgroundColorChangeStatus,
  } = changeStatus
    ? getIconForChangeStatus(changeStatus)
    : {
        icon: undefined,
        color: "gray.400",
        backgroundColor: "gray.100",
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
        return isSelected ? colorChangeStatus : "white";
      } else if (selectMode === "action_result") {
        if (!action) {
          return "white";
        } else {
          return isFocused || isSelected || isHovered
            ? backgroundColorChangeStatus
            : colorChangeStatus;
        }
      } else {
        return isFocused || isSelected || isHovered
          ? backgroundColorChangeStatus
          : "white";
      }
    } else {
      return isFocused || isSelected || isHovered
        ? colorChangeStatus
        : backgroundColorChangeStatus;
    }
  })();
  const titleColor = (function () {
    if (selectMode === "selecting") {
      return isSelected ? "white" : "inherit";
    } else if (selectMode === "action_result") {
      return !!action && !isSelected ? "white" : "inherit";
    } else {
      return "inherit";
    }
  })();
  const iconResourceColor = (function () {
    if (selectMode === "selecting") {
      return isSelected ? "white" : "inherit";
    } else if (selectMode === "action_result") {
      return !!action && !isSelected ? "white" : "inherit";
    } else {
      return "inherit";
    }
  })();
  const iconChangeStatusColor = (function () {
    if (selectMode === "selecting") {
      return isSelected ? "white" : colorChangeStatus;
    } else if (selectMode === "action_result") {
      return !!action && !isSelected ? "white" : "inherit";
    } else {
      return colorChangeStatus;
    }
  })();

  return (
    <Flex
      cursor={selectMode === "selecting" ? "pointer" : "inherit"}
      direction="column"
      width="300px"
      transition="box-shadow 0.2s ease-in-out"
      padding={0}
      filter={(function () {
        if (selectMode === "action_result") {
          return action ? "none" : "opacity(0.2) grayscale(50%)";
        } else {
          return isHighlighted || isFocused || isSelected || isHovered
            ? "none"
            : "opacity(0.2) grayscale(50%)";
        }
      })()}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      <Flex
        borderColor={borderColor}
        borderWidth={borderWidth}
        borderTopRadius={8}
        borderBottomRadius={showColumns ? 0 : 8}
        backgroundColor={nodeBackgroundColor}
        height="60px"
      >
        <Flex
          bg={colorChangeStatus}
          padding={interactive ? "8px" : "2px"}
          borderRightWidth={borderWidth}
          borderColor={selectMode === "selecting" ? "#00000020" : borderColor}
          alignItems="top"
          visibility={showContent ? "inherit" : "hidden"}
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
        </Flex>

        <Flex flex="1 0 auto" mx="1" width="100px" direction="column">
          <Flex
            width="100%"
            textAlign="left"
            fontWeight="600"
            flex="1"
            p={1}
            gap="5px"
            alignItems="center"
            visibility={showContent ? "inherit" : "hidden"}
          >
            <GraphNodeTitle
              name={name}
              color={titleColor}
              resourceType={resourceType}
            />

            {isHovered ? (
              <>
                {changeStatus === "modified" && (
                  <Tooltip
                    content="Show Impact Radius"
                    positioning={{ placement: "top" }}
                    openDelay={500}
                  >
                    <Center>
                      <Icon
                        boxSize="14px"
                        as={FaRegDotCircle}
                        color="gray"
                        cursor={"pointer"}
                        _hover={{ color: "black" }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          void showColumnLevelLineage({
                            node_id: id,
                            change_analysis: true,
                            no_upstream: true,
                          });
                        }}
                      />
                    </Center>
                  </Tooltip>
                )}
                <Icon
                  as={VscKebabVertical}
                  color="gray"
                  cursor={"pointer"}
                  _hover={{ color: "black" }}
                  onClick={(e) => {
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
                <Icon
                  boxSize="16px"
                  color={iconResourceColor}
                  as={resourceIcon}
                />
                {changeStatus && (
                  <Icon color={iconChangeStatusColor} as={iconChangeStatus} />
                )}
              </>
            )}
          </Flex>

          <Flex
            flex="1 0 auto"
            mx="1"
            direction="column"
            paddingBottom="1"
            visibility={showContent ? "inherit" : "hidden"}
          >
            <HStack gap={"8px"}>
              {action ? (
                <>
                  <Spacer />
                  <ActionTag
                    node={data as unknown as LineageGraphNode}
                    action={action}
                  />
                </>
              ) : isShowingChangeAnalysis ? (
                <Box
                  height="20px"
                  color="gray"
                  fontSize="9pt"
                  margin={0}
                  fontWeight={600}
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
            </HStack>
          </Flex>
        </Flex>
      </Flex>
      {showColumns && (
        <Box
          p="10px 10px"
          borderColor={borderColor}
          borderWidth={borderWidth}
          borderTopWidth={0}
          borderBottomRadius={8}
        >
          <Box
            height={`${columnSet.size * COLUMN_HEIGHT}px`}
            overflow="auto"
          ></Box>
        </Box>
      )}
      {Object.keys(data.parents).length > 0 && (
        <Handle type="target" position={Position.Left} isConnectable={false} />
      )}
      {Object.keys(data.children).length > 0 && (
        <Handle type="source" position={Position.Right} isConnectable={false} />
      )}
    </Flex>
  );
}
