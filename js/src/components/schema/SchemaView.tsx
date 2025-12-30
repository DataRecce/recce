import MuiAlert from "@mui/material/Alert";
import Box from "@mui/material/Box";
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
import { NodeData } from "@/lib/api/info";
import { trackColumnLevelLineage } from "@/lib/api/track";
import {
  createDataGridFromData,
  SchemaDiffRow,
  SchemaRow,
} from "@/lib/dataGrid";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import {
  type DataGridHandle,
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { useLineageViewContext } from "../lineage/LineageViewContext";

interface SchemaViewProps {
  base?: NodeData;
  current?: NodeData;
  enableScreenshot?: boolean;
  showMenu?: boolean;
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

  const { lineageGraph } = useLineageGraphContext();
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
      "catalog.json is outdated. Update catalog.json to get schema information.";
  }

  const handleViewCll = async (columnName: string) => {
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
    if (lineageViewContext !== undefined) {
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
          rowSelection={{ mode: "singleRow" }}
        />
      )}
    </Box>
  );
}

export function PrivateSchemaView(
  { base, current, showMenu = true }: SchemaViewProps,
  ref: Ref<DataGridHandle>,
) {
  const lineageViewContext = useLineageViewContext();
  const [gridApi, setGridApi] = useState<GridApi<SchemaDiffRow> | null>(null);
  const [cllRunningMap, setCllRunningMap] = useState<Map<string, boolean>>(
    new Map(),
  );
  const { columns, rows } = useMemo(() => {
    const resourceType = current?.resource_type ?? base?.resource_type;
    const node =
      resourceType &&
      ["model", "seed", "snapshot", "source"].includes(resourceType)
        ? (current ?? base)
        : undefined;

    return createDataGridFromData(
      { type: "schema_diff", base: base?.columns, current: current?.columns },
      { node, cllRunningMap, showMenu },
    );
  }, [base, current, cllRunningMap, showMenu]);

  const { lineageGraph } = useLineageGraphContext();
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
      "catalog.json is outdated on both environments. Update catalog.json to get schema information.";
  } else if (noSchemaCurrent) {
    schemaMissingMessage =
      "catalog.json is outdated on current environment. Update catalog.json to get schema information.";
  } else if (noSchemaBase) {
    schemaMissingMessage =
      "catalog.json is outdated on base environment. Update catalog.json to get schema information.";
  }

  const handleViewCll = async (columnName: string) => {
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

    let className;
    if (row.baseIndex === undefined) {
      className = "row-added";
    } else if (row.currentIndex === undefined) {
      return "row-removed"; // removed column isn't selectable
    } else {
      className = "row-normal";
    }
    if (lineageViewContext !== undefined) {
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
          className="rdg-light no-track-pii-safe"
          ref={ref}
          getRowId={getRowId}
          getRowClass={getRowClass}
          onCellClicked={handleCellClicked}
          onGridReady={handleGridReady}
          rowSelection={{ mode: "singleRow" }}
        />
      )}
    </Box>
  );
}

export const SchemaView = forwardRef(PrivateSchemaView);
export const SingleEnvSchemaView = forwardRef(PrivateSingleEnvSchemaView);
