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
}

export interface PandasDataFrameField {
  name: string;
  type: string;
}

export type PandasDataFrameRow = Record<string, any>;

// The result from pandas DataFrame..to_json(orient='table')
// see https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.to_json.html#pandas-dataframe-to-json
export interface PandasDataFrame {
  schema: {
    fields: Array<PandasDataFrameField>;
    primaryKey: string[];
    pandas_version?: string;
  };
  data: Array<PandasDataFrameRow>;
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
