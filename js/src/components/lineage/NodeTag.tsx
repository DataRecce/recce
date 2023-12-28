import { HStack, SkeletonText, Tag, TagLabel, TagLeftIcon, Tooltip, Text, Icon, IconButton, Box, Button } from "@chakra-ui/react";
import { getIconForResourceType } from "./styles";
import { FiAlignLeft, FiFrown, FiTrendingDown, FiTrendingUp } from "react-icons/fi";
import { MdQueryStats, MdOutlineQuestionMark } from "react-icons/md";
import { fetchModelRowCount } from "@/lib/api/models";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { LineageGraphNode } from "./lineage";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";


interface ModelRowCount {
  base: number | null;
  curr: number | null;
}

interface ModelRowCountProps {
  rowCount?: ModelRowCount;
}

export function ModelRowCount({ rowCount }: ModelRowCountProps ) {
  if (!rowCount) {
    return (
      <HStack>
        <Text>Failed to load</Text>
        <Icon as={FiFrown} color="red.500" />
      </HStack>
    )
  }
  const base = rowCount.base === null ? -1 : rowCount.base;
  const current = rowCount.curr === null ? -1 : rowCount.curr;
  const baseLabel = base === -1 ? "N/A" : base;
  const currentLabel = current === -1 ? "N/A" : current;


  if (base === current) {
    return <Text>{base}</Text>;
  } else if (base < current) {
    return (
      <HStack>
        <Text>{baseLabel}</Text>
        <Icon as={FiTrendingUp} color="green.500" />
        <Text>{currentLabel}</Text>
      </HStack>
    );
  } else {
    return (
      <HStack>
        <Text>{baseLabel}</Text>
        <Icon as={FiTrendingDown} color="red.500" />
        <Text>{currentLabel}</Text>
      </HStack>
    );
  }
}

export function ResourceTypeTag({ node }: { node: LineageGraphNode }) {
  const { icon: resourceTypeIcon } = getIconForResourceType(node.resourceType);
  return (
    <Tooltip hasArrow label="Type of resource">
      <Tag>
        <TagLeftIcon as={resourceTypeIcon} />
        <TagLabel>{node.resourceType}</TagLabel>
      </Tag>
    </Tooltip>
  );
}

export interface RowCountTagProps {
  node: LineageGraphNode;
  isAutoFetching?: boolean; // if true, automatically fetches row count on mount
  isInteractive?: boolean; // if true, allows user to manually fetch row count
}

export function RowCountTag(
  {
    node,
    isAutoFetching = false,
    isInteractive = true,
  }: RowCountTagProps) {
  const { isLoading, data: rowCount, refetch: invokeRowCountQuery , isFetched, isFetching } = useQuery({
    queryKey: cacheKeys.rowCount(node.name),
    queryFn:  () => fetchModelRowCount(node.name),
    enabled: node.resourceType === "model" && isAutoFetching,
  });

  function ProcessedRowCountTag(
    { isLoading, rowCount }: {isLoading: boolean, rowCount: ModelRowCount}) {
    return (<TagLabel>
              <SkeletonText isLoaded={!isLoading} noOfLines={1} skeletonHeight={2} minWidth={'30px'}>
                <ModelRowCount rowCount={rowCount} />
              </SkeletonText>
            </TagLabel>);
  }

  function UnprocessedRowCountTag(
    { isInteractive, invokeFunction }: {isInteractive:boolean,invokeFunction: () => void}) {
      if (isInteractive) {
        return (
          <IconButton
            aria-label="Query Row Count"
            icon={<MdQueryStats />}
            size="xs"
            onClick={() => {invokeFunction()}}
            />
        );
      }

      return <Icon
        as={MdOutlineQuestionMark}
        />;
  }

  if (isInteractive === false && isFetched === false && isFetching === false) {
    // Don't show anything if the row count is not fetched and is not interactive.
    return null;
  }


  return (
    <Tooltip
      hasArrow
      label={isFetched || isFetching || !isInteractive ?"Number of row":"Query the number of row"}
      openDelay={500}
      closeDelay={200}
    >
      <Tag>
        <TagLeftIcon as={FiAlignLeft} />
        {isFetched || isFetching ? (
          <ProcessedRowCountTag
            isLoading={isLoading}
            rowCount={rowCount}
          />
        ) : (
          <UnprocessedRowCountTag
            isInteractive={isInteractive}
            invokeFunction={invokeRowCountQuery}
          />
        )}
      </Tag>
    </Tooltip>
  );
}

export async function fetchRowCountsByNodes(nodes: LineageGraphNode[]) {
  nodes.forEach((node) => {
    if (node.resourceType === "model") {
      console.log("Name", node.name);
    }
  });
}

export function FetchRowCountsButton({ nodes }: { nodes: LineageGraphNode[] }) {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [index, setIndex] = useState<number>(0);
  const name = (index < nodes.length) ? nodes[index].name : "";
  const { isLoading, isFetched } = useQuery({
    queryKey: cacheKeys.rowCount(name),
    queryFn:  () => fetchModelRowCount(name),
    enabled: enabled,
  });

  useEffect(() => {
    if (isFetched) {
      if (index + 1 < nodes.length) {
        // TODO: Use BFS to walk though all the changed nodes first.
        setIndex(index + 1);
      } else{
        setEnabled(false);
      }
    }
  }, [isFetched, index, nodes]);

  return (
    <Button
      size="xs"
      variant="outline"
      title= "Query Row Counts"
      onClick={() => {setIndex(0); setEnabled(true);}}
      isDisabled={isLoading}
    >
      <Icon as={MdQueryStats} mr={1} />
      {isLoading ? "Querying" : "Query Row Counts"}
    </Button>
  );
}
