/**
 * @file validation.ts
 * @description Input validation utilities for data grid generation
 *
 * Provides clear, actionable error messages for common issues:
 * - Malformed DataFrame structure
 * - Column-data misalignment
 * - Missing required fields
 *
 * These validations run at entry points (toDataGrid, toDataDiffGrid, toValueDiffGrid)
 * to fail fast with helpful messages rather than cryptic runtime errors.
 */

import type { DataFrame } from "../../api";

// ============================================================================
// Custom Error Class
// ============================================================================

/**
 * Custom error class for data grid validation failures.
 * Provides structured error information for debugging.
 */
export class DataGridValidationError extends Error {
  constructor(
    message: string,
    public readonly context?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(context ? `[${context}] ${message}` : message);
    this.name = "DataGridValidationError";
  }
}

// ============================================================================
// DataFrame Validation
// ============================================================================

/**
 * Validates that a DataFrame has the required structure.
 * Does NOT throw for undefined/null - those are valid (represent empty data).
 *
 * @param df - The DataFrame to validate
 * @param name - Name for error messages (e.g., "base", "current")
 * @throws DataGridValidationError if structure is invalid
 */
export function validateDataFrame(
  df: DataFrame | undefined | null,
  name = "DataFrame",
): void {
  // undefined/null is valid - represents empty/missing data
  if (df === undefined || df === null) {
    return;
  }

  // Must be an object
  if (typeof df !== "object") {
    throw new DataGridValidationError(
      `Expected an object, got ${typeof df}`,
      name,
    );
  }

  // Must have columns array
  if (!("columns" in df)) {
    throw new DataGridValidationError("Missing 'columns' property", name, {
      receivedKeys: Object.keys(df),
    });
  }

  if (!Array.isArray(df.columns)) {
    throw new DataGridValidationError(
      `'columns' must be an array, got ${typeof df.columns}`,
      name,
    );
  }

  // Must have data array
  if (!("data" in df)) {
    throw new DataGridValidationError("Missing 'data' property", name, {
      receivedKeys: Object.keys(df),
    });
  }

  if (!Array.isArray(df.data)) {
    throw new DataGridValidationError(
      `'data' must be an array, got ${typeof df.data}`,
      name,
    );
  }

  // Validate column structure
  validateColumns(df.columns, name);

  // Validate column-data alignment (only if there's data)
  if (df.data.length > 0) {
    validateColumnDataAlignment(df, name);
  }
}

/**
 * Validates that columns have required properties.
 *
 * @param columns - Array of column definitions
 * @param context - Context for error messages
 * @throws DataGridValidationError if any column is malformed
 */
export function validateColumns(
  columns: DataFrame["columns"],
  context = "DataFrame",
): void {
  columns.forEach((col, index) => {
    if (!col || typeof col !== "object") {
      throw new DataGridValidationError(
        `Column at index ${index} is not an object`,
        context,
        { column: col },
      );
    }

    // noinspection SuspiciousTypeOfGuard
    if (typeof col.key !== "string" || col.key === "") {
      throw new DataGridValidationError(
        `Column at index ${index} has invalid 'key': expected non-empty string, got ${JSON.stringify(col.key)}`,
        context,
        { column: col },
      );
    }

    // noinspection SuspiciousTypeOfGuard
    if (typeof col.name !== "string") {
      throw new DataGridValidationError(
        `Column '${col.key}' has invalid 'name': expected string, got ${typeof col.name}`,
        context,
        { column: col },
      );
    }

    // noinspection SuspiciousTypeOfGuard
    if (typeof col.type !== "string") {
      throw new DataGridValidationError(
        `Column '${col.key}' has invalid 'type': expected string, got ${typeof col.type}`,
        context,
        { column: col },
      );
    }
  });
}

/**
 * Validates that data rows match column count.
 *
 * @param df - The DataFrame to validate
 * @param context - Context for error messages
 * @throws DataGridValidationError if misalignment detected
 */
export function validateColumnDataAlignment(
  df: DataFrame,
  context = "DataFrame",
): void {
  const columnCount = df.columns.length;

  for (let i = 0; i < df.data.length; i++) {
    const row = df.data[i];

    if (!Array.isArray(row)) {
      throw new DataGridValidationError(
        `Row at index ${i} is not an array`,
        context,
        { row, rowType: typeof row },
      );
    }

    if (row.length !== columnCount) {
      throw new DataGridValidationError(
        `Row ${i} has ${row.length} values but expected ${columnCount} (column count)`,
        context,
        {
          rowIndex: i,
          rowLength: row.length,
          columnCount,
          columns: df.columns.map((c) => c.key),
        },
      );
    }
  }
}

// ============================================================================
// Primary Key Validation
// ============================================================================

