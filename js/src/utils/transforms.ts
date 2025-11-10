import { DataFrame, RowDataTypes, RowObjectType } from "@/lib/api/types";

export function dataFrameToRowObjects(dataFrame: DataFrame): RowObjectType[] {
  return dataFrame.data.map((row, index) => ({
    ...dataFrame.columns.reduce<Record<string, RowDataTypes>>((obj, column, colIndex) => {
      obj[column.name] = row[colIndex];
      return obj;
    }, {}),
    __status: undefined,
    _index: index + 1,
  }));
}

export function keyToNumber(key: string): number {
  // Try to parse as a number first
  const parsed = Number(key);

  // Check if it's a valid number (not NaN, not Infinity)
  if (!isNaN(parsed) && isFinite(parsed)) {
    return parsed;
  }

  // If not a number, hash the string to a stable numeric value
  return hashStringToNumber(key);
}

/**
 * Hashes a string to a stable numeric value using a simple hash algorithm
 * Based on the Java String.hashCode() implementation
 */
export function hashStringToNumber(str: string): number {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Return absolute value to ensure positive numbers
  return Math.abs(hash);
}
