import MuiAlert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import "./style.css";
import type {
  CellClickedEvent,
  GridApi,
  GridReadyEvent,
  RowClassParams,
} from "ag-grid-community";
import {
  forwardRef,
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
import { useInlineProfile, useProfileMode } from "../../hooks";
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

import { createDataGridFromData } from "../ui/dataGrid";
import { ProfileModeToggle } from "./ProfileModeToggle";
import { SchemaGalleryView } from "./SchemaGalleryView";

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
  columnChanges?: Record<string, "added" | "removed" | "modified"> | null;
  /** Callback when user clicks a definition-changed badge to view SQL diff */
  onViewCode?: () => void;
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
  }: SchemaViewProps,
  ref: Ref<DataGridHandle>,
) {
  const lineageViewContext = useLineageViewContext();
  const { data: serverFlags } = useRecceServerFlag();
  const newCllExperience = serverFlags?.new_cll_experience ?? false;
  const inlineProfileFlag = serverFlags?.inline_profile ?? false;
  const inlineProfileActive = newCllExperience && inlineProfileFlag;

  const [profileMode, setProfileMode] = useProfileMode();

  const nodeResourceType = current?.resource_type ?? base?.resource_type;
  const isProfilable =
    nodeResourceType === "model" ||
    nodeResourceType === "seed" ||
    nodeResourceType === "snapshot" ||
    nodeResourceType === "source";

  const columnsInBothEnvs = useMemo(() => {
    if (!base?.columns || !current?.columns) return [] as string[];
    const baseSet = new Set(Object.keys(base.columns));
    return Object.keys(current.columns).filter((c) => baseSet.has(c));
  }, [base?.columns, current?.columns]);

  const impactedColumnsForProfile = useMemo(() => {
    if (!inlineProfileActive) return [] as string[];
    const nodeId = current?.id ?? base?.id;
    const impactedSet = lineageViewContext?.impactedColumnIds;
    if (!nodeId || !impactedSet) return [] as string[];
    return columnsInBothEnvs.filter((c) => impactedSet.has(`${nodeId}_${c}`));
  }, [
    inlineProfileActive,
    current?.id,
    base?.id,
    lineageViewContext?.impactedColumnIds,
    columnsInBothEnvs,
  ]);

  const modelName = current?.name ?? base?.name;
  const nodeIdForProfile = current?.id ?? base?.id;

  const [expanded, setExpanded] = useState(false);

  // Reset expand state when the user navigates to a different model, so each
  // model starts in the default impacted-columns-only scope.
  // biome-ignore lint/correctness/useExhaustiveDependencies: nodeIdForProfile is intentionally the trigger
  useEffect(() => {
    setExpanded(false);
  }, [nodeIdForProfile]);

  const columnsToProfile = expanded
    ? columnsInBothEnvs
    : impactedColumnsForProfile;

  const {
    profileByColumn,
    isLoading: profileLoading,
    error: profileError,
  } = useInlineProfile({
    modelName,
    columns: columnsToProfile,
    enabled: inlineProfileActive && isProfilable && columnsToProfile.length > 0,
  });

  const [gridApi, setGridApi] = useState<GridApi<SchemaDiffRow> | null>(null);
  const [cllRunningMap, setCllRunningMap] = useState<Map<string, boolean>>(
    new Map(),
  );

  // Use the frozen impacted column set from impact analysis so sidebar
  // highlights stay stable when navigating between models/columns.
  const impactedColumns = useMemo(() => {
    if (!newCllExperience) return undefined;
    const frozen = lineageViewContext?.impactedColumnIds;
    return frozen?.size ? frozen : undefined;
  }, [newCllExperience, lineageViewContext?.impactedColumnIds]);

  const { columns, rows } = useMemo(() => {
    const resourceType = current?.resource_type ?? base?.resource_type;
    const node =
      resourceType &&
      ["model", "seed", "snapshot", "source"].includes(resourceType)
        ? (current ?? base)
        : undefined;
    const nodeId = current?.id ?? base?.id;

    return createDataGridFromData(
      { type: "schema_diff", base: base?.columns, current: current?.columns },
      {
        node,
        cllRunningMap,
        showMenu,
        columnChanges,
        onViewCode,
        impactedColumns,
        nodeId,
        profileByColumn:
          profileByColumn.size > 0
            ? (profileByColumn as Map<
                string,
                {
                  base?: Record<string, unknown>;
                  current?: Record<string, unknown>;
                }
              >)
            : undefined,
        profileMode,
      },
    );
  }, [
    base,
    current,
    cllRunningMap,
    showMenu,
    columnChanges,
    onViewCode,
    impactedColumns,
    profileByColumn,
    profileMode,
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
      row.definitionChanged === true
    ) {
      // Any change (structural or definition-only) gets the changed row background
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

      {profileError ? (
        <MuiAlert severity="warning" sx={{ fontSize: "12px", p: 1 }}>
          {(() => {
            const msg =
              profileError instanceof Error
                ? profileError.message
                : String(profileError);
            return msg
              ? `Couldn't load column profile: ${msg}`
              : "Couldn't load column profile";
          })()}
        </MuiAlert>
      ) : null}
      <SchemaLegend />
      {inlineProfileActive && isProfilable ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1,
            py: 0.5,
          }}
        >
          <ProfileModeToggle value={profileMode} onChange={setProfileMode} />
          {profileLoading ? (
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                color: "text.secondary",
                fontSize: "0.75rem",
              }}
              aria-live="polite"
            >
              <CircularProgress size={14} thickness={5} />
              <span>Profiling…</span>
            </Box>
          ) : null}
          {(() => {
            const uncoveredCount = columnsInBothEnvs.filter(
              (c) => !profileByColumn.has(c.toLowerCase()),
            ).length;
            if (uncoveredCount === 0) return null;
            const label =
              profileByColumn.size === 0
                ? "Profile all columns"
                : "Profile remaining columns";
            return (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setExpanded(true)}
                disabled={profileLoading}
              >
                {profileLoading ? "Profiling…" : label}
              </Button>
            );
          })()}
        </Box>
      ) : null}
      {rows.length > 0 &&
        (profileMode === "grid" && inlineProfileActive && isProfilable ? (
          <SchemaGalleryView rows={rows} onColumnClick={handleViewCll} />
        ) : (
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
        ))}
    </Box>
  );
}

export const SchemaView = forwardRef(PrivateSchemaView);
export const SingleEnvSchemaView = forwardRef(PrivateSingleEnvSchemaView);
