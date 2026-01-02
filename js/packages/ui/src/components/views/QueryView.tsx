"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { memo, useCallback, useMemo } from "react";
import type { QueryResult } from "../../providers/contexts/QueryContext";
import { useQueryContext } from "../../providers/contexts/QueryContext";
import type {
  DiffColumn,
  DiffDisplayMode,
  DiffRow,
} from "../query/QueryDiffView";
import { QueryDiffView } from "../query/QueryDiffView";
import { QueryEditor, type QueryEditorLanguage } from "../query/QueryEditor";
import type {
  QueryResultsColumn,
  QueryResultsRow,
} from "../query/QueryResults";
import { QueryResults } from "../query/QueryResults";
import { SplitPane } from "../ui/SplitPane";

/**
 * View mode for query results display
 */
export type QueryViewMode = "single" | "diff";

/**
 * Props for the QueryView component.
 * Defines options for querying and viewing results.
 */
export interface QueryViewProps {
  /**
   * SQL query string. If not provided, uses QueryContext.
   */
  sql?: string;

  /**
   * Whether query is executing. If not provided, uses QueryContext.
   */
  isExecuting?: boolean;

  /**
   * Error message. If not provided, uses QueryContext.
   */
  error?: string;

  /**
   * Base environment query result. If not provided, uses QueryContext.
   */
  baseResult?: QueryResult;

  /**
   * Current environment query result. If not provided, uses QueryContext.
   */
  currentResult?: QueryResult;

  /**
   * Callback when SQL changes. If not provided, uses QueryContext.
   */
  onSqlChange?: (sql: string) => void;

  /**
   * Callback when query is executed. If not provided, uses QueryContext.
   */
  onExecute?: (sql: string) => Promise<void>;

  /**
   * Callback when query is cancelled. If not provided, uses QueryContext.
   */
  onCancel?: () => void;

  /**
   * View mode for results.
   * @default "single"
   */
  viewMode?: QueryViewMode;

  /**
   * Diff display mode (when viewMode is "diff").
   * @default "side-by-side"
   */
  diffMode?: DiffDisplayMode;

  /**
   * Primary key columns for diff matching.
   */
  primaryKeys?: string[];

  /**
   * Editor language.
   * @default "sql"
   */
  language?: QueryEditorLanguage;

  /**
   * Placeholder text for empty editor.
   */
  placeholder?: string;

  /**
   * Optional height for the view.
   * @default "100%"
   */
  height?: number | string;

  /**
   * Initial split pane size (percentage for editor).
   * @default 40
   */
  editorPaneSize?: number;

  /**
   * Minimum editor pane size in pixels.
   * @default 100
   */
  minEditorSize?: number;

  /**
   * Maximum editor pane size in pixels.
   * @default 600
   */
  maxEditorSize?: number;

  /**
   * Whether to show line numbers in editor.
   * @default true
   */
  showLineNumbers?: boolean;

  /**
   * Optional CSS class name.
   */
  className?: string;
}

/**
 * Ref interface for QueryView component.
 */
export interface QueryViewRef {
  /**
   * Focus the editor.
   */
  focus: () => void;
}

/**
 * Convert QueryResult to grid format for QueryResults
 */
function resultToGrid(result?: QueryResult): {
  columns: QueryResultsColumn[];
  rows: QueryResultsRow[];
} {
  if (!result) {
    return { columns: [], rows: [] };
  }

  const columns: QueryResultsColumn[] = result.columns.map((col) => ({
    field: col,
    headerName: col,
  }));

  const rows: QueryResultsRow[] = result.data.map((row, index) => ({
    id: index,
    ...row,
  }));

  return { columns, rows };
}

/**
 * Convert two QueryResults to diff format for QueryDiffView
 */
function resultsToDiff(
  baseResult?: QueryResult,
  currentResult?: QueryResult,
  primaryKeys?: string[],
): { columns: DiffColumn[]; rows: DiffRow[] } {
  if (!baseResult && !currentResult) {
    return { columns: [], rows: [] };
  }

  // Use current result columns, or base if current is missing
  const refResult = currentResult || baseResult;
  const columns: DiffColumn[] = (refResult?.columns || []).map((col) => ({
    field: col,
    headerName: col,
    isPrimaryKey: primaryKeys?.includes(col) || false,
  }));

  // Build diff rows
  const rows: DiffRow[] = [];

  // Simple implementation: show all current rows as added, all base rows as removed
  // A real implementation would match rows by primary keys
  if (currentResult?.data) {
    for (let i = 0; i < currentResult.data.length; i++) {
      rows.push({
        id: `current-${i}`,
        status: baseResult ? "unchanged" : "added",
        currentValues: currentResult.data[i],
        baseValues: baseResult?.data[i],
      });
    }
  }

  return { columns, rows };
}

