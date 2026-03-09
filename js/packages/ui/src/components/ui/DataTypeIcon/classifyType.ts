export type TypeCategory =
  | "integer"
  | "number"
  | "text"
  | "boolean"
  | "date"
  | "datetime"
  | "time"
  | "binary"
  | "json"
  | "array"
  | "geography"
  | "unknown";

const CATEGORY_MAP: Record<string, TypeCategory> = {
  // integer
  INTEGER: "integer",
  INT: "integer",
  BIGINT: "integer",
  SMALLINT: "integer",
  TINYINT: "integer",
  INT64: "integer",
  INT32: "integer",
  INT16: "integer",
  INT8: "integer",
  INT4: "integer",
  INT2: "integer",
  MEDIUMINT: "integer",
  SERIAL: "integer",
  BIGSERIAL: "integer",
  SMALLSERIAL: "integer",

  // number
  DOUBLE: "number",
  FLOAT: "number",
  REAL: "number",
  NUMERIC: "number",
  DECIMAL: "number",
  NUMBER: "number",
  FLOAT64: "number",
  FLOAT32: "number",
  "DOUBLE PRECISION": "number",

  // text
  VARCHAR: "text",
  TEXT: "text",
  STRING: "text",
  CHAR: "text",
  "CHARACTER VARYING": "text",
  CHARACTER: "text",
  NCHAR: "text",
  NVARCHAR: "text",
  VARCHAR2: "text",
  NVARCHAR2: "text",
  CLOB: "text",
  NCLOB: "text",
  TINYTEXT: "text",
  MEDIUMTEXT: "text",
  LONGTEXT: "text",

  // boolean
  BOOLEAN: "boolean",
  BOOL: "boolean",

  // date
  DATE: "date",

  // datetime
  TIMESTAMP: "datetime",
  DATETIME: "datetime",
  TIMESTAMP_NTZ: "datetime",
  TIMESTAMP_LTZ: "datetime",
  TIMESTAMP_TZ: "datetime",
  TIMESTAMPTZ: "datetime",
  "TIMESTAMP WITH TIME ZONE": "datetime",
  "TIMESTAMP WITHOUT TIME ZONE": "datetime",
  "TIMESTAMP WITH LOCAL TIME ZONE": "datetime",
  DATETIME2: "datetime",
  SMALLDATETIME: "datetime",
  DATETIMEOFFSET: "datetime",

  // time
  TIME: "time",
  TIMETZ: "time",
  "TIME WITH TIME ZONE": "time",
  "TIME WITHOUT TIME ZONE": "time",

  // binary
  BINARY: "binary",
  VARBINARY: "binary",
  BYTES: "binary",
  BLOB: "binary",
  BYTEA: "binary",
  TINYBLOB: "binary",
  MEDIUMBLOB: "binary",
  LONGBLOB: "binary",

  // json
  JSON: "json",
  JSONB: "json",
  VARIANT: "json",
  OBJECT: "json",
  STRUCT: "json",
  MAP: "json",

  // array
  ARRAY: "array",
  LIST: "array",

  // geography
  GEOGRAPHY: "geography",
  GEOMETRY: "geography",
  POINT: "geography",
  LINESTRING: "geography",
  POLYGON: "geography",
  MULTIPOINT: "geography",
  MULTILINESTRING: "geography",
  MULTIPOLYGON: "geography",
  GEOMETRYCOLLECTION: "geography",
  SDO_GEOMETRY: "geography",
};

/**
 * Classifies a raw database type string into a TypeCategory.
 *
 * - Case-insensitive
 * - Strips parenthesized parameters before matching (e.g. VARCHAR(256) -> VARCHAR)
 * - Special case: TINYINT(1) maps to "boolean", plain TINYINT maps to "integer"
 */
export function classifyType(rawType: string): TypeCategory {
  const trimmed = rawType.trim().toUpperCase();

  if (!trimmed) {
    return "unknown";
  }

  // Special case: TINYINT(1) is boolean
  if (/^TINYINT\s*\(\s*1\s*\)$/.test(trimmed)) {
    return "boolean";
  }

  // Strip parenthesized parameters (indexOf avoids regex backtracking)
  const parenIdx = trimmed.indexOf("(");
  const base = parenIdx === -1 ? trimmed : trimmed.slice(0, parenIdx).trimEnd();

  return CATEGORY_MAP[base] ?? "unknown";
}
