/**
 * @file utils.test.ts
 * @description Tests for check utility functions
 */

import {
  buildCheckDescription,
  buildCheckTitle,
  formatSqlAsMarkdown,
  isDisabledByNoResult,
} from "./utils";

describe("buildCheckTitle", () => {
  it("returns name without checkmark when not checked", () => {
    const result = buildCheckTitle({ name: "Schema check", isChecked: false });
    expect(result).toBe("Schema check");
  });

  it("returns name with checkmark when checked", () => {
    const result = buildCheckTitle({ name: "Schema check", isChecked: true });
    expect(result).toBe("✅ Schema check");
  });

  it("handles undefined isChecked as unchecked", () => {
    const result = buildCheckTitle({ name: "Test check" });
    expect(result).toBe("Test check");
  });
});

describe("buildCheckDescription", () => {
  it("returns description when provided", () => {
    const result = buildCheckDescription({
      description: "This is a test description",
    });
    expect(result).toBe("This is a test description");
  });

  it("returns fallback for empty string", () => {
    const result = buildCheckDescription({ description: "" });
    expect(result).toBe("_(no description)_");
  });

  it("returns fallback for null", () => {
    const result = buildCheckDescription({ description: null });
    expect(result).toBe("_(no description)_");
  });

  it("returns fallback for undefined", () => {
    const result = buildCheckDescription({ description: undefined });
    expect(result).toBe("_(no description)_");
  });

  it("uses custom fallback when provided", () => {
    const result = buildCheckDescription({
      description: "",
      fallback: "No description provided",
    });
    expect(result).toBe("No description provided");
  });
});

describe("isDisabledByNoResult", () => {
  it("returns false for schema_diff regardless of result", () => {
    expect(
      isDisabledByNoResult({
        type: "schema_diff",
        hasResult: false,
        hasError: false,
      }),
    ).toBe(false);
  });

  it("returns false for lineage_diff regardless of result", () => {
    expect(
      isDisabledByNoResult({
        type: "lineage_diff",
        hasResult: false,
        hasError: false,
      }),
    ).toBe(false);
  });

  it("returns true for other types when no result", () => {
    expect(
      isDisabledByNoResult({
        type: "row_count_diff",
        hasResult: false,
        hasError: false,
      }),
    ).toBe(true);
  });

  it("returns true when has error", () => {
    expect(
      isDisabledByNoResult({
        type: "row_count_diff",
        hasResult: true,
        hasError: true,
      }),
    ).toBe(true);
  });

  it("returns false when has result and no error", () => {
    expect(
      isDisabledByNoResult({
        type: "row_count_diff",
        hasResult: true,
        hasError: false,
      }),
    ).toBe(false);
  });
});

describe("formatSqlAsMarkdown", () => {
  it("formats SQL as markdown code block", () => {
    const result = formatSqlAsMarkdown({ sql: "SELECT * FROM users" });
    expect(result).toBe(`**SQL**
\`\`\`sql
SELECT * FROM users
\`\`\``);
  });

  it("uses custom label when provided", () => {
    const result = formatSqlAsMarkdown({
      sql: "SELECT 1",
      label: "Query",
    });
    expect(result).toBe(`**Query**
\`\`\`sql
SELECT 1
\`\`\``);
  });

  it("handles multiline SQL", () => {
    const sql = `SELECT
  id,
  name
FROM users
WHERE active = true`;
    const result = formatSqlAsMarkdown({ sql });
    expect(result).toContain("SELECT");
    expect(result).toContain("FROM users");
    expect(result).toContain("WHERE active = true");
  });
});
