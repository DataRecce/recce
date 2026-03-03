// packages/ui/src/api/types/base.ts
// Foundational data types for @datarecce/ui API layer
// These types are used across all API files and consumers

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Query parameters for Axios requests
 * Supports string, number, and array values with undefined for optional params
 */
export type AxiosQueryParams = Record<
  string,
  string | string[] | number | number[] | undefined
>;

// ============================================================================
// Data Types
// ============================================================================

/**
 * Primitive data types that can appear in a row
 */
export type RowDataTypes = number | string | boolean | null | undefined;

/**
 * A single row of data represented as an array of primitive values
 */
export type RowData = RowDataTypes[];

/**
 * A row of data represented as an object with named columns
 * Includes metadata for diff status and optional index
 */
export type RowObjectType = Record<string, RowDataTypes> & {
  __status: "added" | "removed" | "modified" | undefined;
  _index?: number;
};

// ============================================================================
// Column Types
// ============================================================================

/**
 * Supported column data types for schema and display purposes
 */
export type ColumnType =
  | "number"
  | "integer"
  | "text"
  | "boolean"
  | "date"
  | "datetime"
  | "timedelta"
  | "unknown";

/**
 * Column rendering modes for display formatting
 * - raw: display value as-is
 * - percent: display as percentage
 * - delta: display as delta/change value
 * - 2: display with 2 decimal places
 */
export type ColumnRenderMode = "raw" | "percent" | "delta" | 2;

// ============================================================================
// DataFrame Types
// ============================================================================

/**
 * A DataFrame represents tabular data with typed columns
 * Used for query results, profile data, and other tabular responses
 */
export interface DataFrame {
  columns: {
    key: string;
    name: string;
    type: ColumnType;
  }[];
  data: RowData[];
  /** Maximum number of rows requested */
  limit?: number;
  /** Whether more rows are available beyond the limit */
  more?: boolean;
}
