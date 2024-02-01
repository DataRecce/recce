export interface DataFrame {
  columns: Array<{
    name: string;
    type:
      | "number"
      | "integer"
      | "text"
      | "boolean"
      | "date"
      | "datetime"
      | "timedelta"
      | "unknown";
  }>;
  data: Array<Array<number | string | null>>;
  limit?: number;
  more?: boolean;
}

export type RunType =
  | "simple"
  | "query"
  | "query_diff"
  | "value_diff"
  | "schema_diff"
  | "profile_diff"
  | "row_count_diff";

export interface Run<PT = any, RT = any> {
  run_id: string;
  check_id?: string;
  type: RunType;
  progress?: {
    message?: string;
    percentage?: number;
  };
  params?: PT;
  result?: RT;
  error?: string;
}
