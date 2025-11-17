import { forwardRef, Key, Ref, useMemo, useState } from "react";

import {
  mergeColumns,
  SchemaDiffRow,
  SchemaRow,
  toSchemaDataGrid,
  toSingleEnvDataGrid,
} from "./schema";
import "react-data-grid/lib/styles.css";
import { Alert, Flex } from "@chakra-ui/react";
import { CellMouseArgs, DataGridHandle } from "react-data-grid";
import { NodeData } from "@/lib/api/info";
import { trackColumnLevelLineage } from "@/lib/api/track";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { useLineageViewContext } from "../lineage/LineageViewContext";

interface SchemaViewProps {
  base?: NodeData;
  current?: NodeData;
  enableScreenshot?: boolean;
}

function PrivateSingleEnvSchemaView(
  { current }: { current?: NodeData },
  ref: Ref<DataGridHandle>,
) {
  const lineageViewContext = useLineageViewContext();
  const [cllRunningMap, setCllRunningMap] = useState<Map<string, boolean>>(
    new Map(),
  );
  const { columns, rows } = useMemo(() => {
    return toSingleEnvDataGrid(current?.columns, current, cllRunningMap);
  }, [current, cllRunningMap]);

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

  const rowKeyGetter = (row: SchemaDiffRow) => {
    const modelId = current?.id;
    return `${modelId}-${row.name}`;
  };
  const cll = lineageViewContext?.viewOptions.column_level_lineage;
  const selectedRows: Set<Key> = cll
    ? new Set([`${cll.node_id}-${cll.column}`])
    : new Set();

  return (
    <Flex direction="column">
      {catalogMissingMessage ? (
        <Alert.Root status="warning" fontSize="12px" p="8px">
          <Alert.Indicator />
          <Alert.Description>{catalogMissingMessage}</Alert.Description>
        </Alert.Root>
      ) : schemaMissingMessage ? (
        <Alert.Root status="warning" fontSize="12px" p="8px">
          <Alert.Indicator />
          <Alert.Description>{schemaMissingMessage}</Alert.Description>
        </Alert.Root>
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
          className="rdg-light"
          ref={ref}
          rowKeyGetter={rowKeyGetter}
          selectedRows={selectedRows}
          onSelectedRowsChange={() => {
            return void 0;
          }}
          onCellClick={async (args: CellMouseArgs<SchemaRow>) => {
            await handleViewCll(args.row.name);
          }}
          rowClass={() => {
            if (lineageViewContext !== undefined) {
              return "row-normal row-selectable";
            }
            return "row-normal";
          }}
        />
      )}
    </Flex>
  );
}

export function PrivateSchemaView(
  { base, current, enableScreenshot = false }: SchemaViewProps,
  ref: Ref<DataGridHandle>,
) {
  const lineageViewContext = useLineageViewContext();
  const [cllRunningMap, setCllRunningMap] = useState<Map<string, boolean>>(
    new Map(),
  );
  const { columns, rows } = useMemo(() => {
    const schemaDiff = mergeColumns(base?.columns, current?.columns);
    const resourceType = current?.resource_type ?? base?.resource_type;
    if (
      resourceType &&
      ["model", "seed", "snapshot", "source"].includes(resourceType)
    ) {
      return toSchemaDataGrid(schemaDiff, current ?? base, cllRunningMap);
    } else {
      return toSchemaDataGrid(schemaDiff);
    }
  }, [base, current, cllRunningMap]);

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
  } else if (noSchemaBase) {
    schemaMissingMessage =
      "catalog.json is outdated on base environment. Update catalog.json to get schema information.";
  } else if (noSchemaCurrent) {
    schemaMissingMessage =
      "catalog.json is outdated on current environment. Update catalog.json to get schema information.";
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

  const rowKeyGetter = (row: SchemaDiffRow) => {
    const modelId = current?.id ?? base?.id;
    return `${modelId}-${row.name}`;
  };
  const cll = lineageViewContext?.viewOptions.column_level_lineage;
  const selectedRows: Set<Key> = cll
    ? new Set([`${cll.node_id}-${cll.column}`])
    : new Set();

  return (
    <Flex direction="column">
      {catalogMissingMessage ? (
        <Alert.Root status="warning" fontSize="12px" p="8px">
          <Alert.Indicator />
          <Alert.Description>{catalogMissingMessage}</Alert.Description>
        </Alert.Root>
      ) : schemaMissingMessage ? (
        <Alert.Root status="warning" fontSize="12px" p="8px">
          <Alert.Indicator />
          <Alert.Description>{schemaMissingMessage}</Alert.Description>
        </Alert.Root>
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
          rowKeyGetter={rowKeyGetter}
          selectedRows={selectedRows}
          onSelectedRowsChange={() => {
            return void 0;
          }}
          onCellClick={async (args: CellMouseArgs<SchemaDiffRow>) => {
            if (
              args.row.baseIndex !== undefined &&
              args.row.currentIndex === undefined
            ) {
              return;
            }
            await handleViewCll(args.row.name);
          }}
          rowClass={(row: SchemaDiffRow) => {
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
          }}
        />
      )}
    </Flex>
  );
}

export const SchemaView = forwardRef(PrivateSchemaView);
export const SingleEnvSchemaView = forwardRef(PrivateSingleEnvSchemaView);
