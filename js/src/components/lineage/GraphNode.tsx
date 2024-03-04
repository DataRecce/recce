import {
  Box,
  Flex,
  HStack,
  Icon,
  Spacer,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import React from "react";

import { Handle, NodeProps, Position, useStore } from "reactflow";
import { LineageGraphNode } from "./lineage";
import { getIconForChangeStatus, getIconForResourceType } from "./styles";

import "./styles.css";
import { RowCountTag } from "./NodeTag";
import { ActionTag } from "./ActionTag";

interface GraphNodeProps extends NodeProps<LineageGraphNode> {}

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

  // if (isHighlighted === true) {
  //   borderWidth = 1;
  //   borderColor = "orange";
  //   boxShadow = "0px 5px 15px #00000040";
  // } else if (isHighlighted === false) {
  //   borderWidth = 1;
  //   borderColor = "red";
  //   boxShadow = "0px 5px 15px #00000040";
  // }

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
              {data.action ? (
                <ActionTag action={data.action} />
              ) : data.resourceType === "model" ? (
                <RowCountTag node={data} isInteractive={false} />
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
