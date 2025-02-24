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
  Tooltip,
} from "@chakra-ui/react";
import React, { useState } from "react";

import { Handle, NodeProps, Position, useStore } from "reactflow";
import { LinageGraphColumnNode, LineageGraphNode } from "./lineage";
import { getIconForChangeStatus, getIconForResourceType } from "./styles";

import "./styles.css";

import { useLineageViewContext } from "./LineageViewContext";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";

interface GrapeColumnNodeProps extends NodeProps<LinageGraphColumnNode> {}

export function GraphColumnNode({ data }: GrapeColumnNodeProps) {
  const { id, isHighlighted, isSelected, resourceType, changeStatus } =
    data.node;
  const column = data.column;
  const showContent = useStore((s) => s.transform[2] > 0.3);

  const { interactive, selectNodeMulti, selectMode, advancedImpactRadius } =
    useLineageViewContext();
  const { lineageGraph } = useLineageGraphContext();

  return (
    <Flex
      width="280px"
      height="16px"
      padding="0px 10px"
      border="1px solid lightgray"
    >
      <Box fontSize="10px" color="gray">
        {column}
      </Box>
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