/**
 * Validates primary key configuration.
 *
 * @param primaryKeys - Array of primary key column names
 * @param columns - Available columns to check against
 * @param options - Validation options
 * @throws DataGridValidationError if validation fails
 */
export function validatePrimaryKeyConfig(
  primaryKeys: string[] | undefined,
  columns: DataFrame["columns"],
  options: {
    required?: boolean;
    caseInsensitive?: boolean;
    context?: string;
  } = {},
): void {
  const {
    required = false,
    caseInsensitive = false,
    context = "primaryKeys",
  } = options;

  // Check if required
  if (required && (!primaryKeys || primaryKeys.length === 0)) {
    throw new DataGridValidationError(
      "Primary keys are required but none were provided",
      context,
    );
  }

  // If no PKs provided and not required, that's fine
  if (!primaryKeys || primaryKeys.length === 0) {
    return;
  }

  // Validate each PK exists
  const columnKeys = columns.map((c) => c.key);
  const columnKeysLower = caseInsensitive
    ? columnKeys.map((k) => k.toLowerCase())
    : columnKeys;

  for (const pk of primaryKeys) {
    const pkToFind = caseInsensitive ? pk.toLowerCase() : pk;
    const found = caseInsensitive
      ? columnKeysLower.includes(pkToFind)
      : columnKeys.includes(pk);

    if (!found) {
      throw new DataGridValidationError(
        `Primary key column '${pk}' not found in columns`,
        context,
        {
          requestedKey: pk,
          availableColumns: columnKeys,
          caseInsensitive,
        },
      );
    }
  }

  // Check for duplicate PKs
  const seen = new Set<string>();
  for (const pk of primaryKeys) {
    const normalized = caseInsensitive ? pk.toLowerCase() : pk;
    if (seen.has(normalized)) {
      throw new DataGridValidationError(
        `Duplicate primary key: '${pk}'`,
        context,
        { primaryKeys },
      );
    }
    seen.add(normalized);
  }
}

// ============================================================================
// Convenience Validators for Entry Points
// ============================================================================

/**
 * Validates inputs for toDataGrid (single DataFrame).
 */
export function validateToDataGridInputs(
  df: DataFrame | undefined,
  options?: { primaryKeys?: string[] },
): void {
  validateDataFrame(df, "dataframe");

  if (df && options?.primaryKeys) {
    validatePrimaryKeyConfig(options.primaryKeys, df.columns, {
      context: "toDataGrid",
    });
  }
}

/**
 * Validates inputs for toDataDiffGrid (base + current DataFrames).
 */
export function validateToDataDiffGridInputs(
  base: DataFrame | undefined,
  current: DataFrame | undefined,
  options?: { primaryKeys?: string[] },
): void {
  validateDataFrame(base, "base");
  validateDataFrame(current, "current");

  // If PKs provided, they should exist in at least one of the DataFrames
  if (options?.primaryKeys && options.primaryKeys.length > 0) {
    const baseColumns = base?.columns ?? [];
    const currentColumns = current?.columns ?? [];
    const allColumnKeys = new Set([
      ...baseColumns.map((c) => c.key),
      ...currentColumns.map((c) => c.key),
    ]);

    for (const pk of options.primaryKeys) {
      if (!allColumnKeys.has(pk)) {
        throw new DataGridValidationError(
          `Primary key column '${pk}' not found in either base or current DataFrame`,
          "toDataDiffGrid",
          {
            requestedKey: pk,
            baseColumns: baseColumns.map((c) => c.key),
            currentColumns: currentColumns.map((c) => c.key),
          },
        );
      }
    }
  }
}

/**
 * Validates inputs for toValueDiffGrid
 *
 * @throws {DataGridValidationError} If validation fails
 */
export function validateToValueDiffGridInputs(
  df: DataFrame | undefined,
  primaryKeys: string[],
): void {
  // Validate DataFrame exists
  if (!df) {
    throw new DataGridValidationError("DataFrame is required for value diff");
  }

  // Validate DataFrame structure
  validateDataFrame(df);

  // Validate primary keys are provided (valuediff requires PKs)
  if (!primaryKeys || primaryKeys.length === 0) {
    throw new DataGridValidationError(
      "Primary keys are required for value diff",
    );
  }

  // Validate primary keys exist in columns (exact matching)
  validatePrimaryKeyConfig(primaryKeys, df.columns, {
    required: true,
    context: "toValueDiffGrid",
  });

  // Validate in_a/in_b columns exist (lowercase, guaranteed by backend)
  const columnKeys = df.columns.map((c) => c.key);
  if (!columnKeys.includes("in_a")) {
    throw new DataGridValidationError(
      "Value diff DataFrame must include lowercase 'in_a' column",
    );
  }
  if (!columnKeys.includes("in_b")) {
    throw new DataGridValidationError(
      "Value diff DataFrame must include lowercase 'in_b' column",
    );
  }
}
