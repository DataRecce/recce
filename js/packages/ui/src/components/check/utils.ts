/**
 * Utility functions for check components
 */

/**
 * Build a title string for a check with optional approval indicator
 *
 * @example
 * ```ts
 * const title = buildCheckTitle({ name: "Schema check", isChecked: true });
 * // Returns: "✅ Schema check"
 * ```
 */
export function buildCheckTitle({
  name,
  isChecked,
}: {
  name: string;
  isChecked?: boolean;
}): string {
  return `${isChecked ? "✅ " : ""}${name}`;
}

/**
 * Build a description string with fallback for empty descriptions
 *
 * @example
 * ```ts
 * const desc = buildCheckDescription({ description: "" });
 * // Returns: "_(no description)_"
 * ```
 */
export function buildCheckDescription({
  description,
  fallback = "_(no description)_",
}: {
  description?: string | null;
  fallback?: string;
}): string {
  return (description ?? "") || fallback;
}

/**
 * Check if a run result is missing or has an error
 *
 * Certain check types (schema_diff, lineage_diff) don't require results
 * to enable approval functionality.
 *
 * @example
 * ```ts
 * const disabled = isDisabledByNoResult({
 *   type: "row_count_diff",
 *   hasResult: false,
 *   hasError: false,
 * });
 * // Returns: true
 *
 * const enabled = isDisabledByNoResult({
 *   type: "schema_diff",
 *   hasResult: false,
 *   hasError: false,
 * });
 * // Returns: false (schema_diff doesn't require results)
 * ```
 */
export function isDisabledByNoResult({
  type,
  hasResult,
  hasError,
}: {
  type: string;
  hasResult: boolean;
  hasError: boolean;
}): boolean {
  // These types don't require results to enable approval
  if (type === "schema_diff" || type === "lineage_diff") {
    return false;
  }
  return !hasResult || hasError;
}

/**
 * Format SQL as a markdown code block
 *
 * @example
 * ```ts
 * const markdown = formatSqlAsMarkdown({ sql: "SELECT * FROM users" });
 * // Returns:
 * // **SQL**
 * // ```sql
 * // SELECT * FROM users
 * // ```
 * ```
 */
export function formatSqlAsMarkdown({
  sql,
  label = "SQL",
}: {
  sql: string;
  label?: string;
}): string {
  return `**${label}**
\`\`\`sql
${sql}
\`\`\``;
}
