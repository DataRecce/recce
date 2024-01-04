export interface DataFrameField {
  name: string;
  type: string;
}

export type DataFrameRow = Record<string, any>;

// The result from pandas DataFrame..to_json(orient='table')
// see https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.to_json.html#pandas-dataframe-to-json
export interface DataFrame {
  schema: {
    fields: Array<DataFrameField>;
    primaryKey: string[];
    pandas_version?: string;
  };
  data: Array<DataFrameRow>;
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
  params?: PT;
  result?: RT;
}
