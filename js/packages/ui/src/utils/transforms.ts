/**
 * @file transforms.ts
 * @description Data transformation utilities for DataFrame and row objects
 *
 * Provides utilities for:
 * - Converting DataFrames to row objects
 * - Case-insensitive property access
 * - String to number conversions with hashing
 */

import type { DataFrame, RowDataTypes, RowObjectType } from "../api";

/**
 * Converts a DataFrame to an array of row objects.
 *
 * Each row becomes an object with column keys as properties,
 * plus __status (undefined) and _index (1-based) fields.
 *
 * @param dataFrame - The DataFrame to convert
 * @returns Array of row objects with column values and metadata
 *
 * @example
 * ```ts
 * const df = {
 *   columns: [{ key: 'name' }, { key: 'age' }],
 *   data: [['Alice', 30], ['Bob', 25]]
 * };
 * const rows = dataFrameToRowObjects(df);
 * // [
 * //   { name: 'Alice', age: 30, __status: undefined, _index: 1 },
 * //   { name: 'Bob', age: 25, __status: undefined, _index: 2 }
 * // ]
 * ```
 */
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

/**
 * Converts a key string to a number.
 *
 * If the key is a valid number, it is parsed and returned.
 * Otherwise, the string is hashed to a stable numeric value.
 *
 * @param key - The key to convert
 * @returns A numeric representation of the key
 *
 * @example
 * ```ts
 * keyToNumber('123')    // 123
 * keyToNumber('abc')    // stable hash value
 * keyToNumber('-45.6')  // -45.6
 * ```
 */
export function keyToNumber(key: string): number {
  // Try to parse as a number first
  const parsed = Number(key);

  // Check if it's a valid number (not NaN, not Infinity)
  if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
    return parsed;
  }

  // If not a number, hash the string to a stable numeric value
  return hashStringToNumber(key);
}

/**
 * Hashes a string to a stable numeric value.
 *
 * Uses a simple hash algorithm based on Java's String.hashCode().
 * Always returns a non-negative integer.
 *
 * @param str - The string to hash
 * @returns A non-negative integer hash value
 *
 * @example
 * ```ts
 * hashStringToNumber('hello')  // same value every time
 * hashStringToNumber('')       // 0
 * ```
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

/**
 * Gets a property value from an object using case-insensitive key matching.
 *
 * First tries lowercase match, then falls back to case-insensitive search.
 *
 * @param obj - The object to search
 * @param key - The property key (case-insensitive)
 * @returns The property value, or undefined if not found
 *
 * @example
 * ```ts
 * const obj = { Name: 'Alice', AGE: 30 };
 * getCaseInsensitive(obj, 'name')  // 'Alice'
 * getCaseInsensitive(obj, 'age')   // 30
 * getCaseInsensitive(obj, 'foo')   // undefined
 * ```
 */
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

/**
 * Gets a value from an object at a given path, with case-insensitive matching.
 *
 * Tries lowercase, then uppercase, then exact match.
 *
 * @param obj - The object to search
 * @param path - The property path (case-insensitive)
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * ```ts
 * const obj = { Name: 'Alice', AGE: 30 };
 * getValueAtPath(obj, 'name')  // 'Alice'
 * getValueAtPath(obj, 'AGE')   // 30
 * getValueAtPath(obj, 'foo')   // undefined
 * ```
 */
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
