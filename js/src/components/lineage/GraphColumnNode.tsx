import { Box, Flex, Icon, Spacer, Tag, TagLabel } from "@chakra-ui/react";
import React from "react";

import { Handle, NodeProps, Position, useStore } from "reactflow";
import { LinageGraphColumnNode } from "./lineage";

import "./styles.css";

import { useLineageViewContextSafe } from "./LineageViewContext";
import { getIconForChangeStatus } from "./styles";
import { VscKebabVertical } from "react-icons/vsc";

type GrapeColumnNodeProps = NodeProps<LinageGraphColumnNode>;

export const TransformationType = ({
  transformationType,
  legend,
}: {
  transformationType: string;
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

  // # circle in color
  return (
    <>
      {legend ? (
        <Tag fontSize="8pt" size="xs" colorScheme={color} borderRadius="full" paddingX="4px">
          <TagLabel>{letter}</TagLabel>
        </Tag>
      ) : (
        <Tag fontSize="6pt" size="xs" colorScheme={color} borderRadius="full" paddingX="2px">
          <TagLabel>{letter}</TagLabel>
        </Tag>
      )}
    </>
  );
};

export function GraphColumnNode(nodeProps: GrapeColumnNodeProps) {
  const { data } = nodeProps;
  const { id: nodeId } = data.node;
  const { column, type, transformationType, changeStatus } = data;
  const showContent = useStore((s) => s.transform[2] > 0.3);

  const { viewOptions, showContextMenu } = useLineageViewContextSafe();

  const selectedNode = viewOptions.column_level_lineage?.node;
  const selectedColumn = viewOptions.column_level_lineage?.column;
  const isFocus = column === selectedColumn && nodeId === selectedNode;
  const { color: colorChangeStatus, icon: iconChangeStatus } = getIconForChangeStatus(changeStatus);
  const [isHovered, setIsHovered] = React.useState(false);

  if (!showContent) {
    return <></>;
  }

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
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}>
      <Flex fontSize="10px" color="gray" width="100%" gap="3px" alignItems="center">
        {changeStatus && (
          <Icon
            boxSize="12px"
            display="inline-flex"
            color={colorChangeStatus}
            as={iconChangeStatus}
          />
        )}
        {transformationType && <TransformationType transformationType={transformationType} />}
        <Box height="16px">{column}</Box>
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
              showContextMenu(e, nodeProps);
            }}
          />
        ) : (
          <Box height="16px">{type}</Box>
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
