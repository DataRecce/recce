import { Box, Flex, Icon, Spacer, Tag } from "@chakra-ui/react";
import { Handle, NodeProps, Position, useStore } from "@xyflow/react";
import React from "react";
import { COLUMN_HEIGHT, LineageGraphColumnNode } from "./lineage";

import "./styles.css";

import { VscKebabVertical } from "react-icons/vsc";
import { useLineageViewContextSafe } from "./LineageViewContext";
import { getIconForChangeStatus } from "./styles";

type GrapeColumnNodeProps = NodeProps<LineageGraphColumnNode>;

export const ChangeStatus = ({
  changeStatus,
}: {
  changeStatus?: "added" | "removed" | "modified";
}) => {
  if (!changeStatus) {
    return <></>;
  }

  const { color: colorChangeStatus, icon: iconChangeStatus } =
    getIconForChangeStatus(changeStatus);

  return (
    <Icon
      boxSize="14px"
      display="inline-flex"
      color={colorChangeStatus}
      as={iconChangeStatus}
    />
  );
};

export const TransformationType = ({
  transformationType,
  legend,
}: {
  transformationType?: string;
  legend?: boolean;
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
  } else if (transformationType === "source") {
    letter = "S";
    color = "blue";
  } else {
    letter = "U";
    color = "red";
  }

  if (!transformationType) {
    return <></>;
  }

  // # circle in color
  return (
    <>
      {legend ? (
        <Tag.Root
          fontSize="8pt"
          size="sm"
          colorPalette={color}
          borderRadius="full"
          paddingX="4px"
        >
          <Tag.Label>{letter}</Tag.Label>
        </Tag.Root>
      ) : (
        <Tag.Root
          fontSize="8pt"
          size="sm"
          colorPalette={color}
          borderRadius="full"
          paddingX="4px"
        >
          <Tag.Label>{letter}</Tag.Label>
        </Tag.Root>
      )}
    </>
  );
};

export function GraphColumnNode(nodeProps: GrapeColumnNodeProps) {
  const { id: columnNodeId, data } = nodeProps;
  const { id: nodeId } = data.node;
  const { column, type, transformationType, changeStatus } = data;
  const showContent = useStore((s) => s.transform[2] > 0.3);

  const {
    viewOptions,
    showContextMenu,
    isNodeHighlighted,
    isNodeShowingChangeAnalysis,
  } = useLineageViewContextSafe();

  const selectedNode = viewOptions.column_level_lineage?.node_id;
  const selectedColumn = viewOptions.column_level_lineage?.column;
  const isFocus = column === selectedColumn && nodeId === selectedNode;
  const [isHovered, setIsHovered] = React.useState(false);
  const isHighlighted = isNodeHighlighted(columnNodeId);
  const isShowingChangeAnalysis = isNodeShowingChangeAnalysis(nodeId);

  if (!showContent) {
    return <></>;
  }

  return (
    <Flex
      width="280px"
      padding="0px 10px"
      border="1px solid gray"
      backgroundColor={isFocus ? "#f0f0f0" : "inherit"}
      _hover={{
        backgroundColor: isFocus ? "#f0f0f0" : "#f0f0f0",
      }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      filter={isHighlighted ? "none" : "opacity(0.2) grayscale(50%)"}
      cursor="pointer"
    >
      <Flex
        fontSize="11px"
        color="black"
        width="100%"
        gap="3px"
        alignItems="center"
        height={`${COLUMN_HEIGHT - 1}px`}
      >
        {isShowingChangeAnalysis && changeStatus ? (
          <ChangeStatus changeStatus={changeStatus} />
        ) : (
          <TransformationType transformationType={transformationType} />
        )}
        <Box height={`${COLUMN_HEIGHT + 1}px`}>{column}</Box>
        <Spacer></Spacer>

        {isHovered ? (
          <Icon
            as={VscKebabVertical}
            boxSize="14px"
            display={"inline-flex"}
            cursor={"pointer"}
            _hover={{ color: "black" }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              showContextMenu(
                e,
                nodeProps as unknown as LineageGraphColumnNode,
              );
            }}
          />
        ) : (
          <Box height={`${COLUMN_HEIGHT + 1} px`}>{type}</Box>
        )}
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
