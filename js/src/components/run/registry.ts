import {
  TbAlignBoxLeftStretch,
  TbBrandStackshare,
  TbChartHistogram,
  TbEyeSearch,
  TbSchema,
  TbSql,
} from "react-icons/tb";
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
import { IconType } from "react-icons";
import { FiAlignLeft } from "react-icons/fi";
import { LuBarChartHorizontalBig } from "react-icons/lu";

interface RegistryEntry<PT, RT, VO = any> {
  title: string;
  icon: IconType;
  RunResultView?: React.ComponentType<RunResultViewProps<PT, RT>>;
  RunForm?: React.ComponentType<RunFormProps<PT>>;
}

const registry: { [key: string]: RegistryEntry<any, any> } = {
  lineage_diff: {
    title: "Lineage Diff",
    icon: TbBrandStackshare,
  },
  schema_diff: {
    title: "Schem Diff",
    icon: TbSchema,
  },
  query: {
    title: "Query",
    icon: TbSql,
    RunResultView: QueryResultView,
  },
  query_diff: {
    title: "Query Diff",
    icon: TbSql,
    RunResultView: QueryDiffResultView,
  },
  row_count_diff: {
    title: "Row Count Diff",
    icon: FiAlignLeft,
    RunResultView: RowCountDiffResultView,
  },

  profile_diff: {
    title: "Profile Diff",
    icon: TbEyeSearch,
    RunResultView: ProfileDiffResultView,
  },
  value_diff: {
    title: "Value Diff",
    icon: TbAlignBoxLeftStretch,
    RunResultView: ValueDiffResultView,
    RunForm: ValueDiffForm,
  },
  value_diff_detail: {
    title: "Value Diff Detail",
    icon: TbAlignBoxLeftStretch,
    RunResultView: ValueDiffDetailResultView,
    RunForm: ValueDiffForm,
  },
  top_k_diff: {
    title: "Top-K Diff",
    icon: LuBarChartHorizontalBig,
    RunResultView: TopKDiffResultView,
    RunForm: TopKDiffForm,
  },
  histogram_diff: {
    title: "Histogram Diff",
    icon: TbChartHistogram,
    RunResultView: HistogramDiffResultView,
    RunForm: HistogramDiffForm,
  },
};

export const findByRunType = (
  runType: string
): RegistryEntry<any, any> | undefined => {
  return registry[runType];
};
