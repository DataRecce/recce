"use client";

// Schema primitives - pure presentation components for database schema display

export {
  mergeSchemaColumns,
  SchemaDiff,
  type SchemaDiffHandle,
  type SchemaDiffProps,
  type SchemaDiffRow,
  type SchemaDiffStatus,
} from "./SchemaDiff";
export {
  type SchemaColumnData,
  type SchemaRow,
  SchemaTable,
  type SchemaTableHandle,
  type SchemaTableProps,
} from "./SchemaTable";
