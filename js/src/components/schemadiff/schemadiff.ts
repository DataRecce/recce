import { mergeKeysWithStatus } from "@/mergeKeys";
import { NodeData } from "../lineagediff/lineagediff";

interface SchemaDiff {
  [key: string]: {
    reordered?: boolean;
    currentIndex?: number;
    baseIndex?: number;
    currentType?: string;
    baseType?: string;
  };
}

export function mergeColumns(
  baseColumns: NodeData["columns"],
  currentColumns: NodeData["columns"]
): SchemaDiff | undefined {
  if (baseColumns === undefined || currentColumns === undefined) {
    return undefined;
  }

  const result: SchemaDiff = {};
  const mergedStatus = mergeKeysWithStatus(
    Object.keys(baseColumns),
    Object.keys(currentColumns)
  );

  Object.entries(mergedStatus).forEach(([name, status]) => {
    result[name] = {
      reordered: status === "reordered",
    };
  });

  Object.entries(baseColumns).map(([name, column], index) => {
    result[name].baseIndex = index + 1;
    result[name].baseType = column.type;
  });

  Object.entries(currentColumns).map(([name, column], index) => {
    result[name].currentIndex = index + 1;
    result[name].currentType = column.type;
  });

  return result;
}
