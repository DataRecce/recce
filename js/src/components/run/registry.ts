import React, {
  ComponentType,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react";
import { DataGridHandle } from "react-data-grid";
import { IconType } from "react-icons";
import { LuChartBarBig } from "react-icons/lu";
import { MdFormatListNumberedRtl, MdSchema } from "react-icons/md";
import {
  TbAlignBoxLeftStretch,
  TbBrandStackshare,
  TbChartHistogram,
  TbEyeEdit,
  TbEyeSearch,
  TbSql,
} from "react-icons/tb";
import { DiffViewOptions } from "@/components/run/RunToolbar";
import { QueryDiffViewOptions, QueryViewOptions } from "@/lib/api/adhocQuery";
import { LineageDiffViewOptions } from "@/lib/api/lineagecheck";
import {
  HistogramDiffParams,
  ProfileDiffViewOptions,
  TopKDiffParams,
} from "@/lib/api/profile";
import { AxiosQueryParams } from "@/lib/api/types";
import { ValueDiffDetailViewOptions } from "@/lib/api/valuediff";
import { HistogramDiffForm } from "../histogram/HistogramDiffForm";
import { HistogramDiffResultView } from "../histogram/HistogramDiffResultView";
import {
  ProfileDiffForm,
  ProfileDiffFormParams,
} from "../profile/ProfileDiffForm";
import {
  ProfileDiffResultView,
  ProfileResultView,
} from "../profile/ProfileDiffResultView";
import { QueryDiffResultView } from "../query/QueryDiffResultView";
import { QueryResultView } from "../query/QueryResultView";
import {
  RowCountDiffResultView,
  RowCountResultView,
} from "../rowcount/RowCountDiffResultView";
import { TopKDiffForm } from "../top-k/TopKDiffForm";
import { TopKDiffResultView } from "../top-k/TopKDiffResultView";
import { ValueDiffDetailResultView } from "../valuediff/ValueDiffDetailResultView";
import { ValueDiffForm, ValueDiffFormParams } from "../valuediff/ValueDiffForm";
import { ValueDiffResultView } from "../valuediff/ValueDiffResultView";
import { RunFormProps, RunResultViewProps } from "./types";

export type ViewOptionTypes =
  | LineageDiffViewOptions
  | DiffViewOptions
  | QueryViewOptions
  | QueryDiffViewOptions
  | ProfileDiffViewOptions
  | ValueDiffDetailViewOptions;

export type RunType =
  | "simple"
  | "query"
  | "query_base"
  | "query_diff"
  | "value_diff"
  | "value_diff_detail"
  | "schema_diff"
  | "profile"
  | "profile_diff"
  | "row_count"
  | "row_count_diff"
  | "lineage_diff"
  | "top_k_diff"
  | "histogram_diff"
  | "sandbox";

export type RefTypes = React.Ref<DataGridHandle> | React.Ref<HTMLDivElement>;
export type RunFormParamTypes =
  | ProfileDiffFormParams
  | ValueDiffFormParams
  | TopKDiffParams
  | HistogramDiffParams
  | AxiosQueryParams;

export interface RegistryEntry<PT = RefTypes, VO = ViewOptionTypes> {
  title: string;
  icon: IconType;
  RunResultView?: ForwardRefExoticComponent<
    RunResultViewProps<VO> & RefAttributes<PT>
  >;
  RunForm?: ComponentType<RunFormProps<RunFormParamTypes>>;
}

interface RunRegistry {
  query: RegistryEntry<DataGridHandle, QueryViewOptions>;
  query_base: RegistryEntry<DataGridHandle, QueryViewOptions>;
  query_diff: RegistryEntry<DataGridHandle, QueryDiffViewOptions>;
  row_count: RegistryEntry<DataGridHandle>;
  row_count_diff: RegistryEntry<DataGridHandle>;
  profile: RegistryEntry<DataGridHandle, ProfileDiffViewOptions>;
  profile_diff: RegistryEntry<DataGridHandle, ProfileDiffViewOptions>;
  value_diff: RegistryEntry<DataGridHandle>;
  value_diff_detail: RegistryEntry<DataGridHandle, ValueDiffDetailViewOptions>;
  top_k_diff: RegistryEntry<HTMLDivElement>;
  histogram_diff: RegistryEntry<HTMLDivElement>;
  lineage_diff: RegistryEntry<never>; // No RunResultView
  schema_diff: RegistryEntry<never>; // No RunResultView
  sandbox: RegistryEntry<never>; // No RunResultView
  simple: RegistryEntry<never>; // No RunResultView
}

export function runTypeHasRef(runType: RunType) {
  const typeHasRef = [
    "query",
    "query_base",
    "query_diff",
    "row_count",
    "row_count_diff",
    "profile",
    "profile_diff",
    "value_diff",
    "value_diff_detail",
    "top_k_diff",
    "histogram_diff",
  ];
  return typeHasRef.includes(runType);
}

const registry: RunRegistry = {
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
  profile: {
    title: "Profile",
    icon: TbEyeSearch,
    RunResultView: ProfileResultView,
    RunForm: ProfileDiffForm,
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
    icon: LuChartBarBig,
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
  simple: {
    title: "Simple",
    icon: TbEyeEdit,
    // No specific RunResultView for simple, use undefined
  },
};

export const findByRunType = <T extends RunType>(
  runType: T,
): RunRegistry[T] => {
  return registry[runType];
};
