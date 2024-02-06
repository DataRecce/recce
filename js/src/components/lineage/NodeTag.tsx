import { HStack, SkeletonText, Tag, TagLabel, TagLeftIcon, Tooltip, Text, Icon, IconButton, Box, Button, StatArrow, VStack, Spacer } from "@chakra-ui/react";
import { getIconForResourceType } from "./styles";
import { FiAlignLeft, FiFrown, FiTrendingDown, FiTrendingUp } from "react-icons/fi";
import { MdQueryStats, MdOutlineQuestionMark } from "react-icons/md";
import { queryModelRowCount, RowCount, useRowCountQueries } from "@/lib/api/models";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { LineageGraphNode } from "./lineage";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRowCountStateContext } from "@/lib/hooks/RecceQueryContext";
import { RiArrowDownSFill, RiArrowUpSFill, RiSwapLine } from "react-icons/ri";


interface ModelRowCountProps {
  rowCount?: RowCount;
}

function RowCountByCompare({ rowCount }: { rowCount: RowCount }) {
  const base = rowCount.base === null ? -1 : rowCount.base;
  const current = rowCount.curr === null ? -1 : rowCount.curr;
  const baseLabel = base === null ? "N/A" : base;
  const currentLabel = current === null ? "N/A" : current;
  if (base === current) {
    return (
      <HStack>
        <Text>{baseLabel} == {currentLabel} rows</Text>
      </HStack>
    );
  }
  else if (base < current) {
    return (
      <HStack>
        <Text>{baseLabel}</Text>
        <Icon as={FiTrendingUp} color="green.500" />
        <Text>{currentLabel} rows</Text>
      </HStack>
    );
  }
  if (current > base) {
    return (
      <HStack>
        <Text>{baseLabel}</Text>
        <Icon as={FiTrendingDown} color="red.500" />
        <Text>{currentLabel} row</Text>
      </HStack>
    );
  }

}

function RowCountWiteRate({ rowCount }: { rowCount: RowCount }) {
  const base = rowCount.base === null ? -1 : rowCount.base;
  const current = rowCount.curr === null ? -1 : rowCount.curr;
  if (base <= 0 || current <= 0) {
    return <RowCountByCompare rowCount={rowCount} />;
  }

  if(base === current) {
    return (
      <HStack>
        <Text>{current} rows</Text>
        <Icon as={RiSwapLine} color="gray.500"/>
        <Text color="gray.500">No Change</Text>
      </HStack>
    );
  } else if (base < current) {
    return (
      <HStack>
        <Text>{current} rows</Text>
        <Icon as={RiArrowUpSFill} color="green.500"/>
        <Text color="green.500">+ {Math.round((current - base) / base * 100)}%</Text>
      </HStack>
    );
  } else {
    return (
      <HStack>
        <Text>{current} rows</Text>
        <Icon as={RiArrowDownSFill} color="red.500"/>
        <Text color="red.500">- {Math.round((base - current) / base * 100)}%</Text>
      </HStack>
    );
  }
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
  return <RowCountWiteRate rowCount={rowCount} />;
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
  const { isNodesFetching } = useRowCountStateContext();
  const { isLoading, data: rowCount, refetch: invokeRowCountQuery , isFetched, isFetching } = useQuery({
    queryKey: cacheKeys.rowCount(node.name),
    queryFn:  () => queryModelRowCount(node.name),
    enabled: node.resourceType === "model" && isAutoFetching,
  });
  const isTagFetching = isFetching || (isNodesFetching.includes(node.name));
  const isTagLoading = isLoading || (isNodesFetching.includes(node.name));

  function ProcessedRowCountTag(
    { isLoading, rowCount }: {isLoading: boolean, rowCount?: RowCount}) {
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

  if (isInteractive === false && isFetched === false && isTagFetching === false) {
    // Don't show anything if the row count is not fetched and is not interactive.
    return null;
  }

  let label = "Query the number of row";
  if (isTagFetching) {
    label = "Querying the number of row";
  } else if (isFetched) {
    const base = rowCount?.base === null ? 'N/A' : rowCount?.base;
    const current = rowCount?.curr === null ? 'N/A' : rowCount?.curr;
    label = `${base} -> ${current} rows`;
  }

  return (
    <Tooltip
      hasArrow
      label={label}
      openDelay={500}
      closeDelay={200}
    >
      <Tag>
        <TagLeftIcon as={FiAlignLeft} />
        {isFetched || isTagFetching ? (
          <ProcessedRowCountTag
            isLoading={isTagLoading}
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

export function FetchRowCountsButton({
    nodes,
    onFinish,
  }: {
    nodes: LineageGraphNode[],
    onFinish?: () => void }) {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [index, setIndex] = useState<number>(0);
  const name = (index < nodes.length) ? nodes[index].name : "";
  const { isLoading, isFetched } = useQuery({
    queryKey: cacheKeys.rowCount(name),
    queryFn:  () => queryModelRowCount(name),
    enabled: enabled,
  });

  useEffect(() => {
    if (isFetched) {
      if (index + 1 < nodes.length) {
        // TODO: Use BFS to walk though all the changed nodes first.
        setIndex(index + 1);
      } else if (enabled === true) {
        setEnabled(false);
        onFinish && onFinish();
      }
    }
  }, [isFetched, index, nodes, onFinish, enabled]);

  return (
    <Button
      size="xs"
      variant="outline"
      title= "Query Row Counts"
      onClick={() => {
        setIndex(0);
        setEnabled(true);
      }}
      isDisabled={isLoading || nodes.length === 0}
    >
      <Icon as={MdQueryStats} mr={1} />
      {isLoading ? "Querying" : "Query Row Counts"}
    </Button>
  );
}

export function FetchSelectedNodesRowCountButton({
    nodes,
    onFinish,
  }: {
    nodes: LineageGraphNode[],
    onFinish?: () => void }) {
  const { isLoading, fetchFn } = useRowCountQueries(nodes.map((node) => node.name));
  return (
    <Button
      isLoading={isLoading}
      loadingText="Querying"
      size="xs"
      variant="outline"
      title= "Query Row Counts"
      onClick={async () => {
        await fetchFn();
        onFinish && onFinish();
      }}
      isDisabled={nodes.length === 0}
    >
      <Icon as={MdQueryStats} mr={1} />
      Query Row Counts
    </Button>
  );
}
