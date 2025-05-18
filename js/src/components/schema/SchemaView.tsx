import { forwardRef, Key, useMemo, useState } from "react";

import { mergeColumns, toDataGrid, toSingleEnvDataGrid } from "./schema";
import "react-data-grid/lib/styles.css";
import { Flex, Alert, AlertIcon } from "@chakra-ui/react";
import { EmptyRowsRenderer, ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { NodeData } from "@/lib/api/info";
import { trackColumnLevelLineage } from "@/lib/api/track";
import { useLineageViewContext } from "../lineage/LineageViewContext";

interface SchemaViewProps {
  base?: NodeData;
  current?: NodeData;
  enableScreenshot?: boolean;
}

function PrivateSingleEnvSchemaView({ current }: { current?: NodeData }, ref: any) {
  const { columns, rows } = useMemo(() => {
    return toSingleEnvDataGrid(current?.columns, current);
  }, [current]);

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
  const [cllRunning, setCllRunning] = useState(false);
  const { columns, rows } = useMemo(() => {
    const schemaDiff = mergeColumns(base?.columns, current?.columns);
    const resourceType = current?.resource_type ?? base?.resource_type;
    if (resourceType && ["model", "seed", "snapshot", "source"].includes(resourceType)) {
      return toDataGrid(schemaDiff, current ?? base, cllRunning);
    } else {
      return toDataGrid(schemaDiff);
    }
  }, [base, current, cllRunning]);

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
    setCllRunning(true);
    const modelId = current?.id ?? base?.id;
    if (modelId) {
      await lineageViewContext?.showColumnLevelLineage(modelId, columnName);
    }
    setCllRunning(false);
  };

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
            onCellClick={async (args) => {
              await handleViewCll(args.row.name);
            }}
          />
        </>
      )}
    </Flex>
  );
}

export const SchemaView = forwardRef(PrivateSchemaView);
export const SingleEnvSchemaView = forwardRef(PrivateSingleEnvSchemaView);
