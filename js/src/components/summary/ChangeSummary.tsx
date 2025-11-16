import { Box, Flex, Grid, Icon, Text, VStack } from "@chakra-ui/react";
import { ReactNode } from "react";
import { IconType } from "react-icons";
import { FiInfo } from "react-icons/fi";
import { Tooltip } from "@/components/ui/tooltip";
import { NodeData } from "@/lib/api/info";
import { LineageGraph } from "../lineage/lineage";
import {
  IconAdded,
  IconChanged,
  IconModified,
  IconRemoved,
} from "../lineage/styles";

export type ChangeStatus =
  // node change
  // code change (user edit)
  | "added"
  | "removed"
  | "modified"

  // column change
  | "col_added"
  | "col_removed"
  | "col_changed"

  // folder change
  | "folder_changed"
  | null;

export const NODE_CHANGE_STATUS_MSGS = {
  added: ["Model Added", "Added resource"],
  removed: ["Model Removed", "Removed resource"],
  modified: ["Model Modified", "Modified resource"],
  col_added: ["Column Added", "Added column"],
  col_removed: ["Column Removed", "Removed column"],
  col_changed: ["Column Modified", "Modified column"],
  folder_changed: ["Modified", "Modified folder"],
};

export function getIconForChangeStatus(changeStatus?: ChangeStatus): {
  color: string;
  icon: IconType | undefined; //IconType not provided
} {
  if (changeStatus === "added") {
    return { color: "#1dce00", icon: IconAdded };
  } else if (changeStatus === "removed") {
    return { color: "#ff067e", icon: IconRemoved };
  } else if (changeStatus === "modified") {
    return { color: "#ffa502", icon: IconModified };
  } else if (changeStatus === "col_added") {
    return { color: "#1dce00", icon: IconAdded };
  } else if (changeStatus === "col_removed") {
    return { color: "#ff067e", icon: IconRemoved };
  } else if (changeStatus === "col_changed") {
    return { color: "#ffa502", icon: IconModified };
  } else if (changeStatus === "folder_changed") {
    return { color: "#ffa502", icon: IconChanged };
  }

  return { color: "inherit", icon: undefined };
}

function SummaryText({
  name,
  value,
  tip,
}: {
  name: ReactNode;
  value: ReactNode;
  tip?: ReactNode;
}) {
  return (
    <VStack alignItems="stretch">
      <Text fontSize="sm" color="gray">
        {name}
        {tip && (
          <Tooltip content={tip}>
            <Box display="inline-block">
              <Icon mx={"2px"} as={FiInfo} boxSize={3} />
            </Box>
          </Tooltip>
        )}
      </Text>
      {value}
    </VStack>
  );
}

function ChangeStatusCountLabel({
  changeStatus,
  value,
}: {
  changeStatus: ChangeStatus;
  value: number;
}) {
  const [label] = changeStatus ? NODE_CHANGE_STATUS_MSGS[changeStatus] : [""];
  const { icon, color } = getIconForChangeStatus(changeStatus);

  return (
    <VStack alignItems="stretch">
      <Flex alignItems="center" fontSize="sm" color="gray">
        {icon && <Icon mr="5px" as={icon} color={color} />}
        {label}
      </Flex>
      <Text fontSize="sm">{value}</Text>
    </VStack>
  );
}

function calculateColumnChange(
  base: NodeData | undefined,
  current: NodeData | undefined,
) {
  let adds = 0;
  let removes = 0;
  let modifies = 0;
  if (!base && !current) return { adds, removes, modifies };

  // Add columns
  if (current) {
    Object.keys(current.columns ?? {}).forEach((col) => {
      if (!base?.columns?.[col]) adds++;
    });
  }

  // Remove columns
  if (base) {
    Object.keys(base.columns ?? {}).forEach((col) => {
      if (!current?.columns?.[col]) removes++;
    });
  }

  // Modify columns
  if (current && base) {
    Object.keys(current.columns ?? {}).forEach((col) => {
      if (base.columns && current.columns?.[col] && base.columns[col]) {
        if (base.columns[col].type !== current.columns[col].type) modifies++;
      }
    });
  }

  return { adds, removes, modifies };
}

function calculateChangeSummary(lineageGraph: LineageGraph) {
  const modifiedSet = lineageGraph.modifiedSet;
  let adds = 0;
  let removes = 0;
  let modifies = 0;
  let col_added = 0;
  let col_removed = 0;
  let col_changed = 0;

  modifiedSet.forEach((nodeId) => {
    if (lineageGraph.nodes[nodeId].data.changeStatus === "added") adds++;
    else if (lineageGraph.nodes[nodeId].data.changeStatus === "removed")
      removes++;
    else if (lineageGraph.nodes[nodeId].data.changeStatus === "modified")
      modifies++;

    const base = lineageGraph.nodes[nodeId].data.data.base;
    const current = lineageGraph.nodes[nodeId].data.data.current;
    const columnChange = calculateColumnChange(base, current);
    col_added += columnChange.adds;
    col_removed += columnChange.removes;
    col_changed += columnChange.modifies;
  });

  return { adds, removes, modifies, col_added, col_removed, col_changed };
}

export interface Props {
  lineageGraph: LineageGraph;
}

export function ChangeSummary({ lineageGraph }: Props) {
  const { adds, removes, modifies, col_added, col_removed, col_changed } =
    calculateChangeSummary(lineageGraph);

  return (
    <Grid
      templateColumns="1fr 1fr"
      mb="10px"
      borderTop="1px solid lightgray"
      padding={"2.5vw"}
    >
      <Box borderColor="lightgray">
        <SummaryText
          name="Code Changes"
          value={
            <>
              <Grid templateColumns="1fr 1fr 1fr" width="100%">
                <ChangeStatusCountLabel changeStatus="added" value={adds} />
                <ChangeStatusCountLabel
                  changeStatus="removed"
                  value={removes}
                />
                <ChangeStatusCountLabel
                  changeStatus="modified"
                  value={modifies}
                />
              </Grid>
            </>
          }
        />
      </Box>
      <Box borderLeft="1px" paddingLeft="12px" borderColor="lightgray">
        <SummaryText
          name="Column Changes"
          value={
            <>
              <Grid templateColumns="1fr 1fr 1fr" width="100%">
                <ChangeStatusCountLabel
                  changeStatus="col_added"
                  value={col_added}
                />
                <ChangeStatusCountLabel
                  changeStatus="col_removed"
                  value={col_removed}
                />
                <ChangeStatusCountLabel
                  changeStatus="col_changed"
                  value={col_changed}
                />
              </Grid>
            </>
          }
        />
      </Box>
    </Grid>
  );
}
