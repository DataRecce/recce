import type { LineageGraphNodes } from "../../contexts/lineage/types";
import { hasOwn } from "../../utils/hasOwn";

export const COLUMN_TRANSFORMATION_ORDER = [
  "passthrough",
  "renamed",
  "derived",
  "source",
  "unknown",
] as const;

export type ColumnTransformationType =
  (typeof COLUMN_TRANSFORMATION_ORDER)[number];

export interface ColumnTransformationDetails {
  letter: string;
  label: string;
  description: string;
  color: "default" | "warning" | "info" | "error";
}

export const COLUMN_TRANSFORMATION_DETAILS: Record<
  ColumnTransformationType,
  ColumnTransformationDetails
> = {
  passthrough: {
    letter: "P",
    label: "Passthrough",
    description: "Same-name reference to an upstream column",
    color: "default",
  },
  renamed: {
    letter: "R",
    label: "Renamed",
    description:
      "Direct upstream column reference with a different output name",
    color: "warning",
  },
  derived: {
    letter: "D",
    label: "Derived",
    description: "Expression derived from one or more upstream columns",
    color: "warning",
  },
  source: {
    letter: "S",
    label: "Source",
    description: "No upstream column dependency",
    color: "info",
  },
  unknown: {
    letter: "U",
    label: "Unknown",
    description: "Transformation could not be determined",
    color: "error",
  },
};

export function isColumnTransformationType(
  value: unknown,
): value is ColumnTransformationType {
  return (
    typeof value === "string" && hasOwn(COLUMN_TRANSFORMATION_DETAILS, value)
  );
}

/**
 * Return the transformation keys represented by chips in the current graph.
 *
 * A changed column replaces its transformation chip with a structural-change
 * indicator while its model is showing change analysis, so it must not add an
 * otherwise invisible key to the legend. The canonical order keeps the legend
 * stable as graph nodes are filtered or laid out differently.
 */
export function getDisplayedColumnTransformationTypes(
  nodes: LineageGraphNodes[],
  isModelShowingChangeAnalysis: (nodeId: string) => boolean,
): ColumnTransformationType[] {
  const displayedTypes = new Set<ColumnTransformationType>();

  for (const node of nodes) {
    if (node.type !== "lineageGraphColumnNode") continue;

    const { changeStatus, transformationType } = node.data;
    if (!isColumnTransformationType(transformationType)) continue;
    if (changeStatus && isModelShowingChangeAnalysis(node.data.node.id)) {
      continue;
    }
    displayedTypes.add(transformationType);
  }

  return COLUMN_TRANSFORMATION_ORDER.filter((type) => displayedTypes.has(type));
}
