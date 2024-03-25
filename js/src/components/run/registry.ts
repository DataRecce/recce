import { HistogramDiffForm } from "../histogram/HistogramDiffForm";
import { HistogramDiffResultView } from "../histogram/HistogramDiffResultView";
import { ProfileDiffResultView } from "../profile/ProfileDiffResultView";
import { QueryDiffResultView } from "../query/QueryDiffResultView";
import { QueryResultView } from "../query/QueryResultView";
import { RowCountDiffResultView } from "../rowcount/RowCountDiffResultView";
import { TopKDiffForm } from "../top-k/TopKDiffForm";
import { TopKDiffResultView } from "../top-k/TopKDiffResultView";
import { ValueDiffDetailResultView } from "../valuediff/ValueDiffDetailResultView";
import { ValueDiffForm } from "../valuediff/ValueDiffForm";
import { ValueDiffResultView } from "../valuediff/ValueDiffResultView";
import { RunFormProps, RunResultViewProps } from "./types";

interface RegistryEntry<PT, RT, VO = any> {
  title: string;
  RunResultView: React.ComponentType<RunResultViewProps<PT, RT>>;
  RunForm?: React.ComponentType<RunFormProps<PT>>;
}

const registry: { [key: string]: RegistryEntry<any, any> } = {
  query: {
    title: "Query",
    RunResultView: QueryResultView,
  },
  query_diff: {
    title: "Query Diff",
    RunResultView: QueryDiffResultView,
  },
  row_count_diff: {
    title: "Row Count Diff",
    RunResultView: RowCountDiffResultView,
  },

  profile_diff: {
    title: "Profile Diff",
    RunResultView: ProfileDiffResultView,
  },
  value_diff: {
    title: "Value Diff",
    RunResultView: ValueDiffResultView,
    RunForm: ValueDiffForm,
  },
  value_diff_detail: {
    title: "Value Diff Detail",
    RunResultView: ValueDiffDetailResultView,
    RunForm: ValueDiffForm,
  },
  top_k_diff: {
    title: "Top-K Diff",
    RunResultView: TopKDiffResultView,
    RunForm: TopKDiffForm,
  },
  histogram_diff: {
    title: "Histogram Diff",
    RunResultView: HistogramDiffResultView,
    RunForm: HistogramDiffForm,
  },
};

export const findByRunType = (
  runType: string
): RegistryEntry<any, any> | undefined => {
  return registry[runType];
};
