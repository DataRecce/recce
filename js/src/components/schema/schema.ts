import { RowObjectType } from "@/lib/api/types";

export interface SchemaDiffRow extends RowObjectType {
  name: string;
  reordered?: boolean;
  currentIndex?: number;
  baseIndex?: number;
  currentType?: string;
  baseType?: string;
}

export interface SchemaRow extends RowObjectType {
  name: string;
  index: number;
  type?: string;
}
