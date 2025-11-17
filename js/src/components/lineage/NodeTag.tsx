import {
  Flex,
  HStack,
  Icon,
  IconButton,
  SkeletonText,
  Tag,
  Text,
} from "@chakra-ui/react";
import { FiArrowRight, FiFrown } from "react-icons/fi";
import { PiRepeat } from "react-icons/pi";
import { RiArrowDownSFill, RiArrowUpSFill, RiSwapLine } from "react-icons/ri";
import SetupConnectionPopover from "@/components/app/SetupConnectionPopover";
import { Tooltip } from "@/components/ui/tooltip";
import { RowCount, RowCountDiff } from "@/lib/api/models";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { deltaPercentageString } from "../rowcount/delta";
import { findByRunType } from "../run/registry";
import { LineageGraphNode } from "./lineage";
import { getIconForResourceType } from "./styles";

export function ResourceTypeTag({ node }: { node: LineageGraphNode }) {
  const { icon: ResourceTypeIcon } = getIconForResourceType(
    node.data.resourceType,
  );
  return (
    <Tooltip showArrow content="Type of resource">
      <Tag.Root>
        {ResourceTypeIcon && (
          <Tag.StartElement>
            <ResourceTypeIcon />
          </Tag.StartElement>
        )}
        <Tag.Label>{node.data.resourceType}</Tag.Label>
      </Tag.Root>
    </Tooltip>
  );
}

interface ModelRowCountProps {
  rowCount?: RowCountDiff;
}

function _RowCountByRate({ rowCount }: { rowCount: RowCountDiff }) {
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

  const base = rowCount.base ?? "N/A";
  const current = rowCount.curr ?? "N/A";
  const label = `${base} -> ${current} rows`;

  return (
    <Tooltip showArrow content={label}>
      <_RowCountByRate rowCount={rowCount} />
    </Tooltip>
  );
}

export interface RowCountDiffTagProps {
  node: LineageGraphNode;
  rowCount?: RowCountDiff;
  onRefresh?: () => void;
  isFetching?: boolean;
  error?: Error | null;
}

export function RowCountDiffTag({
  rowCount: fetchedRowCount,
  node,
  onRefresh,
  isFetching,
}: RowCountDiffTagProps) {
  const { featureToggles } = useRecceInstanceContext();
  const { runsAggregated } = useLineageGraphContext();
  const lastRowCount: RowCountDiff | undefined = runsAggregated?.[node.id]
    ?.row_count_diff.result as RowCountDiff | undefined;
  const RunTypeIcon = findByRunType("row_count_diff").icon;

  // Calculate during render instead of effect
  const rowCount = fetchedRowCount ?? lastRowCount;
  const rowsToShow = rowCount;
  const label = rowCount
    ? `${rowCount.base ?? "N/A"} -> ${rowCount.curr ?? "N/A"} rows`
    : "";

  // TODO isFetching is not hooked up, so disabling it on the skeleton for now
  return (
    <Tooltip content={label}>
      <SetupConnectionPopover display={featureToggles.mode === "metadata only"}>
        <Tag.Root asChild>
          <Flex direction="row" alignItems="center" gap="1">
            <RunTypeIcon />
            {rowsToShow != null || isFetching ? (
              <SkeletonText
                loading={false}
                noOfLines={1}
                minWidth={"30px"}
                fontSize="xs"
              >
                {rowsToShow != null ? (
                  <_RowCountByRate rowCount={rowsToShow} />
                ) : (
                  "row count"
                )}
              </SkeletonText>
            ) : (
              <Text fontSize="xs">row count</Text>
            )}
            {onRefresh && (
              <IconButton
                loading={isFetching}
                aria-label="Query Row Count"
                size="2xs"
                p="0"
                variant="ghost"
                onClick={onRefresh}
                disabled={featureToggles.disableDatabaseQuery}
              >
                <PiRepeat />
              </IconButton>
            )}
          </Flex>
        </Tag.Root>
      </SetupConnectionPopover>
    </Tooltip>
  );
}

export interface RowCountTagProps {
  node: LineageGraphNode;
  rowCount?: RowCount;
  onRefresh?: () => void;
  isFetching?: boolean;
  error?: Error | null;
}

export function RowCountTag({
  rowCount: fetchedRowCount,
  node,
  onRefresh,
  isFetching,
}: RowCountTagProps) {
  const { runsAggregated } = useLineageGraphContext();
  const lastRowCount: RowCountDiff | undefined = runsAggregated?.[node.id]
    ?.row_count.result as RowCountDiff | undefined;

  const RunTypeIcon = findByRunType("row_count").icon;

  let label;
  const rowCount = fetchedRowCount ?? lastRowCount;
  if (rowCount) {
    const rows = rowCount.curr ?? "N/A";
    label = `${rows} rows`;
  }

  return (
    <Tag.Root>
      <Tag.StartElement>
        <RunTypeIcon />
      </Tag.StartElement>
      <Tag.Label>
        {rowCount || isFetching ? (
          <SkeletonText
            loading={isFetching}
            lineClamp={1}
            height={2}
            minWidth={"30px"}
          >
            {rowCount ? `${label}` : "row count"}
          </SkeletonText>
        ) : (
          <>row count</>
        )}
      </Tag.Label>
      {onRefresh && (
        <IconButton
          loading={isFetching}
          aria-label="Query Row Count"
          size="2xs"
          p="0"
          variant="ghost"
          onClick={onRefresh}
          disabled={node.data.from === "base"}
        >
          <PiRepeat />
        </IconButton>
      )}
    </Tag.Root>
  );
}
