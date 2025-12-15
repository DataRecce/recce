import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { Handle, NodeProps, Position, useStore } from "@xyflow/react";
import React from "react";
import { VscKebabVertical } from "react-icons/vsc";
import { useLineageViewContextSafe } from "./LineageViewContext";
import { COLUMN_HEIGHT, LineageGraphColumnNode } from "./lineage";
import { getIconForChangeStatus } from "./styles";

import "./styles.css";

type GrapeColumnNodeProps = NodeProps<LineageGraphColumnNode>;

export const ChangeStatus = ({
  changeStatus,
}: {
  changeStatus?: "added" | "removed" | "modified";
}) => {
  if (!changeStatus) {
    return <></>;
  }

  const { color: colorChangeStatus, icon: IconChangeStatus } =
    getIconForChangeStatus(changeStatus);

  if (!IconChangeStatus) {
    return <></>;
  }

  return (
    <Box
      component={IconChangeStatus}
      sx={{
        fontSize: 14,
        display: "inline-flex",
        color: colorChangeStatus,
      }}
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
  let color: "default" | "error" | "warning" | "info" | "success" = "error";

  if (transformationType === "passthrough") {
    letter = "P";
    color = "default";
  } else if (transformationType === "renamed") {
    letter = "R";
    color = "warning";
  } else if (transformationType === "derived") {
    letter = "D";
    color = "warning";
  } else if (transformationType === "source") {
    letter = "S";
    color = "info";
  } else {
    letter = "U";
    color = "error";
  }

  if (!transformationType) {
    return <></>;
  }

  return (
    <Chip
      label={letter}
      size="small"
      color={color}
      sx={{
        fontSize: "8pt",
        height: 18,
        minWidth: 18,
        "& .MuiChip-label": {
          px: 0.5,
        },
      }}
    />
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
    <Box
      sx={{
        display: "flex",
        width: 280,
        padding: "0px 10px",
        border: "1px solid gray",
        backgroundColor: isFocus ? "#f0f0f0" : "inherit",
        "&:hover": {
          backgroundColor: "#f0f0f0",
        },
        filter: isHighlighted ? "none" : "opacity(0.2) grayscale(50%)",
        cursor: "pointer",
      }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      <Box
        sx={{
          display: "flex",
          fontSize: "11px",
          color: "black",
          width: "100%",
          gap: "3px",
          alignItems: "center",
          height: `${COLUMN_HEIGHT - 1}px`,
        }}
      >
        {isShowingChangeAnalysis && changeStatus ? (
          <ChangeStatus changeStatus={changeStatus} />
        ) : (
          <TransformationType transformationType={transformationType} />
        )}
        <Box sx={{ height: `${COLUMN_HEIGHT + 1}px` }}>{column}</Box>
        <Box sx={{ flexGrow: 1 }} />

        {isHovered ? (
          <Box
            component={VscKebabVertical}
            sx={{
              fontSize: 14,
              display: "inline-flex",
              cursor: "pointer",
              "&:hover": { color: "black" },
            }}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              showContextMenu(
                e,
                nodeProps as unknown as LineageGraphColumnNode,
              );
            }}
          />
        ) : (
          <Box sx={{ height: `${COLUMN_HEIGHT + 1} px` }}>{type}</Box>
        )}
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
    </Box>
  );
}
