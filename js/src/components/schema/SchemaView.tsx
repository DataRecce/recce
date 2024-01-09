import { useMemo } from "react";
import { NodeColumnData, NodeData } from "../lineage/lineage";
import { mergeColumns, toDataGrid } from "./schema";
import "react-data-grid/lib/styles.css";
import DataGrid from "react-data-grid";
import { Flex, Alert, AlertIcon } from "@chakra-ui/react";
import { useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";

interface SchemaViewProps {
  base?: NodeData;
  current?: NodeData;
  enableScreenShot?: boolean;
}

export function SchemaView({ base, current , enableScreenShot=false }: SchemaViewProps) {
  const { columns, rows } = useMemo(
    () => toDataGrid(mergeColumns(base?.columns, current?.columns)),
    [base, current],
  );
  const { ref, CopyToClipboardButton } = useCopyToClipboardButton();
  const noCatalogBase = base && base.columns === undefined;
  const noCatalogCurrent = current && current.columns === undefined;
  let catalogMissingMessage = undefined;
  if (noCatalogBase && noCatalogCurrent) {
    catalogMissingMessage =
      "catalog.json is missing on both current and base environments.";
  } else if (noCatalogBase) {
    catalogMissingMessage = "catalog.json is missing on base environment.";
  } else if (noCatalogCurrent) {
    catalogMissingMessage = "catalog.json is missing on current environment.";
  }

  return (
    <Flex direction="column">
      {catalogMissingMessage && (
        <Alert status="warning" fontSize="12px" p="8px">
          <AlertIcon />
          {catalogMissingMessage}
        </Alert>
      )}

      {rows.length > 0 && (<>
        <DataGrid
          ref={ref}
          style={{
            height: "100%",

            fontSize: "10pt",
            borderWidth: 1,
            overflowY: "auto",
          }}
          columns={columns}
          rows={rows}
          className="rdg-light"
        />
        {enableScreenShot && <CopyToClipboardButton imageType="png" />}
    </>)}
    </Flex>
  );
}
