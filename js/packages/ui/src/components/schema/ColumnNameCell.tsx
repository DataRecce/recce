"use client";

/**
 * @file ColumnNameCell.tsx
 * @description A cell renderer component for displaying column names in schema tables.
 *
 * This component renders a column name with an optional context menu for performing
 * diff operations (Profile Diff, Histogram Diff, Top-k Diff, Value Diff) on the column.
 * It also displays a loading spinner when column-level lineage is being computed.
 *
 * @example
 * ```tsx
 * <ColumnNameCell
 *   model={nodeData}
 *   row={schemaDiffRow}
 *   singleEnv={false}
 *   cllRunning={false}
 *   showMenu={true}
 * />
 * ```
 */

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { type MouseEvent, useState } from "react";
import { VscKebabVertical } from "react-icons/vsc";
import type { NodeData } from "../../api";
import {
  useLineageGraphContext,
  useLineageViewContext,
  useRecceActionContext,
  useRecceInstanceContext,
} from "../../contexts";
import { supportsHistogramDiff } from "../histogram";
import type { SchemaDiffRow } from "./SchemaDiff";

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the ColumnNameCell component
 */
export interface ColumnNameCellProps {
  /** The model/node data containing column information */
  model: NodeData;
  /** The schema diff row data for this column */
  row: SchemaDiffRow;
  /** Whether viewing a single environment (disables diff menu) */
  singleEnv?: boolean;
  /** Whether column-level lineage is currently being computed */
  cllRunning?: boolean;
  /** Whether to show the context menu (defaults to true) */
  showMenu?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ColumnNameCell - Renders a column name with optional diff action menu
 *
 * Displays the column name with:
 * - A context menu for initiating diff operations (when applicable)
 * - A loading spinner when column-level lineage is running
 * - Tooltip indicating column lineage viewing capability
 *
 * The menu is hidden when:
 * - showMenu is false
 * - singleEnv is true (no comparison available)
 * - The model is a source (sources don't support diff operations)
 */
export function ColumnNameCell({
  model,
  row,
  singleEnv,
  cllRunning,
  showMenu = true,
}: ColumnNameCellProps) {
  const lineageViewContext = useLineageViewContext();
  const { isActionAvailable } = useLineageGraphContext();
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
    runAction(
      "profile_diff",
      { model: model.name, columns: [name] },
      {
        showForm: false,
        trackProps: {
          action: "profile_diff",
          source: "schema_column_menu",
          node_count: 1,
        },
      },
    );
  };

  const handleHistogramDiff = () => {
    runAction(
      "histogram_diff",
      { model: model.name, column_name: name, column_type: columnType },
      {
        showForm: false,
        trackProps: {
          action: "histogram_diff",
          source: "schema_column_menu",
          node_count: 1,
        },
      },
    );
  };

  const handleTopkDiff = () => {
    runAction(
      "top_k_diff",
      { model: model.name, column_name: name, k: 50 },
      {
        showForm: false,
        trackProps: {
          action: "top_k_diff",
          source: "schema_column_menu",
          node_count: 1,
        },
      },
    );
  };

  const handleValueDiff = () => {
    runAction(
      "value_diff",
      { model: model.name, columns: [name] },
      {
        showForm: true,
        trackProps: {
          action: "value_diff",
          source: "schema_column_menu",
          node_count: 1,
        },
      },
    );
  };

  const addedOrRemoved = !baseType || !currentType;
  const isCllDisabled =
    lineageViewContext === undefined ||
    !isActionAvailable("change_analysis") ||
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
