import { DataFrame } from "./types";

export type ValueDiffResult = {
  summary: {
    total: number;
    added: number;
    removed: number;
  };
  data: DataFrame;
};
