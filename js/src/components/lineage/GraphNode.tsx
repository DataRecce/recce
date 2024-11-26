import { Box, Flex, HStack, Icon, Spacer, Tooltip } from "@chakra-ui/react";
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
import { FaSquareCheck } from "react-icons/fa6";

interface GraphNodeProps extends NodeProps<LineageGraphNode> {}

const NodeRunsAggregated = ({ id }: { id: string }) => {
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

  return (
    <Flex gap="5px">
      {schemaChanged !== undefined && (
        <Tooltip
          label={`Schema (${schemaChanged ? "changed" : "no change"})`}
          openDelay={500}
        >
          <Box height="16px">
            <Icon
              as={findByRunType("schema_diff")?.icon}
              color={
                schemaChanged
                  ? getIconForChangeStatus("modified").color
                  : "lightgray"
              }
            />
          </Box>
        </Tooltip>
      )}
      {rowCountChanged !== undefined && (
        <Tooltip
          label={`Row count (${rowCountChanged ? "changed" : "no change"})`}
          openDelay={500}
        >
          <Box height="16px">
            <Icon
              as={findByRunType("row_count_diff")?.icon}
              color={
                rowCountChanged
                  ? getIconForChangeStatus("modified").color
                  : "lightgray"
              }
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
  const { isHighlighted, isSelected, resourceType, changeStatus } = data;
  const showContent = useStore((s) => s.transform[2] > 0.3);

  const { icon: resourceIcon } = getIconForResourceType(resourceType);
  const [isHovered, setIsHovered] = useState(false);
  const { selectNodeMulti, selectMode } = useLineageViewContext();

  // text color, icon
  let color = "gray.400";
  let backgroundColor = !isSelected
    ? "white"
    : selectMode === "multi"
    ? color
    : "gray.100";
  let iconChangeStatus: any;
  let borderStyle = "solid";
  if (changeStatus) {
    iconChangeStatus = getIconForChangeStatus(changeStatus).icon;
    color = getIconForChangeStatus(changeStatus).color;
    backgroundColor = !isSelected
      ? "white"
      : selectMode === "multi"
      ? color
      : getIconForChangeStatus(changeStatus).backgroundColor;
  }

  // border width and color
  const selectedNodeShadowBox = "rgba(3, 102, 214, 0.5) 5px 5px 10px 3px";
  let borderWidth = 1;
  let borderColor = color;
  let boxShadow = data.isSelected ? selectedNodeShadowBox : "unset";

  const name = data?.name;

  const highlightClassName =
    isHighlighted === true
      ? "node-highlight"
      : isSelected === true
      ? "node-highlight"
      : isHighlighted === false
      ? "node-unhighlight"
      : undefined;

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
        backgroundColor={
          showContent ? backgroundColor : isSelected ? color : backgroundColor
        }
        borderRadius={3}
        // boxShadow={boxShadow}
        transition="box-shadow 0.2s ease-in-out"
        padding={0}
        className={highlightClassName}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Flex
          backgroundColor={color}
          padding={2}
          borderRightWidth={borderWidth}
          borderColor={selectMode == "multi" ? "#00000020" : borderColor}
          borderStyle={borderStyle}
          alignItems="top"
          visibility={showContent ? "inherit" : "hidden"}
        >
          <GraphNodeCheckbox
            checked={isSelected && selectMode === "multi"}
            onClick={(e) => {
              e.stopPropagation();
              selectNodeMulti(data.id);
            }}
          />
        </Flex>

        <Flex
          flex="1 0 auto"
          mx="1"
          width="100px"
          direction="column"
          height="60px"
        >
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
              color={selectMode === "multi" && isSelected ? "white" : "inherit"}
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {name}
            </Box>

            <Icon
              boxSize="16px"
              color={selectMode === "multi" && isSelected ? "white" : "inherit"}
              as={resourceIcon}
            />

            {iconChangeStatus && (
              <Icon
                color={selectMode === "multi" && isSelected ? "white" : color}
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
              {!data.isActionMode && data.resourceType === "model" && (
                <NodeRunsAggregated id={data.id} />
              )}
              <Spacer />
              {data.isActionMode &&
                (data.action ? (
                  <ActionTag node={data} action={data.action} />
                ) : (
                  <></>
                ))}
            </HStack>
          </Flex>
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
