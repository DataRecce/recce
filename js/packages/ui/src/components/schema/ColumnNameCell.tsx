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
import { buildColumnTooltip, DataTypeIcon } from "../ui/DataTypeIcon";
import { getColumnChangeStatus } from "./getColumnChangeStatus";
import type { SchemaDiffRow } from "./types";

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
  /** Callback when user clicks a definition-changed badge to view SQL diff */
  onViewCode?: () => void;
  /** Whether this column is impacted by upstream changes */
  isImpacted?: boolean;
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
  onViewCode,
  isImpacted,
}: ColumnNameCellProps) {
  const lineageViewContext = useLineageViewContext();
  const { isActionAvailable } = useLineageGraphContext();
  const { runAction } = useRecceActionContext();
  const { featureToggles } = useRecceInstanceContext();
  const {
    name,
    baseType,
    currentType,
    baseIndex,
    currentIndex,
    definitionChanged,
  } = row;
  const columnType =
    currentType ??
    baseType ??
    ((row as Record<string, unknown>).type as string | undefined);
  const isAdded = baseIndex === undefined && currentIndex !== undefined;
  const isRemoved = baseIndex !== undefined && currentIndex === undefined;
  const isTypeChanged = !isAdded && !isRemoved && baseType !== currentType;

  // Resolve the change cause once. The badge, the tooltip, and the row
  // background (in SchemaView) all consume this single result, so they can't
  // disagree — e.g. an "impacted" badge sitting on a "changed"-coloured row.
  const changeStatus = singleEnv
    ? "unchanged"
    : getColumnChangeStatus(row, isImpacted);

  // Tooltip copy still distinguishes a type shift from a definition change —
  // that's presentation detail read from the raw fields, not a second cause
  // decision. (buildColumnTooltip keeps its existing status vocabulary.)
  const tooltipStatus =
    changeStatus === "added"
      ? "added"
      : changeStatus === "removed"
        ? "removed"
        : changeStatus === "unknown"
          ? "definition_unknown"
          : (changeStatus === "changed" || changeStatus === "impacted") &&
              isTypeChanged
            ? "type_changed"
            : changeStatus === "changed" && definitionChanged
              ? "definition_changed"
              : "unchanged";

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

  // The tooltip's "· impacted" annotation tracks the resolved cause exactly.
  const showImpactedTag = changeStatus === "impacted";

  const tooltipTitle = buildColumnTooltip({
    name,
    status: tooltipStatus,
    baseType,
    currentType,
    cllAvailable: !isCllDisabled,
    impacted: showImpactedTag,
  });

  return (
    <Tooltip title={tooltipTitle} placement="top">
      <Box sx={{ display: "flex", alignItems: "center", gap: "3px" }}>
        {changeStatus === "changed" &&
          (definitionChanged ? (
            <Tooltip
              title="Definition changed — click to view code"
              placement="top"
              onMouseOver={(e) => e.stopPropagation()}
            >
              {onViewCode ? (
                <button
                  type="button"
                  className="schema-change-badge schema-change-badge-changed schema-change-badge-clickable"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewCode();
                  }}
                >
                  ~
                </button>
              ) : (
                <span className="schema-change-badge schema-change-badge-changed">
                  ~
                </span>
              )}
            </Tooltip>
          ) : (
            <span className="schema-change-badge schema-change-badge-changed">
              ~
            </span>
          ))}
        {changeStatus === "added" && (
          <span className="schema-change-badge schema-change-badge-added">
            +
          </span>
        )}
        {changeStatus === "removed" && (
          <span className="schema-change-badge schema-change-badge-removed">
            -
          </span>
        )}
        {changeStatus === "impacted" && (
          <span className="schema-change-badge schema-change-badge-impacted">
            !
          </span>
        )}
        {changeStatus === "unknown" && (
          <Tooltip
            title="Change status unknown — analyzer couldn't resolve column dependencies"
            placement="top"
            onMouseOver={(e) => e.stopPropagation()}
          >
            <span className="schema-change-badge schema-change-badge-unknown">
              ?
            </span>
          </Tooltip>
        )}
        <Box
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </Box>
        {isTypeChanged ? (
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.125rem",
              ml: "0.25rem",
              fontSize: "1.6rem",
              lineHeight: 1,
            }}
          >
            {baseType && (
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "line-through",
                  opacity: 0.6,
                }}
              >
                <DataTypeIcon type={baseType} disableTooltip />
              </Box>
            )}
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: "0.7em",
                opacity: 0.5,
              }}
            >
              →
            </Box>
            {currentType && (
              <Box
                component="span"
                sx={{ display: "inline-flex", alignItems: "center" }}
              >
                <DataTypeIcon type={currentType} disableTooltip />
              </Box>
            )}
          </Box>
        ) : (
          columnType && (
            <Box component="span" sx={{ ml: "0.25rem", fontSize: "1.6rem" }}>
              <DataTypeIcon type={columnType} disableTooltip />
            </Box>
          )
        )}
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
