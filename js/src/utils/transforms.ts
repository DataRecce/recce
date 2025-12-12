import { DataFrame, RowDataTypes, RowObjectType } from "@/lib/api/types";

export function dataFrameToRowObjects(dataFrame: DataFrame): RowObjectType[] {
  return dataFrame.data.map((row, index) => ({
    ...dataFrame.columns.reduce<Record<string, RowDataTypes>>(
      (obj, column, colIndex) => {
        obj[column.key] = row[colIndex];
        return obj;
      },
      {},
    ),
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

export function getCaseInsensitive<T extends RowObjectType>(
  obj: T,
  key: string,
): T[keyof T] | undefined {
  const lowerKey = key.toLowerCase();

  // First try lowercase
  if (lowerKey in obj) {
    return obj[lowerKey as keyof T];
  }

  // Fall back to case-insensitive search
  const foundKey = Object.keys(obj).find((k) => k.toLowerCase() === lowerKey) as
    | keyof T
    | undefined;

  return foundKey ? obj[foundKey] : undefined;
}

// Get the value of an object at a given path, case-insensitively
export function getValueAtPath<T = RowDataTypes>(
  obj: Record<string, T | undefined>,
  path: string,
): T | undefined {
  let col = obj[path.toLowerCase()];
  if (!col) {
    // try upper-case match
    col = obj[path.toUpperCase()];
  }
  if (!col) {
    // try fallback with strict casing match
    col = obj[path];
  }
  return col;
}
