import {
  HStack,
  SkeletonText,
  Tag,
  TagLabel,
  TagLeftIcon,
  Tooltip,
  Text,
  Icon,
  IconButton,
  TagRightIcon,
} from "@chakra-ui/react";
import { getIconForResourceType } from "./styles";
import { FiArrowRight, FiFrown } from "react-icons/fi";
import { queryModelRowCount, RowCount } from "@/lib/api/models";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { LineageGraphNode } from "./lineage";
import { useQuery } from "@tanstack/react-query";
import { RiArrowDownSFill, RiArrowUpSFill, RiSwapLine } from "react-icons/ri";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { deltaPercentageString } from "../rowcount/delta";

import { RepeatIcon } from "@chakra-ui/icons";
import { findByRunType } from "../run/registry";

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

interface ModelRowCountProps {
  rowCount?: RowCount;
}

function _RowCountByRate({ rowCount }: { rowCount: RowCount }) {
  const base = rowCount.base;
  const current = rowCount.curr;
  const baseLabel = rowCount.base === null ? "N/A" : `${rowCount.base} rows`;
  const currentLabel = rowCount.curr === null ? "N/A" : `${rowCount.curr} rows`;

  if (base === null && current === null) {
    return <> Failed to load</>;
  } else if (base === null || current === null) {
    return (
      <HStack>
        <Text>{baseLabel}</Text>
        <Icon as={FiArrowRight} />
        <Text>{currentLabel}</Text>
      </HStack>
    );
  } else if (base === current) {
    return (
      <HStack>
        <Text>{currentLabel}</Text>
        <Icon as={RiSwapLine} color="gray.500" />
        <Text color="gray.500">No Change</Text>
      </HStack>
    );
  } else if (base < current) {
    return (
      <HStack>
        <Text>{currentLabel}</Text>
        <Icon as={RiArrowUpSFill} color="green.500" />
        <Text color="green.500">{deltaPercentageString(base, current)}</Text>
      </HStack>
    );
  } else {
    return (
      <HStack>
        <Text>{currentLabel}</Text>
        <Icon as={RiArrowDownSFill} color="red.500" />
        <Text color="red.500">{deltaPercentageString(base, current)}</Text>
      </HStack>
    );
  }
}

export function ModelRowCount({ rowCount }: ModelRowCountProps) {
  if (!rowCount) {
    return (
      <HStack>
        <Text>Failed to load</Text>
        <Icon as={FiFrown} color="red.500" />
      </HStack>
    );
  }

  const base = rowCount?.base === null ? "N/A" : rowCount?.base;
  const current = rowCount?.curr === null ? "N/A" : rowCount?.curr;
  const label = `${base} -> ${current} rows`;

  return (
    <Tooltip hasArrow label={label}>
      <_RowCountByRate rowCount={rowCount} />
    </Tooltip>
  );
}

export interface RowCountTagProps {
  node: LineageGraphNode;
  rowCount?: RowCount;
  onRefresh?: () => Promise<any>;
  isFetching?: boolean;
  error?: Error | null;
}

export function RowCountTag({
  rowCount: fetchedRowCount,
  node,
  onRefresh,
  isFetching,
}: RowCountTagProps) {
  const { runsAggregated, refetchRunsAggregated } = useLineageGraphContext();
  const lastRowCount: RowCount | undefined =
    runsAggregated?.[node.id]?.["row_count_diff"]?.result;

  const icon = findByRunType("row_count_diff")?.icon;

  let label;
  const rowCount = fetchedRowCount || lastRowCount;
  if (rowCount) {
    const base = rowCount?.base === null ? "N/A" : rowCount?.base;
    const current = rowCount?.curr === null ? "N/A" : rowCount?.curr;
    label = `${base} -> ${current} rows`;
  }

  return (
    <Tooltip label={label}>
      <Tag>
        <TagLeftIcon as={icon} />

        <TagLabel>
          {rowCount || isFetching ? (
            <SkeletonText
              isLoaded={!isFetching}
              noOfLines={1}
              skeletonHeight={2}
              minWidth={"30px"}
            >
              {rowCount ? <_RowCountByRate rowCount={rowCount} /> : "row count"}
            </SkeletonText>
          ) : (
            <>row count</>
          )}
        </TagLabel>
        {onRefresh && (
          <TagRightIcon
            as={IconButton}
            isLoading={isFetching}
            aria-label="Query Row Count"
            icon={<RepeatIcon />}
            size="xs"
            onClick={async () => {
              await onRefresh();
              refetchRunsAggregated?.();
            }}
          />
        )}
      </Tag>
    </Tooltip>
  );
}
