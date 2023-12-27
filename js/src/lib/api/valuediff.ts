import { DataFrame } from "./types";


export type ValueDiffError = {
  test: string;
  invalids: number;
  sql: string;
  model: string;
  column_name: string;
  base: boolean;
};


export type ValueDiffResult = {
  summary: {
    total: number;
    added: number;
    removed: number;
  };
  data: DataFrame;
  errors: ValueDiffError[];
};
