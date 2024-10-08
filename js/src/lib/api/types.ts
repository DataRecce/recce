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
  | "value_diff_detail"
  | "schema_diff"
  | "profile_diff"
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
  status?: "success" | "failed" | "cancelled";
}
