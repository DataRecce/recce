import { describe, expect, it } from "vitest";
import { classifyType } from "../classifyType";

describe("classifyType", () => {
  describe("integer types", () => {
    it.each([
      "INTEGER",
      "INT",
      "BIGINT",
      "SMALLINT",
      "TINYINT",
      "INT64",
      "INT32",
      "INT16",
      "INT8",
      "INT4",
      "INT2",
      "MEDIUMINT",
      "SERIAL",
      "BIGSERIAL",
      "SMALLSERIAL",
      "INT128",
      "HUGEINT",
      "UHUGEINT",
      "UTINYINT",
      "USMALLINT",
      "UINTEGER",
      "UBIGINT",
    ])("classifies %s as integer", (type) => {
      expect(classifyType(type)).toBe("integer");
    });
  });

  describe("number types", () => {
    it.each([
      "DOUBLE",
      "FLOAT",
      "REAL",
      "NUMERIC",
      "DECIMAL",
      "NUMBER",
      "FLOAT64",
      "FLOAT32",
      "DOUBLE PRECISION",
    ])("classifies %s as number", (type) => {
      expect(classifyType(type)).toBe("number");
    });

    it.each(["NUMBER(38,2)", "NUMERIC(10,2)", "DECIMAL(18,4)"])(
      "classifies %s (with params) as number",
      (type) => {
        expect(classifyType(type)).toBe("number");
      },
    );
  });

  describe("text types", () => {
    it.each([
      "VARCHAR",
      "TEXT",
      "STRING",
      "CHAR",
      "CHARACTER VARYING",
      "CHARACTER",
      "NCHAR",
      "NVARCHAR",
      "VARCHAR2",
      "NVARCHAR2",
      "CLOB",
      "NCLOB",
      "TINYTEXT",
      "MEDIUMTEXT",
      "LONGTEXT",
    ])("classifies %s as text", (type) => {
      expect(classifyType(type)).toBe("text");
    });

    it.each(["VARCHAR(256)", "CHAR(10)"])(
      "classifies %s (with params) as text",
      (type) => {
        expect(classifyType(type)).toBe("text");
      },
    );
  });

  describe("boolean types", () => {
    it.each(["BOOLEAN", "BOOL"])("classifies %s as boolean", (type) => {
      expect(classifyType(type)).toBe("boolean");
    });

    it("classifies TINYINT(1) as boolean", () => {
      expect(classifyType("TINYINT(1)")).toBe("boolean");
    });
  });

  describe("date types", () => {
    it("classifies DATE as date", () => {
      expect(classifyType("DATE")).toBe("date");
    });

    // ClickHouse extended-range date (DRC-3670 review #3). Previously fell
    // through to `unknown`, leaving raw epoch integers in the tooltip.
    it("classifies ClickHouse DATE32 as date", () => {
      expect(classifyType("DATE32")).toBe("date");
    });
  });

  describe("datetime types", () => {
    it.each([
      "TIMESTAMP",
      "DATETIME",
      "TIMESTAMP_NTZ",
      "TIMESTAMP_LTZ",
      "TIMESTAMP_TZ",
      "TIMESTAMPTZ",
      "TIMESTAMP WITH TIME ZONE",
      "TIMESTAMP WITHOUT TIME ZONE",
      "TIMESTAMP WITH LOCAL TIME ZONE",
      "DATETIME2",
      "SMALLDATETIME",
      "DATETIMEOFFSET",
    ])("classifies %s as datetime", (type) => {
      expect(classifyType(type)).toBe("datetime");
    });

    // DuckDB sub-second timestamps (DRC-3669). Previously fell through to
    // `unknown`, which is why the cell needed local substring heuristics.
    it.each(["TIMESTAMP_S", "TIMESTAMP_MS", "TIMESTAMP_NS"])(
      "classifies DuckDB %s as datetime",
      (type) => {
        expect(classifyType(type)).toBe("datetime");
      },
    );

    // ClickHouse sub-second datetime (DRC-3670 review #3). Previously fell
    // through to `unknown`; the paren-strip normalizes the precision/timezone
    // parameters (e.g. DATETIME64(3, 'UTC') -> DATETIME64).
    it.each([
      "DATETIME64",
      "DATETIME64(3)",
      "DATETIME64(3, 'UTC')",
      "datetime64(3, 'UTC')",
    ])("classifies ClickHouse %s as datetime", (type) => {
      expect(classifyType(type)).toBe("datetime");
    });
  });

  describe("time types", () => {
    it.each([
      "TIME",
      "TIMETZ",
      "TIME WITH TIME ZONE",
      "TIME WITHOUT TIME ZONE",
    ])("classifies %s as time", (type) => {
      expect(classifyType(type)).toBe("time");
    });

    // Exact-match guard: TIME/TIMETZ must stay `time` (seconds-since-midnight),
    // never collapse into the datetime bucket alongside TIMESTAMP_*.
    it("keeps TIME as time, distinct from the datetime bucket", () => {
      expect(classifyType("TIME")).toBe("time");
      expect(classifyType("TIMETZ")).toBe("time");
    });
  });

  describe("binary types", () => {
    it.each([
      "BINARY",
      "VARBINARY",
      "BYTES",
      "BLOB",
      "BYTEA",
      "TINYBLOB",
      "MEDIUMBLOB",
      "LONGBLOB",
    ])("classifies %s as binary", (type) => {
      expect(classifyType(type)).toBe("binary");
    });
  });

  describe("json types", () => {
    it.each(["JSON", "JSONB", "VARIANT", "OBJECT", "STRUCT", "MAP"])(
      "classifies %s as json",
      (type) => {
        expect(classifyType(type)).toBe("json");
      },
    );
  });

  describe("array types", () => {
    it.each(["ARRAY", "LIST"])("classifies %s as array", (type) => {
      expect(classifyType(type)).toBe("array");
    });
  });

  describe("geography types", () => {
    it.each([
      "GEOGRAPHY",
      "GEOMETRY",
      "POINT",
      "LINESTRING",
      "POLYGON",
      "MULTIPOINT",
      "MULTILINESTRING",
      "MULTIPOLYGON",
      "GEOMETRYCOLLECTION",
      "SDO_GEOMETRY",
    ])("classifies %s as geography", (type) => {
      expect(classifyType(type)).toBe("geography");
    });
  });

  describe("unknown types", () => {
    it("classifies empty string as unknown", () => {
      expect(classifyType("")).toBe("unknown");
    });

    it("classifies unrecognized type as unknown", () => {
      expect(classifyType("FOOBAR")).toBe("unknown");
    });

    it("classifies random string as unknown", () => {
      expect(classifyType("XYZTYPE")).toBe("unknown");
    });
  });

  describe("case insensitivity", () => {
    it("handles lowercase", () => {
      expect(classifyType("varchar")).toBe("text");
    });

    it("handles mixed case", () => {
      expect(classifyType("VarChar")).toBe("text");
    });

    it("handles lowercase with params", () => {
      expect(classifyType("varchar(256)")).toBe("text");
    });

    it("handles lowercase tinyint(1) as boolean", () => {
      expect(classifyType("tinyint(1)")).toBe("boolean");
    });
  });

  describe("TINYINT special case", () => {
    it("classifies TINYINT as integer", () => {
      expect(classifyType("TINYINT")).toBe("integer");
    });

    it("classifies TINYINT(1) as boolean", () => {
      expect(classifyType("TINYINT(1)")).toBe("boolean");
    });

    it("classifies TINYINT(2) as integer", () => {
      expect(classifyType("TINYINT(2)")).toBe("integer");
    });
  });

  describe("whitespace handling", () => {
    it("trims leading/trailing whitespace", () => {
      expect(classifyType("  VARCHAR  ")).toBe("text");
    });

    it("handles multi-word types with extra spaces", () => {
      expect(classifyType("DOUBLE PRECISION")).toBe("number");
    });
  });
});
