import {
  TbAlignBoxLeftStretch,
  TbBrandStackshare,
  TbChartHistogram,
  TbEyeEdit,
  TbEyeSearch,
  TbSql,
} from "react-icons/tb";
import { HistogramDiffForm } from "../histogram/HistogramDiffForm";
import { HistogramDiffResultView } from "../histogram/HistogramDiffResultView";
import { ProfileDiffResultView } from "../profile/ProfileDiffResultView";
import { QueryDiffResultView } from "../query/QueryDiffResultView";
import { QueryResultView } from "../query/QueryResultView";
import { RowCountDiffResultView, RowCountResultView } from "../rowcount/RowCountDiffResultView";
import { TopKDiffForm } from "../top-k/TopKDiffForm";
import { TopKDiffResultView } from "../top-k/TopKDiffResultView";
import { ValueDiffDetailResultView } from "../valuediff/ValueDiffDetailResultView";
import { ValueDiffForm } from "../valuediff/ValueDiffForm";
import { ValueDiffResultView } from "../valuediff/ValueDiffResultView";
import { RunFormProps, RunResultViewProps } from "./types";
import { IconType } from "react-icons";
import { LuBarChartHorizontalBig } from "react-icons/lu";
import { MdFormatListNumberedRtl, MdSchema } from "react-icons/md";
import { ComponentWithAs } from "@chakra-ui/react";
import { ElementType } from "react";
import { ProfileDiffForm } from "../profile/ProfileDiffForm";

interface RegistryEntry<PT, RT, VO = any> {
  title: string;
  icon: IconType;
  RunResultView?: ComponentWithAs<ElementType, RunResultViewProps<PT, RT, VO>>;
  RunForm?: React.ComponentType<RunFormProps<PT>>;
}

const registry: Record<string, RegistryEntry<any, any>> = {
  lineage_diff: {
    title: "Lineage Diff",
    icon: TbBrandStackshare,
  },
  schema_diff: {
    title: "Schema Diff",
    icon: MdSchema,
  },
  query: {
    title: "Query",
    icon: TbSql,
    RunResultView: QueryResultView,
  },
  query_base: {
    title: "Query Base",
    icon: TbSql,
    RunResultView: QueryResultView,
  },
  query_diff: {
    title: "Query Diff",
    icon: TbSql,
    RunResultView: QueryDiffResultView,
  },
  row_count: {
    title: "Row Count",
    icon: MdFormatListNumberedRtl,
    RunResultView: RowCountResultView,
  },
  row_count_diff: {
    title: "Row Count Diff",
    icon: MdFormatListNumberedRtl,
    RunResultView: RowCountDiffResultView,
  },

  profile_diff: {
    title: "Profile Diff",
    icon: TbEyeSearch,
    RunResultView: ProfileDiffResultView,
    RunForm: ProfileDiffForm,
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
  sandbox: {
    title: "Sandbox",
    icon: TbEyeEdit,
    // No specific RunResultView for sandbox, use QueryDiffResultView
  },
};

export const findByRunType = (runType: string): RegistryEntry<any, any> | undefined => {
  return registry[runType];
};
