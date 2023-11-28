import { Box, Flex, Icon, Text, Tooltip } from "@chakra-ui/react";
import React from "react";

import { Handle, NodeProps, Position, useStore } from "reactflow";
import { LineageGraphNode } from "./lineage";
import { getIconForChangeStatus, getIconForResourceType } from "./styles";

import "./styles.css";

interface GraphNodeProps extends NodeProps<LineageGraphNode> {}

export function GraphNode({ data }: GraphNodeProps) {
  const { isHighlighted, resourceType, changeStatus } = data;
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
  let borderWidth = 1;
  let borderColor = color;
  let backgroundColor = "white";
  let boxShadow = "unset";

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
        padding={0}
        className={
          isHighlighted === true
            ? "node-highlight"
            : isHighlighted === false
            ? "node-unhighlight"
            : undefined
        }
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
