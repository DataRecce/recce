"use client";

// Ad-hoc Query API
export type {
  QueryDiffParams,
  QueryDiffResult,
  QueryDiffViewOptions,
  QueryParams,
  QueryPreviewChangeParams,
  QueryResult,
  QueryRunParams,
  QueryViewOptions,
} from "./adhocQuery";
export { submitQuery, submitQueryBase, submitQueryDiff } from "./adhocQuery";
// Cache keys for TanStack Query
export { cacheKeys } from "./cacheKeys";
// Server flags API
export type { RecceServerFlags } from "./flag";
export { getServerFlag, markRelaunchHintCompleted } from "./flag";
// Server info API (lineage, environment, dbt metadata)
export type {
  CatalogMetadata,
  GitInfo,
  LineageData,
  LineageDataFromMetadata,
  LineageDiffData,
  ManifestMetadata,
  NodeColumnData,
  NodeData,
  PullRequestInfo,
  ServerInfoResult,
  SQLMeshInfo,
  StateMetadata,
} from "./info";
export { getServerInfo } from "./info";
// Instance info API
export type { RecceInstanceInfo, ServerMode } from "./instanceInfo";
export { getRecceInstanceInfo } from "./instanceInfo";
// Keep-alive API for session management
export {
  getLastKeepAliveTime,
  resetKeepAliveState,
  sendKeepAlive,
  setKeepAliveCallback,
} from "./keepAlive";
// Profile Diff API
export type {
  HistogramDiffParams,
  HistogramDiffResult,
  HistogramResult,
  ProfileDiffParams,
  ProfileDiffResult,
  ProfileDiffViewOptions,
  TopKDiffParams,
  TopKDiffResult,
  TopKResult,
  TopKViewOptions,
} from "./profile";
export { submitProfileDiff } from "./profile";
// Row Count API
export type {
  RowCount,
  RowCountDiff,
  RowCountDiffParams,
  RowCountDiffResult,
  RowCountParams,
  RowCountResult,
} from "./rowcount";
export { submitRowCountDiff } from "./rowcount";
// Runs API (core run operations and aggregation)
export type {
  RunsAggregated,
  SubmitOptions,
  SubmitRunTrackProps,
} from "./runs";
export {
  aggregateRuns,
  cancelRun,
  getRun,
  listRuns,
  searchRuns,
  submitRun,
  submitRunFromCheck,
  waitRun,
} from "./runs";
// Run types (from types/run.ts)
// Base types (from types/base.ts)
export type {
  AxiosQueryParams,
  BaseRun,
  ColumnRenderMode,
  ColumnType,
  DataFrame,
  RowData,
  RowDataTypes,
  RowObjectType,
  Run,
  RunProgress,
  RunStatus,
  RunType,
} from "./types";
export {
  isHistogramDiffRun,
  isLineageDiffRun,
  isProfileDiffRun,
  isProfileRun,
  isQueryBaseRun,
  isQueryDiffRun,
  isQueryRun,
  isRowCountDiffRun,
  isRowCountRun,
  isSandboxRun,
  isSchemaDiffRun,
  isSimpleRun,
  isTopKDiffRun,
  isValidRunType,
  isValueDiffDetailRun,
  isValueDiffRun,
  RUN_TYPES,
} from "./types";
// Value Diff API
export type {
  ValueDiffDetailParams,
  ValueDiffDetailResult,
  ValueDiffDetailViewOptions,
  ValueDiffParams,
  ValueDiffResult,
} from "./valuediff";
export { submitValueDiff, submitValueDiffDetail } from "./valuediff";
