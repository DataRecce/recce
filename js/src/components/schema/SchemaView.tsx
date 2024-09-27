import { useMemo } from "react";

import { mergeColumns, toDataGrid } from "./schema";
import "react-data-grid/lib/styles.css";
import { Flex, Alert, AlertIcon } from "@chakra-ui/react";
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { NodeData } from "@/lib/api/info";

interface SchemaViewProps {
  base?: NodeData;
  current?: NodeData;
  enableScreenshot?: boolean;
}

export function SchemaView({
  base,
  current,
  enableScreenshot = false,
}: SchemaViewProps) {
  const { columns, rows } = useMemo(
    () =>
      toDataGrid(
        current?.name || base?.name,
        mergeColumns(base?.columns, current?.columns)
      ),
    [base, current]
  );

  const { lineageGraph } = useLineageGraphContext();
  const noCatalogBase = !lineageGraph?.catalogMetadata.base;
  const noCatalogCurrent = !lineageGraph?.catalogMetadata.current;
  let catalogMissingMessage = undefined;
  if (noCatalogBase && noCatalogCurrent) {
    catalogMissingMessage =
      "catalog.json is missing on both current and base environments.";
  } else if (noCatalogBase) {
    catalogMissingMessage = "catalog.json is missing on base environment.";
  } else if (noCatalogCurrent) {
    catalogMissingMessage = "catalog.json is missing on current environment.";
  }

  const noSchemaBase = base && base.columns === undefined;
  const noSchemaCurrent = current && current.columns === undefined;
  let schemaMissingMessage = undefined;
  if (noSchemaBase && noSchemaCurrent) {
    schemaMissingMessage =
      "Schema information is missing on both current and base environments.";
  } else if (noSchemaBase) {
    schemaMissingMessage = "Schema information is missing on base environment.";
  } else if (noSchemaCurrent) {
    schemaMissingMessage =
      "Schema information is missing on current environment.";
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
            enableScreenshot={enableScreenshot}
          />
        </>
      )}
    </Flex>
  );
}