/**
 * QueryView Component
 *
 * A high-level component for SQL querying with an editor and results display.
 * Supports single environment results or side-by-side diff comparison.
 *
 * Can receive data from:
 * 1. QueryContext (wrap with QueryProvider)
 * 2. Direct props
 *
 * @example Using with context
 * ```tsx
 * import { QueryProvider, QueryView } from '@datarecce/ui';
 *
 * function App() {
 *   const [sql, setSql] = useState('SELECT * FROM users');
 *   const { execute, isExecuting, result, error } = useQueryExecutor();
 *
 *   return (
 *     <QueryProvider
 *       sql={sql}
 *       isExecuting={isExecuting}
 *       currentResult={result}
 *       error={error}
 *       onSqlChange={setSql}
 *       onExecute={execute}
 *     >
 *       <QueryView />
 *     </QueryProvider>
 *   );
 * }
 * ```
 *
 * @example Using with diff mode
 * ```tsx
 * import { QueryView } from '@datarecce/ui';
 *
 * function DiffApp({ sql, baseResult, currentResult }) {
 *   return (
 *     <QueryView
 *       sql={sql}
 *       baseResult={baseResult}
 *       currentResult={currentResult}
 *       viewMode="diff"
 *       primaryKeys={['id']}
 *     />
 *   );
 * }
 * ```
 */
function QueryViewComponent({
  sql: propSql,
  isExecuting: propIsExecuting,
  error: propError,
  baseResult: propBaseResult,
  currentResult: propCurrentResult,
  onSqlChange: propOnSqlChange,
  onExecute: propOnExecute,
  onCancel: propOnCancel,
  viewMode = "single",
  diffMode = "side-by-side",
  primaryKeys,
  language = "sql",
  placeholder = "Enter SQL query...",
  height = "100%",
  editorPaneSize = 40,
  minEditorSize = 100,
  maxEditorSize = 600,
  showLineNumbers = true,
  className,
}: QueryViewProps) {
  // Get data from context or props
  const contextValue = useQueryContext();

  const sql = propSql ?? contextValue.sql;
  const isExecuting =
    propIsExecuting !== undefined ? propIsExecuting : contextValue.isExecuting;
  const error = propError ?? contextValue.error;
  const baseResult = propBaseResult ?? contextValue.baseResult;
  const currentResult = propCurrentResult ?? contextValue.currentResult;
  const onSqlChange = propOnSqlChange ?? contextValue.onSqlChange;
  const onExecute = propOnExecute ?? contextValue.onExecute;
  const onCancel = propOnCancel ?? contextValue.onCancel;

  // Convert results to grid format
  const currentGrid = useMemo(
    () => resultToGrid(currentResult),
    [currentResult],
  );

  // Convert to diff format
  const diffData = useMemo(
    () => resultsToDiff(baseResult, currentResult, primaryKeys),
    [baseResult, currentResult, primaryKeys],
  );

  // Handle execute
  const handleExecute = useCallback(async () => {
    if (onExecute) {
      await onExecute(sql);
    }
  }, [onExecute, sql]);

  // Determine if we have results
  const hasResults = currentResult || baseResult;
  const showDiff = viewMode === "diff" && baseResult && currentResult;

  return (
    <Box className={className} sx={{ width: "100%", height }}>
      <SplitPane
        direction="vertical"
        sizes={[editorPaneSize, 100 - editorPaneSize]}
        minSizes={[minEditorSize, 100]}
        maxSizes={[maxEditorSize, Infinity]}
      >
        {/* Top pane: Editor */}
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Box sx={{ flex: 1, overflow: "hidden" }}>
            <QueryEditor
              value={sql}
              onChange={onSqlChange}
              language={language}
              lineNumbers={showLineNumbers}
              height="100%"
            />
          </Box>
          <Box
            sx={{
              display: "flex",
              gap: 1,
              p: 1,
              borderTop: 1,
              borderColor: "divider",
              alignItems: "center",
            }}
          >
            <Button
              variant="contained"
              size="small"
              onClick={handleExecute}
              disabled={isExecuting || !sql.trim()}
            >
              {isExecuting ? "Running..." : "Run Query"}
            </Button>
            {isExecuting && onCancel && (
              <Button size="small" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </Box>
        </Box>

        {/* Bottom pane: Results */}
        <Box sx={{ height: "100%", overflow: "hidden" }}>
          {isExecuting ? (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress size={24} sx={{ mr: 1 }} />
              <Typography color="text.secondary">Executing query...</Typography>
            </Box>
          ) : error ? (
            <Box sx={{ p: 2 }}>
              <Typography color="error">{error}</Typography>
            </Box>
          ) : !hasResults ? (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography color="text.secondary">
                Run a query to see results
              </Typography>
            </Box>
          ) : showDiff ? (
            <QueryDiffView
              columns={diffData.columns}
              rows={diffData.rows}
              primaryKeys={primaryKeys}
              displayMode={diffMode}
            />
          ) : (
            <QueryResults
              columns={currentGrid.columns}
              rows={currentGrid.rows}
            />
          )}
        </Box>
      </SplitPane>
    </Box>
  );
}

/**
 * Memoized QueryView component for performance optimization.
 */
export const QueryView = memo(QueryViewComponent);
QueryView.displayName = "QueryView";
