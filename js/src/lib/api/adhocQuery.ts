export interface QueryParams {
  queryType: "query_current" | "query_diff"
  params: QueryCurrentParams | QueryDiffParams;
}

export interface QueryCurrentParams {
  sql_template: string;
}

export interface QueryCurrentResult {
  current?: any;
  current_error?: string;
}

export interface QueryDiffParams {
  sql_template: string;
  primary_keys?: string[];
}

export interface QueryDiffResult {
  primary_keys?: string[];
  base?: any;
  current?: any;
  base_error?: string;
  current_error?: string;
}

export type ValueDiffResult = {
  summary: {
    total: number;
    added: number;
    removed: number;
  };
  data: {
    schema: {
      fields: Array<{
        name: string;
        type: string;
      }>;
    };
    data: any;
  };
};
