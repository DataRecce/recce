import { Box, Flex, HStack, Icon, Spacer, Tooltip } from "@chakra-ui/react";
import React from "react";

import { Handle, NodeProps, Position, useStore } from "reactflow";
import { LineageGraphNode, NodeColumnData } from "./lineage";
import { getIconForChangeStatus, getIconForResourceType } from "./styles";

import "./styles.css";

import { ActionTag } from "./ActionTag";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";

import { MdFormatListNumberedRtl, MdSchema } from "react-icons/md";

interface GraphNodeProps extends NodeProps<LineageGraphNode> {}

function isSchemaChanged(
  baseSchema: { [key: string]: NodeColumnData } | undefined,
  currSchema: { [key: string]: NodeColumnData } | undefined
) {
  if (!baseSchema || !currSchema) {
    return undefined;
  }
  const baseKeys = Object.keys(baseSchema);
  const currKeys = Object.keys(currSchema);

  // added, removed
  if (baseKeys.length !== currKeys.length) {
    return true;
  }

  // reordered
  for (let i = 0; i < baseKeys.length; i++) {
    if (baseKeys[i] !== currKeys[i]) {
      return true;
    }
  }

  // modified
  for (const key of currKeys) {
    if (!baseSchema[key] && baseSchema[key].type !== currSchema[key].type) {
      return true;
    }
  }
  return false;
}

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
              as={MdSchema}
              color={
                schemaChanged
                  ? getIconForChangeStatus("modified").color
                  : getIconForChangeStatus().color
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
              as={MdFormatListNumberedRtl}
              color={
                rowCountChanged
                  ? getIconForChangeStatus("modified").color
                  : getIconForChangeStatus().color
              }
            />
          </Box>
        </Tooltip>
      )}
    </Flex>
  );
};

export function GraphNode({ data }: GraphNodeProps) {
  const { isHighlighted, isSelected, resourceType, changeStatus } = data;
  const showContent = useStore((s) => s.transform[2] > 0.3);

  const { icon: resourceIcon } = getIconForResourceType(resourceType);

  // text color, icon

  let color = "gray.400";
  let iconChangeStatus;
  let borderStyle = "solid";
  if (changeStatus) {
    iconChangeStatus = getIconForChangeStatus(changeStatus).icon;
    color = getIconForChangeStatus(changeStatus).color;
  }

  // border width and color
  const selectedNodeShadowBox = "rgba(3, 102, 214, 0.5) 5px 5px 10px 3px";
  let borderWidth = 1;
  let borderColor = color;
  let backgroundColor = "white";
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
        _hover={{ backgroundColor: showContent ? "gray.100" : color }}
        borderColor={borderColor}
        borderWidth={borderWidth}
        borderStyle={borderStyle}
        backgroundColor={showContent ? backgroundColor : color}
        borderRadius={3}
        boxShadow={boxShadow}
        transition="box-shadow 0.2s ease-in-out"
        padding={0}
        className={highlightClassName}
      >
        <Flex
          backgroundColor={color}
          padding={2}
          borderRightWidth={borderWidth}
          borderColor={borderColor}
          borderStyle={borderStyle}
          alignItems="top"
          visibility={showContent ? "inherit" : "hidden"}
        >
          <Icon as={resourceIcon} />
        </Flex>

        <Flex flex="1 0 auto" mx="1" width="100px" direction="column">
          <Flex
            width="100%"
            textAlign="left"
            flex="1"
            p={1}
            alignItems="center"
            visibility={showContent ? "inherit" : "hidden"}
          >
            <Box
              flex="1"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {name}
            </Box>

            {iconChangeStatus && (
              <Flex>
                <Icon color={color} as={iconChangeStatus} flex="0 0 20px" />
              </Flex>
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
              <Spacer />
              {data.isActionMode ? (
                data.action ? (
                  <ActionTag node={data} action={data.action} />
                ) : (
                  <></>
                )
              ) : data.resourceType === "model" ? (
                <NodeRunsAggregated id={data.id} />
              ) : (
                <></>
              )}
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
