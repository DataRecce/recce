"use client";

/**
 * @file Query components barrel export
 * @description Exports all query-related components for @datarecce/ui
 */

// QueryDiffResultView - Displays query diff results
export {
  QueryDiffResultView,
  type QueryDiffResultViewProps,
  type QueryDiffViewOptions,
} from "./QueryDiffResultView";
// QueryForm - Primary key selection for query diff
export { QueryForm, type QueryFormProps } from "./QueryForm";
export { QueryPageOss } from "./QueryPageOss";
// QueryResultView - Displays single query results
export {
  QueryResultView,
  type QueryResultViewProps,
  type QueryViewOptions,
} from "./QueryResultView";
// SetupConnectionGuide - Data warehouse connection guidance
export {
  SetupConnectionGuide,
  type SetupConnectionGuideProps,
} from "./SetupConnectionGuide";
// SqlEditor - SQL code editor with run buttons
export {
  DualSqlEditor,
  type DualSqlEditorProps,
  default as SqlEditor,
  type SqlEditorProps,
} from "./SqlEditor";
