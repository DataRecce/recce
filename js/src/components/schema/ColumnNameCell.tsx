import { useRecceInstanceContext } from "@datarecce/ui/contexts";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { MouseEvent, useState } from "react";
import { VscKebabVertical } from "react-icons/vsc";
import { NodeData } from "@/lib/api/info";
import {
  EXPLORE_ACTION,
  EXPLORE_SOURCE,
  trackExploreAction,
} from "@/lib/api/track";
import { SchemaDiffRow } from "@/lib/dataGrid/generators/toSchemaDataGrid";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { supportsHistogramDiff } from "../histogram/HistogramDiffForm";
import { useLineageViewContext } from "../lineage/LineageViewContext";

export function ColumnNameCell({
  model,
  row,
  singleEnv,
  cllRunning,
  showMenu = true,
}: {
  model: NodeData;
  row: SchemaDiffRow;
  singleEnv?: boolean;
  cllRunning?: boolean;
  showMenu?: boolean;
}) {
  const lineageViewContext = useLineageViewContext();
  const { runAction } = useRecceActionContext();
  const { featureToggles } = useRecceInstanceContext();
  const { name, baseType, currentType, baseIndex, currentIndex } = row;
  const columnType = currentType ?? baseType;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileDiff = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.PROFILE_DIFF,
      source: EXPLORE_SOURCE.SCHEMA_COLUMN_MENU,
      node_count: 1,
    });
    runAction(
      "profile_diff",
      { model: model.name, columns: [name] },
      { showForm: false },
    );
  };

  const handleHistogramDiff = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.HISTOGRAM_DIFF,
      source: EXPLORE_SOURCE.SCHEMA_COLUMN_MENU,
      node_count: 1,
    });
    runAction(
      "histogram_diff",
      { model: model.name, column_name: name, column_type: columnType },
      { showForm: false },
    );
  };

  const handleTopkDiff = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.TOP_K_DIFF,
      source: EXPLORE_SOURCE.SCHEMA_COLUMN_MENU,
      node_count: 1,
    });
    runAction(
      "top_k_diff",
      { model: model.name, column_name: name, k: 50 },
      { showForm: false },
    );
  };

  const handleValueDiff = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.VALUE_DIFF,
      source: EXPLORE_SOURCE.SCHEMA_COLUMN_MENU,
      node_count: 1,
    });
    runAction(
      "value_diff",
      { model: model.name, columns: [name] },
      { showForm: true },
    );
  };

  const addedOrRemoved = !baseType || !currentType;
  const isCllDisabled =
    lineageViewContext === undefined ||
    (baseIndex !== undefined && currentIndex === undefined);

  return (
    <Tooltip
      title="View column lineage"
      placement="top"
      disableHoverListener={isCllDisabled}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: "3px" }}>
        <Box
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </Box>
        <Box sx={{ flex: 1 }} />
        {cllRunning && <CircularProgress size={12} color="inherit" />}
        {showMenu && !singleEnv && model.resource_type !== "source" && (
          <>
            <IconButton
              aria-label="Column options"
              className="row-context-menu"
              size="small"
              disabled={featureToggles.disableDatabaseQuery}
              onClick={handleMenuClick}
            >
              <VscKebabVertical />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={handleMenuClose}
              slotProps={{
                list: { sx: { lineHeight: "20px" } },
              }}
            >
              <ListSubheader sx={{ m: 0, p: "4px 12px", lineHeight: "20px" }}>
                Diff
              </ListSubheader>
              <MenuItem
                onClick={() => {
                  handleProfileDiff();
                  handleMenuClose();
                }}
                disabled={addedOrRemoved}
                sx={{ fontSize: "0.85rem" }}
              >
                Profile Diff
              </MenuItem>
              <MenuItem
                onClick={() => {
                  handleHistogramDiff();
                  handleMenuClose();
                }}
                disabled={
                  addedOrRemoved ||
                  (columnType ? !supportsHistogramDiff(columnType) : true)
                }
                sx={{ fontSize: "0.85rem" }}
              >
                Histogram Diff
              </MenuItem>
              <MenuItem
                onClick={() => {
                  handleTopkDiff();
                  handleMenuClose();
                }}
                disabled={addedOrRemoved}
                sx={{ fontSize: "0.85rem" }}
              >
                Top-k Diff
              </MenuItem>
              <MenuItem
                onClick={() => {
                  handleValueDiff();
                  handleMenuClose();
                }}
                disabled={addedOrRemoved}
                sx={{ fontSize: "0.85rem" }}
              >
                Value Diff
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>
    </Tooltip>
  );
}
