import type { NodeData } from "../api";
import { isSchemaChanged } from "./schemaDiff";

type ColumnsType = NodeData["columns"];

describe("isSchemaChanged", () => {
  describe("undefined/null handling", () => {
    test("returns undefined when both schemas are undefined", () => {
      expect(isSchemaChanged(undefined, undefined)).toBeUndefined();
    });

    test("returns undefined when base schema is undefined", () => {
      const curr: ColumnsType = { id: { name: "id", type: "integer" } };
      expect(isSchemaChanged(undefined, curr)).toBeUndefined();
    });

    test("returns undefined when current schema is undefined", () => {
      const base: ColumnsType = { id: { name: "id", type: "integer" } };
      expect(isSchemaChanged(base, undefined)).toBeUndefined();
    });
  });

  describe("column additions/removals", () => {
    test("returns true when column is added", () => {
      const base: ColumnsType = {
        id: { name: "id", type: "integer" },
      };
      const curr: ColumnsType = {
        id: { name: "id", type: "integer" },
        name: { name: "name", type: "string" },
      };
      expect(isSchemaChanged(base, curr)).toBe(true);
    });

    test("returns true when column is removed", () => {
      const base: ColumnsType = {
        id: { name: "id", type: "integer" },
        name: { name: "name", type: "string" },
      };
      const curr: ColumnsType = {
        id: { name: "id", type: "integer" },
      };
      expect(isSchemaChanged(base, curr)).toBe(true);
    });

    test("returns true when multiple columns added", () => {
      const base: ColumnsType = {};
      const curr: ColumnsType = {
        id: { name: "id", type: "integer" },
        name: { name: "name", type: "string" },
      };
      expect(isSchemaChanged(base, curr)).toBe(true);
    });

    test("returns true when all columns removed", () => {
      const base: ColumnsType = {
        id: { name: "id", type: "integer" },
        name: { name: "name", type: "string" },
      };
      const curr: ColumnsType = {};
      expect(isSchemaChanged(base, curr)).toBe(true);
    });
  });

  describe("column reordering", () => {
    test("returns true when columns are reordered", () => {
      const base: ColumnsType = {
        id: { name: "id", type: "integer" },
        name: { name: "name", type: "string" },
      };
      const curr: ColumnsType = {
        name: { name: "name", type: "string" },
        id: { name: "id", type: "integer" },
      };
      expect(isSchemaChanged(base, curr)).toBe(true);
    });

    test("returns true when three columns are reordered", () => {
      const base: ColumnsType = {
        a: { name: "a", type: "integer" },
        b: { name: "b", type: "string" },
        c: { name: "c", type: "boolean" },
      };
      const curr: ColumnsType = {
        c: { name: "c", type: "boolean" },
        a: { name: "a", type: "integer" },
        b: { name: "b", type: "string" },
      };
      expect(isSchemaChanged(base, curr)).toBe(true);
    });
  });

  describe("type modifications", () => {
    test("returns true when column type changes", () => {
      const base: ColumnsType = {
        id: { name: "id", type: "integer" },
        name: { name: "name", type: "string" },
      };
      const curr: ColumnsType = {
        id: { name: "id", type: "integer" },
        name: { name: "name", type: "varchar" },
      };
      expect(isSchemaChanged(base, curr)).toBe(true);
    });

    test("returns true when multiple column types change", () => {
      const base: ColumnsType = {
        id: { name: "id", type: "integer" },
        name: { name: "name", type: "string" },
      };
      const curr: ColumnsType = {
        id: { name: "id", type: "bigint" },
        name: { name: "name", type: "varchar" },
      };
      expect(isSchemaChanged(base, curr)).toBe(true);
    });

    test("returns true when column data is undefined in current", () => {
      const base: ColumnsType = {
        id: { name: "id", type: "integer" },
      };
      const curr: ColumnsType = {
        id: undefined,
      };
      expect(isSchemaChanged(base, curr)).toBe(true);
    });
  });

  describe("no changes", () => {
    test("returns false when schemas are identical", () => {
      const base: ColumnsType = {
        id: { name: "id", type: "integer" },
        name: { name: "name", type: "string" },
      };
      const curr: ColumnsType = {
        id: { name: "id", type: "integer" },
        name: { name: "name", type: "string" },
      };
      expect(isSchemaChanged(base, curr)).toBe(false);
    });

    test("returns false when both schemas are empty", () => {
      const base: ColumnsType = {};
      const curr: ColumnsType = {};
      expect(isSchemaChanged(base, curr)).toBe(false);
    });

    test("returns false with single identical column", () => {
      const base: ColumnsType = { id: { name: "id", type: "integer" } };
      const curr: ColumnsType = { id: { name: "id", type: "integer" } };
      expect(isSchemaChanged(base, curr)).toBe(false);
    });

    test("returns false when only non-type properties differ", () => {
      const base: ColumnsType = {
        id: { name: "id", type: "integer", not_null: true },
      };
      const curr: ColumnsType = {
        id: { name: "id", type: "integer", not_null: false },
      };
      // Note: Current implementation only compares type, not other properties
      expect(isSchemaChanged(base, curr)).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("handles columns with same name but different type case sensitivity", () => {
      const base: ColumnsType = {
        id: { name: "id", type: "INTEGER" },
      };
      const curr: ColumnsType = {
        id: { name: "id", type: "integer" },
      };
      // Types are case-sensitive
      expect(isSchemaChanged(base, curr)).toBe(true);
    });

    test("handles large schemas", () => {
      const base: ColumnsType = {};
      const curr: ColumnsType = {};
      for (let i = 0; i < 100; i++) {
        const key = `col_${i}`;
        base[key] = { name: key, type: "string" };
        curr[key] = { name: key, type: "string" };
      }
      expect(isSchemaChanged(base, curr)).toBe(false);
    });

    test("handles large schemas with one change at the end", () => {
      const base: ColumnsType = {};
      const curr: ColumnsType = {};
      for (let i = 0; i < 100; i++) {
        const key = `col_${i}`;
        base[key] = { name: key, type: "string" };
        curr[key] = { name: key, type: i === 99 ? "integer" : "string" };
      }
      expect(isSchemaChanged(base, curr)).toBe(true);
    });

    test("handles columns with special characters in names", () => {
      const base: ColumnsType = {
        "column-with-dashes": { name: "column-with-dashes", type: "string" },
        column_with_underscores: {
          name: "column_with_underscores",
          type: "string",
        },
      };
      const curr: ColumnsType = {
        "column-with-dashes": { name: "column-with-dashes", type: "string" },
        column_with_underscores: {
          name: "column_with_underscores",
          type: "string",
        },
      };
      expect(isSchemaChanged(base, curr)).toBe(false);
    });
  });
});
