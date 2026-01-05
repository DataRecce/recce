"use client";

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
export type { BaseRun, Run, RunProgress, RunStatus, RunType } from "./types";
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
