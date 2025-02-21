import {
  Box,
  Divider,
  Flex,
  HStack,
  Icon,
  Spacer,
  Tag,
  TagLabel,
  TagLeftIcon,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import React, { useState } from "react";

import { Handle, NodeProps, Position, useStore } from "reactflow";
import { LineageGraphNode } from "./lineage";
import { getIconForChangeStatus, getIconForResourceType } from "./styles";

import "./styles.css";

import { ActionTag } from "./ActionTag";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";

import { findByRunType } from "../run/registry";
import { isSchemaChanged } from "../schema/schemaDiff";
import { useLineageViewContext } from "./LineageViewContext";
import { FaCheckSquare, FaRegSquare, FaSquare } from "react-icons/fa";
import { RowCountDiff } from "@/lib/api/models";
import { deltaPercentageString } from "../rowcount/delta";

interface GraphNodeProps extends NodeProps<LineageGraphNode> {}

function _RowCountDiffTag({ rowCount }: { rowCount: RowCountDiff }) {
  const base = rowCount.base;
  const current = rowCount.curr;
  const baseLabel = rowCount.base === null ? "N/A" : `${rowCount.base} Rows`;
  const currentLabel = rowCount.curr === null ? "N/A" : `${rowCount.curr} Rows`;

  let tagLabel;
  let colorScheme;
  if (base === null && current === null) {
    tagLabel = "Failed to load";
    colorScheme = "gray";
  } else if (base === null || current === null) {
    tagLabel = `${baseLabel} -> ${currentLabel}`;
    colorScheme = base === null ? "green" : "red";
  } else if (base === current) {
    tagLabel = "=";
    colorScheme = "gray";
  } else if (base !== current) {
    tagLabel = `${deltaPercentageString(base, current)} Rows`;
    colorScheme = base < current ? "green" : "red";
  }

  return (
    <Tag colorScheme={colorScheme}>
      <TagLeftIcon as={findByRunType("row_count_diff")?.icon} />
      <TagLabel>{tagLabel}</TagLabel>
    </Tag>
  );
}

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
  if (node?.data.base && node?.data.current) {
    const baseColumns = node.data.base?.columns;
    const currColumns = node.data.current?.columns;
    schemaChanged = isSchemaChanged(baseColumns, currColumns);
  }

  let rowCountChanged;
  if (runs && runs["row_count_diff"]) {
    const rowCountDiff = runs["row_count_diff"];
    rowCountChanged = rowCountDiff.result.curr !== rowCountDiff.result.base;
  }

  const colorChanged = inverted
    ? "white"
    : getIconForChangeStatus("modified").color;
  const colorUnchanged = inverted ? "gray" : "lightgray";

  return (
    <Flex flex="1">
      {schemaChanged !== undefined && (
        <Tooltip
          label={`Schema (${schemaChanged ? "changed" : "no change"})`}
          openDelay={500}
        >
          <Box height="16px">
            <Icon
              as={findByRunType("schema_diff")?.icon}
              color={schemaChanged ? colorChanged : colorUnchanged}
            />
          </Box>
        </Tooltip>
      )}
      <Spacer />
      {runs && runs["row_count_diff"] && rowCountChanged !== undefined && (
        <Tooltip
          label={`Row count (${rowCountChanged ? "changed" : "="})`}
          openDelay={500}
        >
          <Box>
            <_RowCountDiffTag rowCount={runs["row_count_diff"].result} />
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
    <Flex onClick={onClick} alignSelf="center" alignItems="center">
      {checked ? (
        <Icon boxSize="20px" as={FaCheckSquare} />
      ) : (
        <Icon boxSize="20px" as={FaRegSquare} />
      )}
    </Flex>
  );
};

export function GraphNode({ data }: GraphNodeProps) {
  const { id, isHighlighted, isSelected, resourceType, changeStatus } = data;
  const showContent = useStore((s) => s.transform[2] > 0.3);

  const { icon: resourceIcon } = getIconForResourceType(resourceType);
  const [isHovered, setIsHovered] = useState(false);
  const { interactive, selectNodeMulti, selectMode, advancedImpactRadius } =
    useLineageViewContext();
  const { lineageGraph } = useLineageGraphContext();
  const isNonBreakingChange =
    advancedImpactRadius &&
    changeStatus === "modified" &&
    lineageGraph?.nonBreakingSet.has(id);

  // text color, icon
  const {
    icon: iconChangeStatus,
    color,
    backgroundColor,
  } = changeStatus
    ? getIconForChangeStatus(changeStatus)
    : {
        icon: undefined,
        color: "gray.400",
        backgroundColor: "gray.100",
      };
  let borderStyle = isNonBreakingChange ? "dashed" : "solid";

  // border width and color
  const selectedNodeShadowBox = "rgba(3, 102, 214, 0.5) 5px 5px 10px 3px";
  let borderWidth = "2px";
  let borderColor = color;
  let boxShadow = data.isSelected ? selectedNodeShadowBox : "unset";

  const name = data?.name;

  return (
    <Tooltip
      label={resourceType === "model" ? name : `${name} (${resourceType})`}
      placement="top"
    >
      <Flex
        width="300px"
        borderColor={borderColor}
        borderWidth={borderWidth}
        borderStyle={borderStyle}
        borderRadius={8}
        backgroundColor={(function () {
          if (showContent) {
            if (selectMode === "multi") {
              return isSelected ? color : "white";
            } else if (selectMode === "action_result") {
              if (!data.action) {
                return "white";
              } else {
                return isSelected ? backgroundColor : color;
              }
            } else {
              return isSelected ? backgroundColor : "white";
            }
          } else {
            return isSelected ? color : backgroundColor;
          }
        })()}
        transition="box-shadow 0.2s ease-in-out"
        padding={0}
        filter={(function () {
          if (selectMode === "action_result") {
            return !!data?.action ? "none" : "opacity(0.2) grayscale(50%)";
          } else {
            return isHighlighted || isSelected
              ? "none"
              : "opacity(0.2) grayscale(50%)";
          }
        })()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Flex
          bg={color}
          padding={interactive ? "8px" : "2px"}
          borderRightWidth={borderWidth}
          borderColor={selectMode === "multi" ? "#00000020" : borderColor}
          borderStyle={borderStyle}
          alignItems="top"
          visibility={showContent ? "inherit" : "hidden"}
        >
          {interactive && (
            <GraphNodeCheckbox
              checked={
                (selectMode === "multi" && isSelected) ||
                (selectMode === "action_result" && !!data.action)
              }
              onClick={(e) => {
                if (selectMode === "action_result") {
                  return;
                }
                e.stopPropagation();
                selectNodeMulti(data.id);
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
            <Box
              flex="1"
              color={(function () {
                if (selectMode === "multi") {
                  return isSelected ? "white" : "inherit";
                } else if (selectMode === "action_result") {
                  return !!data.action && !isSelected ? "white" : "inherit";
                } else {
                  return "inherit";
                }
              })()}
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {name}
            </Box>

            <Icon
              boxSize="16px"
              color={(function () {
                if (selectMode === "multi") {
                  return isSelected ? "white" : "inherit";
                } else if (selectMode === "action_result") {
                  return !!data.action && !isSelected ? "white" : "inherit";
                } else {
                  return "inherit";
                }
              })()}
              as={resourceIcon}
            />

            {iconChangeStatus && (
              <Icon
                // color={selectMode === "multi" && isSelected ? "white" : color}
                color={(function () {
                  if (selectMode === "multi") {
                    return isSelected ? "white" : color;
                  } else if (selectMode === "action_result") {
                    return !!data.action && !isSelected ? "white" : "inherit";
                  } else {
                    return color;
                  }
                })()}
                as={iconChangeStatus}
              />
            )}
          </Flex>

          <Flex
            flex="1 0 auto"
            mx="1"
            direction="column"
            paddingBottom="1"
            visibility={showContent ? "inherit" : "hidden"}
          >
            <HStack spacing={"8px"}>
              {selectMode !== "action_result" &&
                data.resourceType === "model" && (
                  <NodeRunsAggregated
                    id={data.id}
                    inverted={(function () {
                      if (selectMode === "multi") {
                        return isSelected ? true : false;
                      } else {
                        return false;
                      }
                    })()}
                  />
                )}
              {data.isActionMode &&
                (data.action ? (
                  <>
                    <Spacer />
                    <ActionTag node={data} action={data.action} />
                  </>
                ) : (
                  <></>
                ))}
            </HStack>
          </Flex>
          {data?.columnSet && (
            <>
              <Divider />
              <Box
                height={`${data?.columnSet.size * 10}px`}
                overflow="auto"
              ></Box>
            </>
          )}
        </Flex>

        {Object.keys(data?.parents ?? {}).length > 0 && (
          <Handle
            type="target"
            position={Position.Left}
            isConnectable={false}
          />
        )}
        {Object.keys(data?.children ?? {}).length > 0 && (
          <Handle
            type="source"
            position={Position.Right}
            isConnectable={false}
          />
        )}
      </Flex>
    </Tooltip>
  );
}
