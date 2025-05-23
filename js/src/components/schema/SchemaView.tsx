import { forwardRef, Key, useMemo, useState } from "react";

import { mergeColumns, SchemaDiffRow, toDataGrid, toSingleEnvDataGrid } from "./schema";
import "react-data-grid/lib/styles.css";
import { Flex, Alert, AlertIcon } from "@chakra-ui/react";
import { EmptyRowsRenderer, ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { NodeData } from "@/lib/api/info";
import { trackColumnLevelLineage } from "@/lib/api/track";
import { useLineageViewContext } from "../lineage/LineageViewContext";
import { CellClickArgs } from "react-data-grid";

interface SchemaViewProps {
  base?: NodeData;
  current?: NodeData;
  enableScreenshot?: boolean;
}

function PrivateSingleEnvSchemaView({ current }: { current?: NodeData }, ref: any) {
  const lineageViewContext = useLineageViewContext();
  const [cllRunningMap, setCllRunningMap] = useState<Map<string, boolean>>(new Map());
  const { columns, rows } = useMemo(() => {
    return toSingleEnvDataGrid(current?.columns, current, cllRunningMap);
  }, [current, cllRunningMap]);

  const { lineageGraph } = useLineageGraphContext();
  const noCatalogCurrent = !lineageGraph?.catalogMetadata.current;
  let catalogMissingMessage = undefined;
  if (noCatalogCurrent) {
    catalogMissingMessage = "catalog.json is missing.";
  }

  const noSchemaCurrent = current && current.columns === undefined;
  let schemaMissingMessage = undefined;
  if (noSchemaCurrent) {
    schemaMissingMessage = "Schema information is missing.";
  }

  const handleViewCll = async (columnName: string) => {
    trackColumnLevelLineage({ action: "view", source: "schema_column" });
    setCllRunningMap((prev) => new Map(prev).set(columnName, true));
    const modelId = current?.id;
    if (modelId) {
      await lineageViewContext?.showColumnLevelLineage(modelId, columnName);
    }
    setCllRunningMap((prev) => new Map(prev).set(columnName, false));
  };

  const rowKeyGetter = (row: SchemaDiffRow) => {
    const modelId = current?.id;
    return `${modelId}-${row.name}`;
  };
  const cll = lineageViewContext?.viewOptions.column_level_lineage;
  const selectedRows: Set<Key> = cll ? new Set([`${cll.node}-${cll.column}`]) : new Set();

  return (
    <Flex direction="column">
      {catalogMissingMessage ? (
        <Alert status="warning" fontSize="12px" p="8px">
          <AlertIcon />
          {catalogMissingMessage}
        </Alert>
      ) : schemaMissingMessage ? (
        <Alert status="warning" fontSize="12px" p="8px">
          <AlertIcon />
          {schemaMissingMessage}
        </Alert>
      ) : (
        <></>
      )}

      {rows.length > 0 && (
        <>
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
            className="rdg-light"
            enableScreenshot={false}
            ref={ref}
            rowKeyGetter={rowKeyGetter}
            selectedRows={selectedRows}
            onSelectedRowsChange={() => {}}
            onCellClick={async (args: CellClickArgs<SchemaDiffRow>) => {
              await handleViewCll(args.row.name);
            }}
            rowClass={() => "row-normal"}
          />
        </>
      )}
    </Flex>
  );
}

export function PrivateSchemaView(
  { base, current, enableScreenshot = false }: SchemaViewProps,
  ref: any,
) {
  const lineageViewContext = useLineageViewContext();
  const [cllRunningMap, setCllRunningMap] = useState<Map<string, boolean>>(new Map());
  const { columns, rows } = useMemo(() => {
    const schemaDiff = mergeColumns(base?.columns, current?.columns);
    const resourceType = current?.resource_type ?? base?.resource_type;
    if (resourceType && ["model", "seed", "snapshot", "source"].includes(resourceType)) {
      return toDataGrid(schemaDiff, current ?? base, cllRunningMap);
    } else {
      return toDataGrid(schemaDiff);
    }
  }, [base, current, cllRunningMap]);

  const { lineageGraph } = useLineageGraphContext();
  const noCatalogBase = !lineageGraph?.catalogMetadata.base;
  const noCatalogCurrent = !lineageGraph?.catalogMetadata.current;
  let catalogMissingMessage = undefined;
  if (noCatalogBase && noCatalogCurrent) {
    catalogMissingMessage = "catalog.json is missing on both current and base environments.";
  } else if (noCatalogBase) {
    catalogMissingMessage = "catalog.json is missing on base environment.";
  } else if (noCatalogCurrent) {
    catalogMissingMessage = "catalog.json is missing on current environment.";
  }

  const noSchemaBase = base && base.columns === undefined;
  const noSchemaCurrent = current && current.columns === undefined;
  let schemaMissingMessage = undefined;
  if (noSchemaBase && noSchemaCurrent) {
    schemaMissingMessage = "Schema information is missing on both current and base environments.";
  } else if (noSchemaBase) {
    schemaMissingMessage = "Schema information is missing on base environment.";
  } else if (noSchemaCurrent) {
    schemaMissingMessage = "Schema information is missing on current environment.";
  }

  const handleViewCll = async (columnName: string) => {
    trackColumnLevelLineage({ action: "view", source: "schema_column" });
    setCllRunningMap((prev) => new Map(prev).set(columnName, true));
    const modelId = current?.id ?? base?.id;
    if (modelId) {
      await lineageViewContext?.showColumnLevelLineage(modelId, columnName);
    }
    setCllRunningMap((prev) => new Map(prev).set(columnName, false));
  };

  const rowKeyGetter = (row: SchemaDiffRow) => {
    const modelId = current?.id ?? base?.id;
    return `${modelId}-${row.name}`;
  };
  const cll = lineageViewContext?.viewOptions.column_level_lineage;
  const selectedRows: Set<Key> = cll ? new Set([`${cll.node}-${cll.column}`]) : new Set();

  return (
    <Flex direction="column">
      {catalogMissingMessage ? (
        <Alert status="warning" fontSize="12px" p="8px">
          <AlertIcon />
          {catalogMissingMessage}
        </Alert>
      ) : schemaMissingMessage ? (
        <Alert status="warning" fontSize="12px" p="8px">
          <AlertIcon />
          {schemaMissingMessage}
        </Alert>
      ) : (
        <></>
      )}

      {rows.length > 0 && (
        <>
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
            className="rdg-light"
            enableScreenshot={enableScreenshot}
            ref={ref}
            rowKeyGetter={rowKeyGetter}
            selectedRows={selectedRows}
            onSelectedRowsChange={() => {}}
            onCellClick={async (args: CellClickArgs<SchemaDiffRow>) => {
              await handleViewCll(args.row.name);
            }}
            rowClass={(row: SchemaDiffRow) => {
              if (row.baseIndex === undefined) {
                return "row-added";
              } else if (row.currentIndex === undefined) {
                return "row-removed";
              } else {
                return "row-normal";
              }
            }}
          />
        </>
      )}
    </Flex>
  );
}

export const SchemaView = forwardRef(PrivateSchemaView);
export const SingleEnvSchemaView = forwardRef(PrivateSingleEnvSchemaView);
