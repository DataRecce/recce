/**
 * @file valueDiffCells.tsx
 * @description Cell components and render functions for Value Diff summary grid
 *
 * Provides specialized cell renderers for the value diff summary view:
 * - PrimaryKeyIndicatorCell: Shows key icon for primary key columns
 * - ValueDiffColumnNameCell: Column name with context menu for drill-down
 * - MatchedPercentCell: Formatted percentage display
 *
 * Also exports render functions for use in toValueDataGrid.ts generator.
 */

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import type { ICellRendererParams } from "ag-grid-community";
import React, { type MouseEvent, useState } from "react";
import { PiDotsThreeVertical } from "react-icons/pi";
import { VscKey } from "react-icons/vsc";
import { type RowObjectType, type ValueDiffParams } from "../../../api";
import {
  type RecceActionOptions,
  useRecceActionContext,
  useRecceInstanceContext,
} from "../../../contexts";

// ============================================================================
// PrimaryKeyIndicatorCell
// ============================================================================

export interface PrimaryKeyIndicatorCellProps {
  /** The column name to check */
  columnName: string;
  /** List of primary key column names */
  primaryKeys: string[];
}

/**
 * Cell component that displays a key icon for primary key columns
 *
 * @example
 * <PrimaryKeyIndicatorCell
 *   columnName="user_id"
 *   primaryKeys={["user_id", "order_id"]}
 * />
 */
export function PrimaryKeyIndicatorCell({
  columnName,
  primaryKeys,
}: PrimaryKeyIndicatorCellProps) {
  const isPrimaryKey = primaryKeys.includes(columnName);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
      }}
    >
      {isPrimaryKey && <VscKey />}
    </Box>
  );
}

// ============================================================================
// ValueDiffColumnNameCell
// ============================================================================

export interface ValueDiffColumnNameCellProps {
  /** The column name to display */
  column: string;
  /** Parameters from the value_diff run */
  params: ValueDiffParams;
}

/**
 * Cell component for column names with context menu for drill-down actions
 *
 * @description Renders the column name with a context menu that provides:
 * - "Show mismatched values..." - Opens form to configure detail view
 * - "Show mismatched values for '{column}'" - Directly shows mismatches for this column
 *
 * @example
 * <ValueDiffColumnNameCell
 *   column="email"
 *   params={{ model: "users", primary_key: "id" }}
 * />
 */
export function ValueDiffColumnNameCell({
  params,
  column,
}: ValueDiffColumnNameCellProps) {
  const { runAction } = useRecceActionContext();
  const { featureToggles } = useRecceInstanceContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleValueDiffDetail = (
    paramsOverride?: Partial<ValueDiffParams>,
    options?: RecceActionOptions,
  ) => {
    const newParams = {
      ...params,
      ...paramsOverride,
    };

    runAction("value_diff_detail", newParams, options);
  };

  return (
    <Box sx={{ display: "flex" }}>
      <Box
        sx={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {column}
      </Box>
      <Box sx={{ flex: 1 }} />

      <IconButton
        aria-label="Column options"
        className="row-context-menu"
        size="small"
        disabled={featureToggles.disableDatabaseQuery}
        onClick={handleMenuClick}
      >
        <PiDotsThreeVertical />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        slotProps={{
          list: { sx: { lineHeight: "20px" } },
        }}
      >
        <ListSubheader sx={{ fontSize: "8pt", lineHeight: "20px" }}>
          Action
        </ListSubheader>
        <MenuItem
          onClick={() => {
            handleValueDiffDetail({}, { showForm: true });
            handleMenuClose();
          }}
          sx={{ fontSize: "10pt" }}
        >
          Show mismatched values...
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleValueDiffDetail({ columns: [column] }, { showForm: false });
            handleMenuClose();
          }}
          sx={{ fontSize: "10pt" }}
        >
          Show mismatched values for &apos;{column}&apos;
        </MenuItem>
      </Menu>
    </Box>
  );
}

// ============================================================================
// MatchedPercentCell
// ============================================================================

export interface MatchedPercentCellProps {
  /** The percentage value (0-1 scale) */
  value: number | undefined | null;
}

/**
 * Cell component for displaying match percentage with special formatting
 *
 * @description Formats the percentage value with special handling for edge cases:
 * - Values > 99.99% but < 100%: Shows "~99.99 %"
 * - Values > 0% but < 0.01%: Shows "~0.01 %"
 * - null/undefined: Shows "N/A"
 * - Other values: Shows "XX.XX %"
 *
 * @example
 * <MatchedPercentCell value={0.9542} />  // "95.42 %"
 * <MatchedPercentCell value={0.99999} /> // "~99.99 %"
 * <MatchedPercentCell value={null} />    // "N/A"
 */
export function MatchedPercentCell({ value }: MatchedPercentCellProps) {
  let displayValue = "N/A";

  if (value != null) {
    if (value > 0.9999 && value < 1) {
      displayValue = "~99.99 %";
    } else if (value < 0.0001 && value > 0) {
      displayValue = "~0.01 %";
    } else {
      displayValue = `${(value * 100).toFixed(2)} %`;
    }
  }

  return <Box sx={{ textAlign: "right" }}>{displayValue}</Box>;
}

// ============================================================================
// Render Functions for toValueDataGrid.ts
// ============================================================================

/**
 * Creates a cellRenderer function for the primary key indicator column
 *
 * @param primaryKeys - List of primary key column names
 * @returns A cellRenderer function compatible with AG Grid
 */
export function createPrimaryKeyIndicatorRenderer(
  primaryKeys: string[],
): (params: ICellRendererParams<RowObjectType>) => React.ReactNode {
  return (params) => {
    const row = params.data;
    if (!row) return null;
    return (
      <PrimaryKeyIndicatorCell
        columnName={String(row["0"])}
        primaryKeys={primaryKeys}
      />
    );
  };
}

/**
 * Creates a cellRenderer function for the column name column
 *
 * @param params - ValueDiffParams from the run
 * @returns A cellRenderer function compatible with AG Grid
 */
export function createColumnNameRenderer(
  params: ValueDiffParams,
): (cellParams: ICellRendererParams<RowObjectType>) => React.ReactNode {
  return (cellParams) => {
    const row = cellParams.data;
    const field = cellParams.colDef?.field ?? "";
    if (!row) return null;
    return (
      <ValueDiffColumnNameCell column={String(row[field])} params={params} />
    );
  };
}

/**
 * cellRenderer function for the matched percentage column
 *
 * @param params - ICellRendererParams from AG Grid
 * @returns React node displaying formatted percentage
 */
export function renderMatchedPercentCell(
  params: ICellRendererParams<RowObjectType>,
): React.ReactNode {
  const row = params.data;
  const field = params.colDef?.field ?? "";
  if (!row) return null;
  return <MatchedPercentCell value={row[field] as number} />;
}
