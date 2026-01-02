import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import MuiPopover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";
import { FaRegDotCircle } from "react-icons/fa";
import { PiInfo, PiX } from "react-icons/pi";
import { CllInput, ColumnLineageData } from "@/lib/api/cll";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useIsDark } from "@/lib/hooks/useIsDark";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { useLineageViewContextSafe } from "./LineageViewContext";

const _AnalyzeChangeHint = ({ ml }: { ml?: number }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <Box
        component="span"
        sx={{
          fontSize: "10px",
          cursor: "pointer",
          ml: ml,
          display: "inline-flex",
          alignItems: "center",
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
          setAnchorEl(e.currentTarget);
        }}
        onMouseLeave={() => {
          setAnchorEl(null);
        }}
      >
        <PiInfo />
      </Box>
      <MuiPopover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        disableRestoreFocus
        sx={{ pointerEvents: "none" }}
        slotProps={{
          paper: {
            sx: { bgcolor: "black", color: "white", p: 1.5 },
          },
        }}
      >
        <Typography sx={{ fontSize: "0.875rem" }}>
          Breaking changes are determined by analyzing SQL for changes that may
          impact downstream models.{" "}
          <Link
            href="https://docs.datarecce.io/features/breaking-change-analysis/"
            target="_blank"
            sx={{ color: "white", textDecoration: "underline" }}
          >
            Learn more
          </Link>
          .
        </Typography>
      </MuiPopover>
    </>
  );
};

const _CllHint = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <Box
        component="span"
        sx={{
          fontSize: "10px",
          color: "white",
          cursor: "pointer",
          ml: 0.5,
          display: "inline-flex",
          alignItems: "center",
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
          setAnchorEl(e.currentTarget);
        }}
        onMouseLeave={() => {
          setAnchorEl(null);
        }}
      >
        <PiInfo />
      </Box>
      <MuiPopover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        disableRestoreFocus
        sx={{ pointerEvents: "none" }}
        slotProps={{
          paper: {
            sx: { bgcolor: "black", color: "white", p: 1.5 },
          },
        }}
      >
        <Typography sx={{ fontSize: "0.875rem" }}>
          Column-Level Lineage provides visibility into the upstream and
          downstream relationships of a column.{" "}
          <Link
            href="https://docs.datarecce.io/features/column-level-lineage/"
            target="_blank"
            sx={{ color: "white", textDecoration: "underline" }}
          >
            Learn more
          </Link>
          .
        </Typography>
      </MuiPopover>
    </>
  );
};

const ModeMessage = () => {
  const isDark = useIsDark();
  const { lineageGraph } = useLineageGraphContext();
  const { centerNode, viewOptions } = useLineageViewContextSafe();
  const cllInput = viewOptions.column_level_lineage;

  const codeBlockSx = {
    cursor: "pointer",
    fontFamily: "monospace",
    bgcolor: isDark ? "grey.700" : "grey.100",
    px: 0.5,
    borderRadius: 0.5,
  };

  if (!lineageGraph) {
    return <></>;
  }

  if (!cllInput) {
    return "Default View";
  }

  if (cllInput.node_id === undefined) {
    return (
      <Typography component="span">
        Impact Radius for All Changed Models
      </Typography>
    );
  }

  const nodeName =
    cllInput.node_id in lineageGraph.nodes
      ? lineageGraph.nodes[cllInput.node_id].data.name
      : cllInput.node_id;

  if (!cllInput.column) {
    const nodeId = cllInput.node_id;

    return (
      <>
        <Typography component="span" sx={{ mr: "5px" }}>
          Impact Radius for
        </Typography>
        <Box
          component="code"
          onClick={() => {
            centerNode(nodeId);
          }}
          sx={codeBlockSx}
        >
          {nodeName}
        </Box>
      </>
    );
  } else {
    const nodeId = `${cllInput.node_id}_${cllInput.column}`;
    return (
      <>
        <Typography component="span" sx={{ mr: "5px" }}>
          Column Lineage for{" "}
        </Typography>
        <Box
          component="code"
          onClick={() => {
            centerNode(nodeId);
          }}
          sx={codeBlockSx}
        >
          {nodeName}.{cllInput.column}
        </Box>
      </>
    );
  }
};

export const ColumnLevelLineageControl = ({
  action,
}: {
  action: UseMutationResult<ColumnLineageData, Error, CllInput>;
}) => {
  const {
    showColumnLevelLineage,
    resetColumnLevelLineage,
    interactive,
    viewOptions,
  } = useLineageViewContextSafe();
  const { data: flagData } = useRecceServerFlag();
  const singleEnv = flagData?.single_env_onboarding ?? false;
  const { lineageGraph } = useLineageGraphContext();
  const noCatalogCurrent = !lineageGraph?.catalogMetadata.current;

  return (
    <Stack direction="row" spacing="5px">
      {!singleEnv && (
        <Box sx={{ borderRadius: 1, boxShadow: 3 }}>
          <MuiTooltip
            enterDelay={50}
            title={
              noCatalogCurrent
                ? "Please provide catalog.json to enable Impact Radius"
                : ""
            }
            placement="top"
          >
            <span>
              <Button
                size="small"
                variant="outlined"
                color="neutral"
                sx={{
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  bgcolor: "background.paper",
                }}
                disabled={!interactive || noCatalogCurrent}
                startIcon={<FaRegDotCircle />}
                onClick={() => {
                  void showColumnLevelLineage({
                    no_upstream: true,
                    change_analysis: true,
                  });
                }}
              >
                Impact Radius
              </Button>
            </span>
          </MuiTooltip>
        </Box>
      )}
      {viewOptions.column_level_lineage && (
        <Stack
          direction="row"
          alignItems="center"
          sx={{
            borderRadius: 1,
            boxShadow: 3,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            fontSize: "0.8rem",
            p: "0 0.625rem",
          }}
        >
          <ModeMessage />
          {action.isError && (
            <MuiTooltip
              title={`Error: ${action.error.message}`}
              placement="bottom"
            >
              <Typography
                component="span"
                sx={{
                  color: "error.main",
                  ml: "2px",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <Box
                  component={PiInfo}
                  sx={{ color: "error.main", fontSize: "14px" }}
                />
              </Typography>
            </MuiTooltip>
          )}

          {action.isPending ? (
            <CircularProgress size={12} sx={{ ml: "2px" }} />
          ) : (
            <IconButton
              size="small"
              sx={{ ml: "2px" }}
              aria-label="Reset Column Level Lineage"
              onClick={() => {
                void resetColumnLevelLineage();
              }}
            >
              <PiX size="10px" />
            </IconButton>
          )}
        </Stack>
      )}
    </Stack>
  );
};
