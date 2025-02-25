import { Box, Flex, Spacer, Tag, TagLabel } from "@chakra-ui/react";
import React, { useState } from "react";

import { Handle, NodeProps, Position, useStore } from "reactflow";
import { LinageGraphColumnNode } from "./lineage";

import "./styles.css";

import { useLineageViewContext } from "./LineageViewContext";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";

interface GrapeColumnNodeProps extends NodeProps<LinageGraphColumnNode> {}

const TransformationType = ({
  transformationType,
}: {
  transformationType: string;
}) => {
  let letter = "U";
  let color = "red";

  if (transformationType === "passthrough") {
    letter = "P";
    color = "gray";
  } else if (transformationType === "renamed") {
    letter = "R";
    color = "orange";
  } else if (transformationType === "derived") {
    letter = "D";
    color = "orange";
  } else {
    letter = "U";
    color = "red";
  }

  // # circle in color
  return (
    <Tag
      fontSize="6pt"
      size="xs"
      colorScheme={color}
      borderRadius="full"
      paddingX="2px"
    >
      <TagLabel>{letter}</TagLabel>
    </Tag>
  );

  //   return <Box color={color}>{letter}</Box>;
};

export function GraphColumnNode({ data }: GrapeColumnNodeProps) {
  const { name: nodeName } = data.node;
  const { column, type, transformationType } = data;
  const showContent = useStore((s) => s.transform[2] > 0.3);

  const { viewOptions } = useLineageViewContext();
  const { lineageGraph } = useLineageGraphContext();

  if (!viewOptions.column_level_lineage) {
    return <>x</>;
  }

  const { node: selectedNode, column: selectedColumn } =
    viewOptions.column_level_lineage;

  const isFocus = column === selectedColumn && nodeName === selectedNode;

  return (
    <Flex
      width="280px"
      height="16px"
      padding="0px 10px"
      border="1px solid lightgray"
      backgroundColor={isFocus ? "#f0f0f0" : "inherit"}
      _hover={{
        backgroundColor: isFocus ? "#f0f0f0" : "#f0f0f0",
      }}
    >
      <Flex
        fontSize="10px"
        color="gray"
        width="100%"
        gap="3px"
        alignItems="center"
      >
        <TransformationType transformationType={transformationType} />
        <Box>{column}</Box>
        <Spacer></Spacer>
        <Box>{type}</Box>
      </Flex>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        style={{
          left: 0,
          visibility: "hidden",
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        style={{
          right: 0,
          visibility: "hidden",
        }}
      />
    </Flex>
  );
}
