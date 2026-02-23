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
// Check Events API (cloud-only timeline/discussion)
export type {
  ActorType,
  CheckEvent,
  CheckEventActor,
  CheckEventsListResponse,
  CheckEventType,
  CreateCommentRequest,
  UpdateCommentRequest,
} from "./checkEvents";
export {
  createComment,
  deleteComment,
  getCheckEvent,
  getEventDescription,
  getEventIconType,
  isCommentEvent,
  isStateChangeEvent,
  isSystemEvent,
  listCheckEvents,
  updateComment,
} from "./checkEvents";
// Checks API (saved validation checks)
export type { Check, CreateCheckBody } from "./checks";
export {
  createCheckByRun,
  createSimpleCheck,
  deleteCheck,
  getCheck,
  listChecks,
  markAsPresetCheck,
  reorderChecks,
  updateCheck,
  useChecks,
} from "./checks";
// Column-Level Lineage (CLL) API
export type {
  CllInput,
  CllNodeData,
  ColumnLineageData,
  ImpactRadiusParams,
} from "./cll";
export { getCll } from "./cll";
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
  LineageDiffResult,
  ManifestMetadata,
  ModelInfoResult,
  NodeColumnData,
  NodeData,
  PullRequestInfo,
  ServerInfoResult,
  SQLMeshInfo,
  StateMetadata,
} from "./info";
export { getModelInfo, getServerInfo } from "./info";
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
// Lineage Check API
export type { LineageDiffViewOptions } from "./lineagecheck";
export { createLineageDiffCheck } from "./lineagecheck";
// Models API (model row count operations)
export type { QueryRowCountResult } from "./models";
export {
  fetchModelRowCount,
  queryModelRowCount,
  queryRowCount,
} from "./models";
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
  WhereFilter,
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
// Schema Check API
export type { SchemaDiffViewParams } from "./schemacheck";
export { createSchemaDiffCheck } from "./schemacheck";
// Node Selection API
export type { SelectInput, SelectOutput } from "./select";
export { select } from "./select";
// State Management API
export type {
  ImportedState,
  SaveAsInput,
  ShareStateResponse,
  SyncStateInput,
  SyncStateResponse,
} from "./state";
export {
  exportState,
  importState,
  isStateSyncing,
  rename,
  saveAs,
  shareState,
  syncState,
} from "./state";
// Storage Keys
export { LOCAL_STORAGE_KEYS, SESSION_STORAGE_KEYS } from "./storageKeys";
// Run types (from types/run.ts)
// Base types (from types/base.ts)
export type {
  AxiosQueryParams,
  BaseRun,
  ColumnRenderMode,
  ColumnType,
  DataFrame,
  LineageDiffParams,
  RowData,
  RowDataTypes,
  RowObjectType,
  Run,
  RunParamTypes,
  RunProgress,
  RunStatus,
  RunType,
  SchemaDiffParams,
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
  runTypeHasRef,
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
// Version API
export type { VersionResponse } from "./version";
export { getVersion, useVersionNumber } from "./version";
