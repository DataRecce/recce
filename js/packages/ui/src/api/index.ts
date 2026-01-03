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
// Runs API (aggregated run results)
export type { RunsAggregated } from "./runs";
export { aggregateRuns } from "./runs";
