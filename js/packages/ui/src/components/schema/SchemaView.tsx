import MuiAlert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import "./style.css";
import type {
  CellClickedEvent,
  GridApi,
  GridReadyEvent,
  RowClassParams,
} from "ag-grid-community";
import {
  forwardRef,
  type ReactNode,
  Ref,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { NodeData } from "../../api";
import {
  useLineageGraphContext,
  useLineageViewContext,
  useRecceServerFlag,
} from "../../contexts";
import { useInlineProfileDistribution } from "../../hooks/useInlineProfileDistribution";
import { trackColumnLevelLineage } from "../../lib/api/track";
import type {
  SchemaDiffRow,
  SchemaRow,
} from "../../lib/dataGrid/generators/toSchemaDataGrid";
import {
  type DataGridHandle,
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../../primitives";
import { ProfileDistributionUnsupportedBanner } from "../data/ProfileDistributionUnsupportedBanner";
import { createDataGridFromData } from "../ui/dataGrid";
import type { SchemaDistributionData } from "../ui/dataGrid/schemaCells";
import { selectInlineProfileScope } from "./selectInlineProfileScope";

export function SchemaLegend() {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        px: 1,
        py: 0.5,
        fontSize: "0.75rem",
        color: "text.secondary",
      }}
    >
      <span>
        <span className="schema-change-badge schema-change-badge-added">+</span>{" "}
        added
      </span>
      <span>
        <span className="schema-change-badge schema-change-badge-removed">
          -
        </span>{" "}
        removed
      </span>
      <span>
        <span className="schema-change-badge schema-change-badge-changed">
          ~
        </span>{" "}
        changed
      </span>
    </Box>
  );
}

interface SchemaViewProps {
  base?: NodeData;
  current?: NodeData;
  enableScreenshot?: boolean;
  showMenu?: boolean;
  /** Per-column change status from breaking change analysis */
  columnChanges?: Record<
    string,
    "added" | "removed" | "modified" | "unknown"
  > | null;
  /** Callback when user clicks a definition-changed badge to view SQL diff */
  onViewCode?: () => void;
  /** Optional action element rendered next to the legend (e.g. add-to-checklist button) */
  headerAction?: ReactNode;
}

