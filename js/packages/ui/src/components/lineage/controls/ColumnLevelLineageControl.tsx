"use client";

/**
 * @file ColumnLevelLineageControl.tsx
 * @description Control panel for Column-Level Lineage (CLL) and Impact Radius features.
 *
 * This component provides:
 * - Impact Radius button to analyze downstream impact of changes
 * - Mode message panel showing current CLL context
 * - Loading and error states for CLL operations
 * - Reset button to exit CLL mode
 *
 * @example
 * ```tsx
 * <ColumnLevelLineageControl
 *   action={cllMutation}
 *   interactive={true}
 *   viewOptions={viewOptions}
 *   lineageGraph={lineageGraph}
 *   singleEnvMode={false}
 *   onShowCll={(params) => showColumnLevelLineage(params)}
 *   onResetCll={() => resetColumnLevelLineage()}
 *   onCenterNode={(nodeId) => centerNode(nodeId)}
 * />
 * ```
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import MuiPopover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";
import { FaRegDotCircle } from "react-icons/fa";
import { PiInfo, PiX } from "react-icons/pi";
import type { CllInput, ColumnLineageData } from "../../../api/cll";
import type { LineageDiffViewOptions } from "../../../api/lineagecheck";
import type { LineageGraph } from "../../../contexts/lineage/types";
import { useIsDark } from "../../../hooks/useIsDark";

/**
 * Props for the ColumnLevelLineageControl component.
 */
export interface ColumnLevelLineageControlProps {
  /**
   * Mutation result for CLL operations.
   * Used to track loading, error, and success states.
   */
  action: UseMutationResult<ColumnLineageData, Error, CllInput>;

  /**
   * Whether the view is interactive (allows user actions).
   * When false, buttons are disabled.
   */
  interactive: boolean;

  /**
   * Current view options including column_level_lineage settings.
   */
  viewOptions: LineageDiffViewOptions;

  /**
   * The lineage graph data containing nodes and catalog metadata.
   * Used to determine node names and catalog availability.
   */
  lineageGraph?: LineageGraph;

  /**
   * Whether in single environment mode.
   * When true, the Impact Radius button is hidden.
   */
  singleEnvMode?: boolean;

  /**
   * Callback to show column-level lineage.
   * Called with CLL parameters when Impact Radius button is clicked.
   */
  onShowCll: (params?: CllInput) => Promise<void>;

  /**
   * Callback to reset column-level lineage view.
   */
  onResetCll: () => Promise<void>;

  /**
   * Callback to center the view on a specific node.
   */
  onCenterNode: (nodeId: string) => void;
}

/**
 * Internal component to display mode-specific messages.
 * Shows what CLL context is currently active.
 */
const ModeMessage = ({
  lineageGraph,
  cllInput,
  onCenterNode,
}: {
  lineageGraph?: LineageGraph;
  cllInput?: CllInput;
  onCenterNode: (nodeId: string) => void;
}) => {
  const isDark = useIsDark();

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
    return <>Default View</>;
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
            onCenterNode(nodeId);
          }}
          sx={codeBlockSx}
        >
          {nodeName}
        </Box>
      </>
    );
  }
  const nodeId = `${cllInput.node_id}_${cllInput.column}`;
  return (
    <>
      <Typography component="span" sx={{ mr: "5px" }}>
        Column Lineage for{" "}
      </Typography>
      <Box
        component="code"
        onClick={() => {
          onCenterNode(nodeId);
        }}
        sx={codeBlockSx}
      >
        {nodeName}.{cllInput.column}
      </Box>
    </>
  );
};

/**
 * Control panel for Column-Level Lineage (CLL) and Impact Radius features.
 *
 * Features:
 * - **Impact Radius Button**: Triggers analysis of downstream impact for changed models
 * - **Mode Message Panel**: Shows current CLL context (node, column, or all changes)
 * - **Loading State**: Displays spinner during CLL operations
 * - **Error State**: Shows error indicator with tooltip for failure details
 * - **Reset Button**: Allows exiting CLL mode to return to default view
 *
 * The component is designed for dependency injection, receiving all callbacks
 * and state as props to enable reuse across different contexts.
 */
export const ColumnLevelLineageControl = ({
  action,
  interactive,
  viewOptions,
  lineageGraph,
  singleEnvMode = false,
  onShowCll,
  onResetCll,
  onCenterNode,
}: ColumnLevelLineageControlProps) => {
  const cllInput = viewOptions.column_level_lineage;
  const noCatalogCurrent = !lineageGraph?.catalogMetadata.current;

  return (
    <Stack direction="row" spacing="5px">
      {!singleEnvMode && (
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
                  void onShowCll({
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
      {cllInput && (
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
          <ModeMessage
            lineageGraph={lineageGraph}
            cllInput={cllInput}
            onCenterNode={onCenterNode}
          />
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
                void onResetCll();
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
