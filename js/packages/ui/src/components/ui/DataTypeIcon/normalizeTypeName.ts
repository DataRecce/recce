import { classifyType } from "./classifyType";

const TYPE_NAME_ALIASES: Readonly<Record<string, string>> = {
  "CHARACTER VARYING": "VARCHAR",
  "DOUBLE PRECISION": "DOUBLE",
};

/**
 * Canonicalizes a known database type for tooltip display.
 *
 * Parameters and suffixes are preserved, while unknown or custom types are
 * returned exactly as received.
 */
export function normalizeTypeName(rawType: string): string {
  const trimmed = rawType.trim();
  if (!trimmed) return "";

  const suffixIndex = trimmed.search(/[([]/);
  const rawBase = suffixIndex === -1 ? trimmed : trimmed.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : trimmed.slice(suffixIndex);
  const foldedBase = rawBase.trimEnd().toUpperCase();

  if (classifyType(foldedBase) === "unknown") {
    return rawType;
  }

  return `${TYPE_NAME_ALIASES[foldedBase] ?? foldedBase}${suffix}`;
}
