/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
// TODO the RunType and Run["status"] types must be a finite list of enumerated values *without* a union with string.

export type RowDataTypes = number | string | boolean | null | undefined;
export type RowData = RowDataTypes[];

export type RowObjectType = Record<string, RowDataTypes> & {
  __status: "added" | "removed" | "modified" | undefined;
};

export type ColumnType =
  | "number"
  | "integer"
  | "text"
  | "boolean"
  | "date"
  | "datetime"
  | "timedelta"
  | "unknown";

export interface DataFrame {
  columns: {
    name: string;
    type: ColumnType;
  }[];
  data: RowData[];
  limit?: number;
  more?: boolean;
}

export type RunType =
  | "simple"
  | "query"
  | "query_diff"
  | "value_diff"
  | "value_diff_detail"
  | "schema_diff"
  | "profile_diff"
  | "row_count"
  | "row_count_diff"
  | "lineage_diff"
  | "top_k_diff"
  | "histogram_diff"
  | string;

export interface Run<PT = any, RT = any> {
  run_id: string;
  run_at: string;
  name?: string;
  check_id?: string;
  type: RunType;
  progress?: {
    message?: string;
    percentage?: number;
  };
  params?: PT;
  result?: RT;
  error?: string;
  status?: "finished" | "failed" | "cancelled" | "running" | string;
}
