export interface ColumnTooltipInput {
  name: string;
  status?:
    | "added"
    | "removed"
    | "type_changed"
    | "definition_changed"
    | "unchanged";
  baseType?: string;
  currentType?: string;
  cllAvailable?: boolean;
}

export function buildColumnTooltip(input: ColumnTooltipInput): string {
  const { name, status, baseType, currentType, cllAvailable } = input;

  let text: string;

  switch (status) {
    case "added":
      text = currentType ? `${name} added ${currentType}` : `${name} added`;
      break;

    case "removed":
      // Removed columns never get the CLL suffix
      return `deleted ${name}`;

    case "type_changed":
      text = `${name}, was ${baseType} now ${currentType}`;
      break;

    case "definition_changed":
      text = currentType
        ? `${name} ${currentType} changed definition`
        : `${name} changed definition`;
      break;

    case "unchanged":
      text = currentType ? `${name} ${currentType}` : name;
      break;

    default: {
      // No status provided — infer from types
      if (baseType && currentType && baseType !== currentType) {
        text = `${name}, was ${baseType} now ${currentType}`;
      } else if (currentType) {
        text = `${name} ${currentType}`;
      } else {
        text = name;
      }
      break;
    }
  }

  if (cllAvailable) {
    text += " \u00b7 Click for column lineage";
  }

  return text;
}
