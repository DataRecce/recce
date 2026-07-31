import type { ChangeCategory } from "./nodes/LineageNode";

export const CHANGE_CATEGORY_LABELS: Record<ChangeCategory, string> = {
  breaking: "Model-Wide Change", // wire-enum-ok
  partial_breaking: "Column Change", // wire-enum-ok
  non_breaking: "Additive Change", // wire-enum-ok
  unknown: "Unknown",
};

export const CHANGE_CATEGORY_DETAILS: ReadonlyArray<{
  category: ChangeCategory;
  description: string;
}> = [
  {
    category: "breaking", // wire-enum-ok
    description: "Change affects the model as a whole",
  },
  {
    category: "partial_breaking", // wire-enum-ok
    description: "Change is scoped to specific columns",
  },
  {
    category: "non_breaking", // wire-enum-ok
    description: "Change only adds new columns or structure",
  },
  {
    category: "unknown",
    description: "Change category could not be determined",
  },
];

function isChangeCategory(value: string | undefined): value is ChangeCategory {
  return value !== undefined && Object.hasOwn(CHANGE_CATEGORY_LABELS, value);
}

export function getChangeCategoryLabel(
  category: string | undefined,
): string | undefined {
  return isChangeCategory(category)
    ? CHANGE_CATEGORY_LABELS[category]
    : undefined;
}

export function resolveChangeCategory(
  cllCategory: string | undefined,
  lineageCategory: string | undefined,
): ChangeCategory | undefined {
  if (isChangeCategory(cllCategory)) {
    return cllCategory;
  }
  return isChangeCategory(lineageCategory) ? lineageCategory : undefined;
}
