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

    it.each([
      "NUMBER(38,2)",
      "NUMERIC(10,2)",
      "DECIMAL(18,4)",
    ])("classifies %s (with params) as number", (type) => {
      expect(classifyType(type)).toBe("number");
    });
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

    it.each([
      "VARCHAR(256)",
      "CHAR(10)",
    ])("classifies %s (with params) as text", (type) => {
      expect(classifyType(type)).toBe("text");
    });
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
      "TIMESTAMP WITH LOCAL TIME ZONE",
      "DATETIME2",
      "SMALLDATETIME",
      "DATETIMEOFFSET",
    ])("classifies %s as datetime", (type) => {
      expect(classifyType(type)).toBe("datetime");
    });
  });

  describe("time types", () => {
    it.each(["TIME", "TIMETZ"])("classifies %s as time", (type) => {
      expect(classifyType(type)).toBe("time");
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
    it.each([
      "JSON",
      "JSONB",
      "VARIANT",
      "OBJECT",
      "STRUCT",
      "MAP",
    ])("classifies %s as json", (type) => {
      expect(classifyType(type)).toBe("json");
    });
  });

  describe("array types", () => {
    it.each(["ARRAY", "LIST"])("classifies %s as array", (type) => {
      expect(classifyType(type)).toBe("array");
    });
  });

  describe("unknown types", () => {
    it("classifies empty string as unknown", () => {
      expect(classifyType("")).toBe("unknown");
    });

    it("classifies unrecognized type as unknown", () => {
      expect(classifyType("GEOMETRY")).toBe("unknown");
    });

    it("classifies random string as unknown", () => {
      expect(classifyType("FOOBAR")).toBe("unknown");
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
