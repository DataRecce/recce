import { useRecceInstanceContext } from "@datarecce/ui/contexts";
import { useIsDark } from "@datarecce/ui/hooks";
import { deltaPercentageString } from "@datarecce/ui/utils";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { FiArrowRight, FiFrown } from "react-icons/fi";
import { PiRepeat } from "react-icons/pi";
import { RiArrowDownSFill, RiArrowUpSFill, RiSwapLine } from "react-icons/ri";
import SetupConnectionPopover from "@/components/app/SetupConnectionPopover";
import { RowCount, RowCountDiff } from "@/lib/api/models";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphAdapter";
import { findByRunType } from "../run/registry";
import { LineageGraphNode } from "./lineage";
import { getIconForResourceType } from "./styles";

// Reusable tag styles - accepts isDark parameter
const getTagRootSx = (isDark: boolean) => ({
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 16,
  px: 1,
  py: 0.25,
  fontSize: "0.75rem",
  bgcolor: isDark ? "grey.700" : "grey.100",
  color: isDark ? "grey.100" : "inherit",
});

const tagStartElementSx = {
  mr: 0.5,
  display: "flex",
  alignItems: "center",
};

export function ResourceTypeTag({ node }: { node: LineageGraphNode }) {
  const isDark = useIsDark();
  const { icon: ResourceTypeIcon } = getIconForResourceType(
    node.data.resourceType,
  );
  return (
    <MuiTooltip arrow title="Type of resource">
      <Box component="span" sx={getTagRootSx(isDark)}>
        {ResourceTypeIcon && (
          <Box component="span" sx={tagStartElementSx}>
            <ResourceTypeIcon />
          </Box>
        )}
        {node.data.resourceType}
      </Box>
    </MuiTooltip>
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
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2" component="span">
          {baseLabel}
        </Typography>
        <FiArrowRight />
        <Typography variant="body2" component="span">
          {currentLabel}
        </Typography>
      </Stack>
    );
  } else if (base === current) {
    return (
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2" component="span">
          {currentLabel}
        </Typography>
        <Box component="span" sx={{ color: "grey.500", display: "flex" }}>
          <RiSwapLine />
        </Box>
        <Typography variant="body2" component="span" sx={{ color: "grey.500" }}>
          No Change
        </Typography>
      </Stack>
    );
  } else if (base < current) {
    return (
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2" component="span">
          {currentLabel}
        </Typography>
        <Box component="span" sx={{ color: "success.main", display: "flex" }}>
          <RiArrowUpSFill />
        </Box>
        <Typography
          variant="body2"
          component="span"
          sx={{ color: "success.main" }}
        >
          {deltaPercentageString(base, current)}
        </Typography>
      </Stack>
    );
  } else {
    return (
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2" component="span">
          {currentLabel}
        </Typography>
        <Box component="span" sx={{ color: "error.main", display: "flex" }}>
          <RiArrowDownSFill />
        </Box>
        <Typography
          variant="body2"
          component="span"
          sx={{ color: "error.main" }}
        >
          {deltaPercentageString(base, current)}
        </Typography>
      </Stack>
    );
  }
}

export function ModelRowCount({ rowCount }: ModelRowCountProps) {
  if (!rowCount) {
    return (
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2" component="span">
          Failed to load
        </Typography>
        <Box component="span" sx={{ color: "error.main", display: "flex" }}>
          <FiFrown />
        </Box>
      </Stack>
    );
  }

  const base = rowCount.base ?? "N/A";
  const current = rowCount.curr ?? "N/A";
  const label = `${base} -> ${current} rows`;

  return (
    <MuiTooltip arrow title={label}>
      <_RowCountByRate rowCount={rowCount} />
    </MuiTooltip>
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
  const isDark = useIsDark();
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
    <MuiTooltip title={label}>
      <SetupConnectionPopover display={featureToggles.mode === "metadata only"}>
        <Box
          component="span"
          sx={{
            ...getTagRootSx(isDark),
            gap: 0.5,
          }}
        >
          <RunTypeIcon />
          {rowsToShow != null || isFetching ? (
            isFetching ? (
              <Skeleton width={30} height={16} />
            ) : rowsToShow != null ? (
              <_RowCountByRate rowCount={rowsToShow} />
            ) : (
              <Typography variant="caption">row count</Typography>
            )
          ) : (
            <Typography variant="caption">row count</Typography>
          )}
          {onRefresh && (
            <IconButton
              aria-label="Query Row Count"
              size="small"
              onClick={onRefresh}
              disabled={featureToggles.disableDatabaseQuery}
              sx={{ p: 0, ml: 0.5 }}
            >
              <PiRepeat size={12} />
            </IconButton>
          )}
        </Box>
      </SetupConnectionPopover>
    </MuiTooltip>
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
  const isDark = useIsDark();
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
    <Box component="span" sx={getTagRootSx(isDark)}>
      <Box component="span" sx={tagStartElementSx}>
        <RunTypeIcon />
      </Box>
      {rowCount || isFetching ? (
        isFetching ? (
          <Skeleton width={30} height={16} />
        ) : (
          <Typography variant="caption">{label}</Typography>
        )
      ) : (
        <Typography variant="caption">row count</Typography>
      )}
      {onRefresh && (
        <IconButton
          aria-label="Query Row Count"
          size="small"
          onClick={onRefresh}
          disabled={node.data.from === "base"}
          sx={{ p: 0, ml: 0.5 }}
        >
          <PiRepeat size={12} />
        </IconButton>
      )}
    </Box>
  );
}