function PrivateSingleEnvSchemaView(
  { current, showMenu = true }: { current?: NodeData; showMenu?: boolean },
  ref: Ref<DataGridHandle>,
) {
  const lineageViewContext = useLineageViewContext();
  const [gridApi, setGridApi] = useState<GridApi<SchemaRow> | null>(null);
  const [cllRunningMap, setCllRunningMap] = useState<Map<string, boolean>>(
    new Map(),
  );
  const { columns, rows } = useMemo(() => {
    return createDataGridFromData(
      { type: "schema_single", columns: current?.columns },
      { node: current, cllRunningMap, showMenu },
    );
  }, [current, cllRunningMap, showMenu]);

  const { lineageGraph, isActionAvailable } = useLineageGraphContext();
  const changeAnalysisAvailable = isActionAvailable("change_analysis");
  const noCatalogCurrent = !lineageGraph?.catalogMetadata.current;
  let catalogMissingMessage = undefined;
  if (noCatalogCurrent) {
    catalogMissingMessage =
      "catalog.json not found. Run `recce debug` to troubleshoot.";
  }

  const noSchemaCurrent = current && current.columns === undefined;
  let schemaMissingMessage = undefined;
  if (noSchemaCurrent) {
    schemaMissingMessage =
      "Node schema not found in catalog.json. Please regenerate your catalog.json to update.";
  }

  const handleViewCll = async (columnName: string) => {
    if (!changeAnalysisAvailable) return;
    trackColumnLevelLineage({ action: "view", source: "schema_column" });
    setCllRunningMap((prev) => new Map(prev).set(columnName, true));
    const modelId = current?.id;
    if (modelId) {
      await lineageViewContext?.showColumnLevelLineage({
        node_id: modelId,
        column: columnName,
      });
    }
    setCllRunningMap((prev) => new Map(prev).set(columnName, false));
  };

  const getRowId = useCallback(
    (params: { data: SchemaRow }) => {
      const modelId = current?.id;
      return `${modelId}-${params.data.name}`;
    },
    [current?.id],
  );

  const cll = lineageViewContext?.viewOptions.column_level_lineage;
  const selectedRowId = cll ? `${cll.node_id}-${cll.column}` : null;

  // Update row selection when cll changes
  useEffect(() => {
    if (!gridApi) return;
    gridApi.deselectAll();
    if (selectedRowId) {
      const rowNode = gridApi.getRowNode(selectedRowId);
      if (rowNode) {
        rowNode.setSelected(true);
      }
    }
  }, [gridApi, selectedRowId]);

  const handleGridReady = useCallback((event: GridReadyEvent<SchemaRow>) => {
    setGridApi(event.api);
  }, []);

  const getRowClass = (_params: RowClassParams<SchemaRow>) => {
    if (lineageViewContext !== undefined && changeAnalysisAvailable) {
      return "row-normal row-selectable";
    }
    return "row-normal";
  };

  const handleCellClicked = async (event: CellClickedEvent<SchemaRow>) => {
    // Skip if clicking on the menu button
    const target = event.event?.target as HTMLElement | undefined;
    if (target?.closest(".row-context-menu")) {
      return;
    }
    const row = event.data;
    if (row) {
      await handleViewCll(row.name);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {catalogMissingMessage ? (
        <MuiAlert severity="warning" sx={{ fontSize: "12px", p: 1 }}>
          {catalogMissingMessage}
        </MuiAlert>
      ) : schemaMissingMessage ? (
        <MuiAlert severity="warning" sx={{ fontSize: "12px", p: 1 }}>
          {schemaMissingMessage}
        </MuiAlert>
      ) : (
        <></>
      )}

      {rows.length > 0 && (
        <ScreenshotDataGrid
          style={{
            blockSize: "auto",
            maxHeight: "100%",
            overflow: "auto",
            fontSize: "10pt",
            borderWidth: 1,
          }}
          columns={columns}
          rows={rows}
          renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
          ref={ref}
          getRowId={getRowId}
          getRowClass={getRowClass}
          onCellClicked={handleCellClicked}
          onGridReady={handleGridReady}
          rowSelection={{ mode: "singleRow", checkboxes: false }}
          containerClassName="no-track-pii-safe"
          rowClassName="no-track-pii-safe"
        />
      )}
    </Box>
  );
}

export function PrivateSchemaView(
  {
    base,
    current,
    showMenu = true,
    columnChanges,
    onViewCode,
    headerAction,
  }: SchemaViewProps,
  ref: Ref<DataGridHandle>,
) {
  const lineageViewContext = useLineageViewContext();
  const { data: serverFlags } = useRecceServerFlag();
  const newCllExperience = serverFlags?.new_cll_experience ?? false;
  const inlineProfile = serverFlags?.inline_profile ?? false;
  const [gridApi, setGridApi] = useState<GridApi<SchemaDiffRow> | null>(null);
  const [cllRunningMap, setCllRunningMap] = useState<Map<string, boolean>>(
    new Map(),
  );

  // Per-model opt-in to profile *every* column rather than just the changed
  // ones. Keyed by the node id it was enabled for (not a bare boolean +
  // reset-in-effect) so switching nodes restores the changed-columns default on
  // the SAME render — the view isn't remounted per node, so a reset effect left
  // one stale render that fired a spurious all-columns run before it landed.
  const [profileAllColumnsNodeId, setProfileAllColumnsNodeId] = useState<
    string | null
  >(null);

  // Use the frozen impacted column set from impact analysis so sidebar
  // highlights stay stable when navigating between models/columns.
  const impactedColumns = useMemo(() => {
    if (!newCllExperience) return undefined;
    const frozen = lineageViewContext?.impactedColumnIds;
    return frozen?.size ? frozen : undefined;
  }, [newCllExperience, lineageViewContext?.impactedColumnIds]);

  // Resolve the dbt node used for context-menu actions and inline profiling.
  const profileNode = useMemo(() => {
    const resourceType = current?.resource_type ?? base?.resource_type;
    return resourceType &&
      ["model", "seed", "snapshot", "source"].includes(resourceType)
      ? (current ?? base)
      : undefined;
  }, [current, base]);
  const nodeId = current?.id ?? base?.id;

  // This node's own column names (base ∪ current), used to attribute impacted
  // ids to this node by exact `<nodeId>_<column>` membership in the scoping
  // logic rather than fragile prefix-stripping.
  const nodeColumnNames = useMemo(() => {
    const names = new Set<string>();
    for (const name of Object.keys(base?.columns ?? {})) names.add(name);
    for (const name of Object.keys(current?.columns ?? {})) names.add(name);
    return names;
  }, [base, current]);

  // Derived (not stored): the opt-in only applies to the node it was enabled
  // for, so navigating away clears it within the same render — no stale frame.
  const profileAllColumns =
    profileAllColumnsNodeId != null && profileAllColumnsNodeId === nodeId;

  // Whole-model change: read the lineage's canonical set directly (the same
  // signal that paints the changed title chip/stripe), exactly as we consult
  // `impactedColumnIds` above — no bespoke per-view recomputation. A whole-model
  // change profiles every column (the change isn't pinned to specific columns).
  const wholeModelChange =
    lineageViewContext?.wholeModelChangedNodeIds?.has(nodeId ?? "") ?? false;

  // DRC-3390 Stage C: scope the inline distribution to *changed* columns under
  // the new-CLL experience. The pure decision (which columns to profile,
  // whether to profile at all, whether the run already covers everything) is
  // factored into `selectInlineProfileScope` so the wiring is unit-tested
  // without mounting the whole view. "Profile all columns" widens the *same*
  // run to every column; the wider request re-profiles the already-shown
  // columns (the backend cache is keyed on the exact column set — DRC-3630),
  // but the hook keeps the prior histograms on screen via `placeholderData`
  // while the wider query loads, so it never visually goes backwards.
  const { scopedColumns, profileEnabled, profilingAll } = useMemo(
    () =>
      selectInlineProfileScope({
        newCllExperience,
        columnChanges,
        impactedColumns,
        nodeId,
        nodeColumnNames,
        wholeModelChange,
        profileAllColumns,
      }),
    [
      newCllExperience,
      columnChanges,
      impactedColumns,
      nodeId,
      nodeColumnNames,
      wholeModelChange,
      profileAllColumns,
    ],
  );

  // The hook also self-gates on the `inline_profile` server flag — a no-op
  // (status "disabled") when it's off.
  const distribution = useInlineProfileDistribution({
    model: profileNode?.name,
    nodeId,
    columns: scopedColumns,
    enabled: profileEnabled,
  });

  // Thread distribution data into the grid. "disabled"/"unsupported" render no
  // column (unsupported shows a banner instead); "loading"/"ok"/"error" keep
  // the column so cells can show a pending dot, a histogram, or a "failed to
  // read" error icon respectively.
  const distributionData: SchemaDistributionData | undefined = useMemo(() => {
    if (
      distribution.status === "disabled" ||
      distribution.status === "unsupported"
    ) {
      return undefined;
    }
    return {
      payloads: distribution.columns,
      baseTotal: distribution.baseTotal,
      currentTotal: distribution.currentTotal,
      isLoading: distribution.isLoading,
      hasError: distribution.status === "error",
      scopedColumns,
    };
  }, [
    distribution.status,
    distribution.columns,
    distribution.baseTotal,
    distribution.currentTotal,
    distribution.isLoading,
    scopedColumns,
  ]);

  const { columns, rows } = useMemo(() => {
    return createDataGridFromData(
      { type: "schema_diff", base: base?.columns, current: current?.columns },
      {
        node: profileNode,
        cllRunningMap,
        showMenu,
        columnChanges,
        onViewCode,
        impactedColumns,
        nodeId,
        distribution: distributionData,
      },
    );
  }, [
    base,
    current,
    profileNode,
    nodeId,
    cllRunningMap,
    showMenu,
    columnChanges,
    onViewCode,
    impactedColumns,
    distributionData,
  ]);

  const { lineageGraph, isActionAvailable } = useLineageGraphContext();
  const changeAnalysisAvailable = isActionAvailable("change_analysis");
  const noCatalogBase = !lineageGraph?.catalogMetadata.base;
  const noCatalogCurrent = !lineageGraph?.catalogMetadata.current;
  let catalogMissingMessage = undefined;
  if (noCatalogBase && noCatalogCurrent) {
    catalogMissingMessage =
      "catalog.json not found on both environments. Run `recce debug` to troubleshoot.";
  } else if (noCatalogBase) {
    catalogMissingMessage =
      "catalog.json not found on base environment. Run `recce debug` to troubleshoot.";
  } else if (noCatalogCurrent) {
    catalogMissingMessage =
      "catalog.json not found on current environment. Run `recce debug` to troubleshoot.";
  }

  const noSchemaBase = base && base.columns === undefined;
  const noSchemaCurrent = current && current.columns === undefined;
  let schemaMissingMessage = undefined;
  if (noSchemaBase && noSchemaCurrent) {
    schemaMissingMessage =
      "Node schema not found in catalog.json on both environments. Please regenerate your catalog.json to update.";
  } else if (noSchemaCurrent) {
    schemaMissingMessage =
      "Node schema not found in catalog.json on current environment. Please regenerate your catalog.json to update.";
  } else if (noSchemaBase) {
    schemaMissingMessage =
      "Node schema not found in catalog.json on base environment. Please regenerate your catalog.json to update.";
  }

  const handleViewCll = async (columnName: string) => {
    if (!changeAnalysisAvailable) return;
    trackColumnLevelLineage({ action: "view", source: "schema_column" });
    setCllRunningMap((prev) => new Map(prev).set(columnName, true));
    const modelId = current?.id ?? base?.id;
    if (modelId) {
      await lineageViewContext?.showColumnLevelLineage({
        node_id: modelId,
        column: columnName,
      });
    }
    setCllRunningMap((prev) => new Map(prev).set(columnName, false));
  };

  const getRowId = useCallback(
    (params: { data: SchemaDiffRow }) => {
      const modelId = current?.id ?? base?.id;
      return `${modelId}-${params.data.name}`;
    },
    [current?.id, base?.id],
  );

  const cll = lineageViewContext?.viewOptions.column_level_lineage;
  const selectedRowId = cll ? `${cll.node_id}-${cll.column}` : null;

  // Update row selection when cll changes
  useEffect(() => {
    if (!gridApi) return;
    gridApi.deselectAll();
    if (selectedRowId) {
      const rowNode = gridApi.getRowNode(selectedRowId);
      if (rowNode) {
        rowNode.setSelected(true);
      }
    }
  }, [gridApi, selectedRowId]);

  const handleGridReady = useCallback(
    (event: GridReadyEvent<SchemaDiffRow>) => {
      setGridApi(event.api);
    },
    [],
  );

  const getRowClass = (params: RowClassParams<SchemaDiffRow>) => {
    const row = params.data;
    if (!row) return "row-normal";

    let className: string;
    if (row.baseIndex === undefined) {
      className = "row-added";
    } else if (row.currentIndex === undefined) {
      return "row-removed"; // removed column isn't selectable
    } else if (
      row.baseType !== row.currentType ||
      row.reordered === true ||
      row.definitionChanged === true ||
      row.changeUnknown === true
    ) {
      // Any change (structural, definition-only, or unknown) gets the changed row background
      className = "row-changed";
    } else if (row.isImpacted) {
      className = "row-impacted";
    } else {
      className = "row-normal";
    }
    if (lineageViewContext !== undefined && changeAnalysisAvailable) {
      className += " row-selectable";
    }
    return className;
  };

  const handleCellClicked = async (event: CellClickedEvent<SchemaDiffRow>) => {
    // Skip if clicking on the menu button
    const target = event.event?.target as HTMLElement | undefined;
    if (target?.closest(".row-context-menu")) {
      return;
    }
    const row = event.data;
    if (!row) return;
    // Removed columns aren't clickable
    if (row.baseIndex !== undefined && row.currentIndex === undefined) {
      return;
    }
    await handleViewCll(row.name);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {catalogMissingMessage ? (
        <MuiAlert severity="warning" sx={{ fontSize: "12px", p: 1 }}>
          {catalogMissingMessage}
        </MuiAlert>
      ) : schemaMissingMessage ? (
        <MuiAlert severity="warning" sx={{ fontSize: "12px", p: 1 }}>
          {schemaMissingMessage}
        </MuiAlert>
      ) : (
        <></>
      )}

      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          pr: 1,
        }}
      >
        <SchemaLegend />
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          {newCllExperience &&
            inlineProfile &&
            profileNode &&
            distribution.status !== "unsupported" &&
            !profilingAll && (
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setProfileAllColumnsNodeId(nodeId ?? null);
                }}
                sx={{
                  textTransform: "none",
                  fontSize: "0.7rem",
                  py: 0.25,
                  px: 1,
                  minWidth: 0,
                  whiteSpace: "nowrap",
                }}
              >
                Profile all columns
              </Button>
            )}
          {headerAction}
        </Stack>
      </Stack>
      {distribution.status === "unsupported" && (
        <Box sx={{ px: 1, pb: 0.5 }}>
          <ProfileDistributionUnsupportedBanner
            reason={distribution.unsupportedReason}
          />
        </Box>
      )}
      {rows.length > 0 && (
        <ScreenshotDataGrid
          style={{
            blockSize: "auto",
            maxHeight: "100%",
            overflow: "auto",
            fontSize: "0.8rem",
            borderWidth: 1,
          }}
          columns={columns}
          rows={rows}
          rowHeight={35}
          renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
          className={`rdg-light no-track-pii-safe${newCllExperience ? " cll-experience" : ""}`}
          ref={ref}
          getRowId={getRowId}
          getRowClass={getRowClass}
          onCellClicked={handleCellClicked}
          onGridReady={handleGridReady}
          rowSelection={{ mode: "singleRow", checkboxes: false }}
          containerClassName="no-track-pii-safe"
          rowClassName="no-track-pii-safe"
        />
      )}
    </Box>
  );
}

export const SchemaView = forwardRef(PrivateSchemaView);
export const SingleEnvSchemaView = forwardRef(PrivateSingleEnvSchemaView);
