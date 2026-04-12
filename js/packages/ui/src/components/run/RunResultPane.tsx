"use client";

/**
 * @file run/RunResultPane.tsx
 * @description Reusable run result pane component with dependency injection support.
 *
 * This component provides the core UI for displaying run results including:
 * - Tab navigation (Result, Params, Query)
 * - Run status display
 * - Export/Share menus (injectable)
 * - Add to checklist functionality (injectable)
 *
 * OSS-specific behaviors are injected via props to maintain platform independence.
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { formatDistanceToNow } from "date-fns";
import {
  type ComponentType,
  type ForwardRefExoticComponent,
  type MouseEvent,
  memo,
  type ReactNode,
  type Ref,
  type RefAttributes,
  useCallback,
  useState,
} from "react";
import { IoClose } from "react-icons/io5";
import {
  PiCaretDown,
  PiCheck,
  PiClipboardText,
  PiDownloadSimple,
  PiImage,
  PiRepeat,
  PiTable,
} from "react-icons/pi";
import YAML from "yaml";
import type { Run, RunParamTypes } from "../../api";
import { useIsDark } from "../../hooks/useIsDark";
import { CodeEditor } from "../../primitives";
import { formatRowCount } from "../../utils";
import { RunView } from "./RunView";
import type { RunResultViewProps, RunResultViewRef } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Tab values for the run result pane
 */
export type RunResultPaneTabValue = "result" | "params" | "query";

/**
 * Props for CSV export functionality
 */
export interface CSVExportProps {
  /** Whether CSV export is available */
  canExportCSV: boolean;
  /** Total row count from backend (null if unavailable) */
  totalRowCount?: number | null;
  /** Copy data as CSV to clipboard */
  copyAsCSV: () => Promise<void>;
  /** Copy data as TSV to clipboard (pastes into spreadsheets) */
  copyAsTSV?: () => Promise<void>;
  /** Download data as CSV file */
  downloadAsCSV: () => void;
  /** Download data as TSV file */
  downloadAsTSV?: () => void;
  /** Download data as Excel file */
  downloadAsExcel?: () => void;
}

/**
 * Props for the export menu component
 */
export interface RunResultExportMenuProps {
  /** The current run */
  run?: Run;
  /** Whether export is disabled */
  disableExport: boolean;
  /** Handler for copy as image */
  onCopyAsImage: () => Promise<void>;
  /** Handler for mouse enter (for highlight effect) */
  onMouseEnter?: () => void;
  /** Handler for mouse leave (for highlight effect) */
  onMouseLeave?: () => void;
  /** CSV export functionality */
  csvExport?: CSVExportProps;
}

/**
 * Props for the share menu component
 */
export interface RunResultShareMenuProps extends RunResultExportMenuProps {
  /** Whether user is authenticated */
  authed?: boolean;
  /** Handler for share to cloud */
  onShareToCloud?: () => Promise<void>;
  /** Handler for showing auth modal when not authenticated */
  onShowAuthModal?: () => void;
}

/**
 * Props for the Add to Check button
 */
export interface AddToCheckButtonProps {
  /** The current run ID */
  runId?: string;
  /** The current run */
  run?: Run;
  /** Whether the button is disabled due to feature toggle */
  disableUpdateChecklist?: boolean;
  /** Whether the checklist is disabled specifically due to permission denial (viewer role) — shows tooltip */
  checklistPermissionDenied?: boolean;
  /** Whether there's an error */
  hasError?: boolean;
  /** Handler for navigating to existing check */
  onGoToCheck?: (checkId: string) => void;
  /** Handler for adding run to checklist */
  onAddToChecklist?: () => Promise<void>;
}

/**
 * Props for the single environment setup notification
 */
export interface SingleEnvironmentNotificationProps {
  /** The run type */
  runType?: string;
  /** Component to render the notification */
  NotificationComponent?: ComponentType<{
    runType?: string;
    onClose: () => void;
  }>;
}

/**
 * Props for the SQL editor components
 */
export interface SqlEditorProps {
  /** SQL query value */
  value: string;
  /** Base SQL query value (for diff views) */
  baseValue?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
}

/**
 * Props for RunResultPane component.
 * Uses dependency injection for OSS-specific behavior.
 */
export interface RunResultPaneProps<VO = unknown, RefType = unknown> {
  // ============================================================================
  // Core Data
  // ============================================================================

  /** The run ID */
  runId?: string;

  /** The run object */
  run?: Run;

  /** Whether the run is currently executing */
  isRunning?: boolean;

  /** Error object if run failed */
  error?: Error | null;

  // ============================================================================
  // View Configuration
  // ============================================================================

  /** Current view options */
  viewOptions?: VO;

  /** Callback when view options change */
  onViewOptionsChanged?: (viewOptions: VO) => void;

  /** Whether this is a single environment (base not configured) */
  isSingleEnvironment?: boolean;

  // ============================================================================
  // Feature Toggles
  // ============================================================================

  /** Disable database query execution */
  disableDatabaseQuery?: boolean;

  /** Disable share functionality (show export menu instead) */
  disableShare?: boolean;

  /** Disable update checklist functionality */
  disableUpdateChecklist?: boolean;

  /** Whether checklist is disabled due to permission denial (viewer role) — shows disabled button with tooltip instead of hiding */
  checklistPermissionDenied?: boolean;

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /** Handler for closing the pane */
  onClose?: () => void;

  /** Handler for cancelling a running query */
  onCancel?: () => void;

  /** Handler for re-running the query */
  onRerun?: () => void;

  // ============================================================================
  // Export/Share Handlers (Dependency Injection)
  // ============================================================================

  /** Handler for copying as image */
  onCopyAsImage?: () => Promise<void>;

  /** Mouse enter handler for copy button highlight */
  onCopyMouseEnter?: () => void;

  /** Mouse leave handler for copy button highlight */
  onCopyMouseLeave?: () => void;

  /** CSV export functionality */
  csvExport?: CSVExportProps;

  /** Whether user is authenticated (for share menu) */
  authed?: boolean;

  /** Handler for share to cloud */
  onShareToCloud?: () => Promise<void>;

  /** Handler for showing auth modal */
  onShowAuthModal?: () => void;

  /** Optional tracking callback for copy to clipboard */
  onTrackCopyToClipboard?: (type: string, from: string) => void;

  // ============================================================================
  // Checklist Handlers (Dependency Injection)
  // ============================================================================

  /** Handler for navigating to existing check */
  onGoToCheck?: (checkId: string) => void;

  /** Handler for adding run to checklist */
  onAddToChecklist?: () => Promise<void>;

  // ============================================================================
  // Custom Components (Dependency Injection)
  // ============================================================================

  /** Custom notification component for single environment setup */
  SingleEnvironmentNotification?: ComponentType<{
    runType?: string;
    onClose: () => void;
  }>;

  /** Custom SQL editor component */
  SqlEditorComponent?: ComponentType<SqlEditorProps>;

  /** Custom dual SQL editor component (for query diff) */
  DualSqlEditorComponent?: ComponentType<SqlEditorProps>;

  /** Custom auth modal component */
  AuthModalComponent?: ComponentType<{
    open: boolean;
    onClose: () => void;
  }>;

  /** Result view component from registry */
  RunResultView?: ForwardRefExoticComponent<
    RunResultViewProps<VO> & RefAttributes<RefType>
  >;

  /** Ref for the result view (for screenshots) */
  resultViewRef?: Ref<RefType>;

  // ============================================================================
  // Children (Alternative to RunResultView)
  // ============================================================================

  /** Custom result renderer */
  children?: (props: {
    run: Run;
    viewOptions?: VO;
    onViewOptionsChanged?: (viewOptions: VO) => void;
  }) => ReactNode;
}

// ============================================================================
// Internal Components
// ============================================================================

/**
 * Params view component - displays run parameters as YAML
 */
const ParamView = memo(
  ({ type, params }: { type: string; params: RunParamTypes }) => {
    const isDark = useIsDark();
    const yaml = YAML.stringify({ type, params }, null, 2);
    return (
      <CodeEditor
        value={yaml}
        language="yaml"
        readOnly={true}
        lineNumbers={false}
        wordWrap={true}
        fontSize={14}
        height="100%"
        theme={isDark ? "dark" : "light"}
        className="no-track-pii-safe"
      />
    );
  },
);
ParamView.displayName = "ParamView";

// ============================================================================
// Export Helpers
// ============================================================================

const LARGE_EXPORT_THRESHOLD = 100_000;

function downloadLabel(base: string, totalRowCount?: number | null): string {
  if (totalRowCount != null && totalRowCount > 0) {
    return `${base} (${formatRowCount(totalRowCount)})`;
  }
  return base;
}

interface LargeExportWarningDialogProps {
  open: boolean;
  rowCount: number;
  onContinue: () => void;
  onCancel: () => void;
}

const LargeExportWarningDialog = memo(
  ({ open, rowCount, onContinue, onCancel }: LargeExportWarningDialogProps) => (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>Large Export Warning</DialogTitle>
      <DialogContent>
        <DialogContentText>
          You are about to download <strong>{formatRowCount(rowCount)}</strong>.
          This may take a while and produce a large file. Are you sure you want
          to continue?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onContinue} variant="contained">
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  ),
);
LargeExportWarningDialog.displayName = "LargeExportWarningDialog";

/**
 * Default export menu component
 */
const DefaultExportMenu = memo(
  ({
    disableExport,
    onCopyAsImage,
    onMouseEnter,
    onMouseLeave,
    csvExport,
  }: RunResultExportMenuProps) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);
    const [showWarning, setShowWarning] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(
      null,
    );

    const totalRowCount = csvExport?.totalRowCount ?? 0;
    const needsWarning = totalRowCount > LARGE_EXPORT_THRESHOLD;

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
      setAnchorEl(null);
    };

    const handleDownload = (action: () => void) => {
      if (needsWarning) {
        setPendingAction(() => action);
        setShowWarning(true);
      } else {
        action();
        handleClose();
      }
    };

    const handleWarningContinue = () => {
      setShowWarning(false);
      pendingAction?.();
      setPendingAction(null);
      handleClose();
    };

    const handleWarningCancel = () => {
      setShowWarning(false);
      setPendingAction(null);
    };

    return (
      <>
        <Button
          size="small"
          variant="outlined"
          color="neutral"
          onClick={handleClick}
          endIcon={<PiCaretDown />}
          sx={{ textTransform: "none" }}
        >
          Export
        </Button>
        <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
          <MenuItem
            onClick={async () => {
              await onCopyAsImage();
              handleClose();
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            disabled={disableExport}
          >
            <ListItemIcon>
              <PiImage />
            </ListItemIcon>
            <ListItemText>Copy as Image</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={async () => {
              await csvExport?.copyAsTSV?.();
              handleClose();
            }}
            disabled={disableExport || !csvExport?.canExportCSV}
          >
            <ListItemIcon>
              <PiClipboardText />
            </ListItemIcon>
            <ListItemText>Copy as Text</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={async () => {
              await csvExport?.copyAsCSV();
              handleClose();
            }}
            disabled={disableExport || !csvExport?.canExportCSV}
          >
            <ListItemIcon>
              <PiTable />
            </ListItemIcon>
            <ListItemText>Copy as CSV</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => handleDownload(() => csvExport?.downloadAsCSV())}
            disabled={disableExport || !csvExport?.canExportCSV}
          >
            <ListItemIcon>
              <PiDownloadSimple />
            </ListItemIcon>
            <ListItemText>
              {downloadLabel("Download as CSV", csvExport?.totalRowCount)}
            </ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => handleDownload(() => csvExport?.downloadAsTSV?.())}
            disabled={disableExport || !csvExport?.canExportCSV}
          >
            <ListItemIcon>
              <PiDownloadSimple />
            </ListItemIcon>
            <ListItemText>
              {downloadLabel("Download as TSV", csvExport?.totalRowCount)}
            </ListItemText>
          </MenuItem>
          {csvExport?.downloadAsExcel && (
            <MenuItem
              onClick={() =>
                handleDownload(() => csvExport?.downloadAsExcel?.())
              }
              disabled={disableExport || !csvExport?.canExportCSV}
            >
              <ListItemIcon>
                <PiDownloadSimple />
              </ListItemIcon>
              <ListItemText>
                {downloadLabel("Download as Excel", csvExport?.totalRowCount)}
              </ListItemText>
            </MenuItem>
          )}
        </Menu>
        <LargeExportWarningDialog
          open={showWarning}
          rowCount={totalRowCount}
          onContinue={handleWarningContinue}
          onCancel={handleWarningCancel}
        />
      </>
    );
  },
);
DefaultExportMenu.displayName = "DefaultExportMenu";

/**
 * Default share menu component
 */
const DefaultShareMenu = memo(
  ({
    disableExport,
    onCopyAsImage,
    onMouseEnter,
    onMouseLeave,
    csvExport,
  }: RunResultExportMenuProps) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);
    const [showWarning, setShowWarning] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(
      null,
    );

    const totalRowCount = csvExport?.totalRowCount ?? 0;
    const needsWarning = totalRowCount > LARGE_EXPORT_THRESHOLD;

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
      setAnchorEl(null);
    };

    const handleDownload = (action: () => void) => {
      if (needsWarning) {
        setPendingAction(() => action);
        setShowWarning(true);
      } else {
        action();
        handleClose();
      }
    };

    const handleWarningContinue = () => {
      setShowWarning(false);
      pendingAction?.();
      setPendingAction(null);
      handleClose();
    };

    const handleWarningCancel = () => {
      setShowWarning(false);
      setPendingAction(null);
    };

    return (
      <>
        <Button
          size="small"
          variant="outlined"
          color="neutral"
          onClick={handleClick}
          endIcon={<PiCaretDown />}
          sx={{ textTransform: "none" }}
        >
          Share
        </Button>
        <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
          <MenuItem
            onClick={async () => {
              await onCopyAsImage();
              handleClose();
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            disabled={disableExport}
          >
            <ListItemIcon>
              <PiImage />
            </ListItemIcon>
            <ListItemText>Copy as Image</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={async () => {
              await csvExport?.copyAsTSV?.();
              handleClose();
            }}
            disabled={disableExport || !csvExport?.canExportCSV}
          >
            <ListItemIcon>
              <PiClipboardText />
            </ListItemIcon>
            <ListItemText>Copy as Text</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={async () => {
              await csvExport?.copyAsCSV();
              handleClose();
            }}
            disabled={disableExport || !csvExport?.canExportCSV}
          >
            <ListItemIcon>
              <PiTable />
            </ListItemIcon>
            <ListItemText>Copy as CSV</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => handleDownload(() => csvExport?.downloadAsCSV())}
            disabled={disableExport || !csvExport?.canExportCSV}
          >
            <ListItemIcon>
              <PiDownloadSimple />
            </ListItemIcon>
            <ListItemText>
              {downloadLabel("Download as CSV", csvExport?.totalRowCount)}
            </ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => handleDownload(() => csvExport?.downloadAsTSV?.())}
            disabled={disableExport || !csvExport?.canExportCSV}
          >
            <ListItemIcon>
              <PiDownloadSimple />
            </ListItemIcon>
            <ListItemText>
              {downloadLabel("Download as TSV", csvExport?.totalRowCount)}
            </ListItemText>
          </MenuItem>
          {csvExport?.downloadAsExcel && (
            <MenuItem
              onClick={() =>
                handleDownload(() => csvExport?.downloadAsExcel?.())
              }
              disabled={disableExport || !csvExport?.canExportCSV}
            >
              <ListItemIcon>
                <PiDownloadSimple />
              </ListItemIcon>
              <ListItemText>
                {downloadLabel("Download as Excel", csvExport?.totalRowCount)}
              </ListItemText>
            </MenuItem>
          )}
        </Menu>
        <LargeExportWarningDialog
          open={showWarning}
          rowCount={totalRowCount}
          onContinue={handleWarningContinue}
          onCancel={handleWarningCancel}
        />
      </>
    );
  },
);
DefaultShareMenu.displayName = "DefaultShareMenu";

/**
 * Default Add to Check button component
 */
const DefaultAddToCheckButton = memo(
  ({
    runId,
    run,
    disableUpdateChecklist,
    checklistPermissionDenied,
    hasError,
    onGoToCheck,
    onAddToChecklist,
  }: AddToCheckButtonProps) => {
    const checkId = run?.check_id;
    const disabled = !runId || !run?.result || hasError;

    // Hide entirely when disabled for non-permission reasons (single_env, read-only)
    if (disableUpdateChecklist && !checklistPermissionDenied) {
      return null;
    }

    // "Go to Check" is always available — viewers can navigate to existing checks
    if (checkId) {
      return (
        <Button
          disabled={disabled}
          size="small"
          variant="contained"
          onClick={() => onGoToCheck?.(checkId)}
          startIcon={<PiCheck />}
          sx={{ textTransform: "none" }}
        >
          Go to Check
        </Button>
      );
    }

    return (
      <Tooltip
        title={
          checklistPermissionDenied
            ? "You don't have permission to add checks"
            : ""
        }
      >
        <span>
          <Button
            disabled={disabled || checklistPermissionDenied}
            size="small"
            variant="contained"
            onClick={onAddToChecklist}
            startIcon={<PiCheck />}
            sx={{ textTransform: "none" }}
          >
            Add to Checklist
          </Button>
        </span>
      </Tooltip>
    );
  },
);
DefaultAddToCheckButton.displayName = "DefaultAddToCheckButton";

/**
 * Run status and date display component
 */
const RunStatusAndDateDisplay = memo(({ run }: { run: Run }) => {
  const statusText =
    run.status || (run.result ? "Finished" : run.error ? "Failed" : "unknown");

  // Determine color based on status
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "finished":
        return "success.main";
      case "failed":
        return "error.main";
      case "running":
        return "primary.main";
      case "cancelled":
      default:
        return "text.secondary";
    }
  };

  const relativeTime = run.run_at
    ? formatDistanceToNow(new Date(run.run_at), { addSuffix: true })
    : "Unknown time";

  return (
    <Typography variant="body2" sx={{ color: "text.secondary" }}>
      <Box
        component="span"
        sx={{ color: getStatusColor(statusText) }}
        fontWeight={600}
      >
        {statusText}
      </Box>
      {"・"}
      {relativeTime}
    </Typography>
  );
});
RunStatusAndDateDisplay.displayName = "RunStatusAndDateDisplay";

// ============================================================================
// Main Component
// ============================================================================

/**
 * RunResultPane Component
 *
 * A reusable component for displaying run results with tabs for Result, Params, and Query.
 * Uses dependency injection for OSS-specific behaviors like tracking, sharing, and checklist.
 *
 * @example Basic usage with run data
 * ```tsx
 * import { RunResultPane } from '@datarecce/ui/components/run';
 *
 * function MyRunView({ run }) {
 *   return (
 *     <RunResultPane
 *       run={run}
 *       runId={run.run_id}
 *       onClose={() => handleClose()}
 *       onRerun={() => handleRerun()}
 *       RunResultView={MyResultView}
 *     />
 *   );
 * }
 * ```
 *
 * @example With OSS-specific injections
 * ```tsx
 * <RunResultPane
 *   run={run}
 *   runId={run.run_id}
 *   onCopyAsImage={handleCopyAsImage}
 *   csvExport={{ canExportCSV: true, copyAsCSV, downloadAsCSV }}
 *   onShareToCloud={handleShare}
 *   onTrackCopyToClipboard={(type, from) => trackCopyToClipboard({ type, from })}
 *   onAddToChecklist={handleAddToChecklist}
 *   authed={isAuthenticated}
 *   RunResultView={QueryResultView}
 * />
 * ```
 */
function RunResultPaneComponent<VO = unknown, RefType = unknown>({
  // Core data
  runId,
  run,
  isRunning,
  error,

  // View configuration
  viewOptions,
  onViewOptionsChanged,
  isSingleEnvironment,

  // Feature toggles
  disableDatabaseQuery,
  disableShare,
  disableUpdateChecklist,
  checklistPermissionDenied,

  // Event handlers
  onClose,
  onCancel: _onCancel,
  onRerun,

  // Export/Share handlers
  onCopyAsImage,
  onCopyMouseEnter,
  onCopyMouseLeave,
  csvExport,
  authed,
  onShareToCloud,
  onShowAuthModal,
  onTrackCopyToClipboard,

  // Checklist handlers
  onGoToCheck,
  onAddToChecklist,

  // Custom components
  SingleEnvironmentNotification,
  SqlEditorComponent,
  DualSqlEditorComponent,
  AuthModalComponent,
  RunResultView,
  resultViewRef,

  // Children
  children,
}: RunResultPaneProps<VO, RefType>) {
  const isDark = useIsDark();
  const [tabValue, setTabValue] = useState<RunResultPaneTabValue>("result");
  const [showSingleEnvNotification, setShowSingleEnvNotification] =
    useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const isQuery =
    run?.type === "query" ||
    run?.type === "query_diff" ||
    run?.type === "query_base";

  const disableCopyToClipboard =
    !runId || !run?.result || !!error || tabValue !== "result";

  const handleCopyAsImage = useCallback(async () => {
    await onCopyAsImage?.();
    if (onTrackCopyToClipboard) {
      onTrackCopyToClipboard(run?.type ?? "unknown", "run");
    }
  }, [onCopyAsImage, onTrackCopyToClipboard, run?.type]);

  // Determine if we should show query tab content
  const isQueryDiff = run?.type === "query_diff";
  const queryParams = run?.params as
    | { sql_template?: string; base_sql_template?: string }
    | undefined;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: isDark ? "grey.900" : "grey.50",
      }}
    >
      {/* Single environment notification */}
      {isSingleEnvironment &&
        showSingleEnvNotification &&
        SingleEnvironmentNotification && (
          <SingleEnvironmentNotification
            runType={run?.type}
            onClose={() => setShowSingleEnvNotification(false)}
          />
        )}

      {/* Header with tabs and actions */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          borderBottom: 1,
          borderColor: "divider",
          mb: "1px",
        }}
      >
        <Tabs
          value={tabValue}
          onChange={(_, newValue) =>
            setTabValue(newValue as RunResultPaneTabValue)
          }
        >
          <Tab label="Result" value="result" />
          <Tab label="Params" value="params" />
          {isQuery && <Tab label="Query" value="query" />}
        </Tabs>
        <Box sx={{ flexGrow: 1 }} />
        <Stack
          direction="row"
          spacing={1}
          sx={{ overflow: "hidden", pr: 1 }}
          alignItems="center"
        >
          {run && <RunStatusAndDateDisplay run={run} />}
          <Button
            variant="outlined"
            color="neutral"
            disabled={!runId || isRunning || disableDatabaseQuery}
            size="small"
            onClick={onRerun}
            startIcon={<PiRepeat />}
            sx={{ textTransform: "none" }}
          >
            Rerun
          </Button>

          {/* Export or Share menu */}
          {disableShare ? (
            <DefaultExportMenu
              run={run}
              disableExport={disableCopyToClipboard}
              onCopyAsImage={handleCopyAsImage}
              onMouseEnter={onCopyMouseEnter}
              onMouseLeave={onCopyMouseLeave}
              csvExport={csvExport}
            />
          ) : (
            <DefaultShareMenu
              run={run}
              disableExport={disableCopyToClipboard}
              onCopyAsImage={handleCopyAsImage}
              onMouseEnter={onCopyMouseEnter}
              onMouseLeave={onCopyMouseLeave}
              csvExport={csvExport}
            />
          )}

          {/* Add to Check button */}
          <DefaultAddToCheckButton
            runId={runId}
            run={run}
            disableUpdateChecklist={disableUpdateChecklist}
            checklistPermissionDenied={checklistPermissionDenied}
            hasError={!!error}
            onGoToCheck={onGoToCheck}
            onAddToChecklist={onAddToChecklist}
          />

          {/* Close button */}
          <IconButton size="small" onClick={onClose}>
            <IoClose />
          </IconButton>
        </Stack>
      </Box>

      {/* Tab content */}
      {tabValue === "result" && (RunResultView || children) && (
        <RunView
          ref={resultViewRef}
          isRunning={isRunning}
          error={error}
          run={run}
          onCancel={_onCancel}
          viewOptions={viewOptions}
          onViewOptionsChanged={onViewOptionsChanged}
          RunResultView={RunResultView}
        >
          {children}
        </RunView>
      )}

      {tabValue === "params" && run && (
        <ParamView type={run.type} params={run.params} />
      )}

      {tabValue === "query" && run && isQuery && queryParams?.sql_template && (
        <>
          {isQueryDiff && DualSqlEditorComponent ? (
            <DualSqlEditorComponent
              value={queryParams.sql_template}
              baseValue={queryParams.base_sql_template}
              readOnly={true}
            />
          ) : SqlEditorComponent ? (
            <SqlEditorComponent
              value={queryParams.sql_template}
              readOnly={true}
            />
          ) : (
            <CodeEditor
              value={queryParams.sql_template}
              language="sql"
              readOnly={true}
              theme="dark"
              height="100%"
            />
          )}
        </>
      )}

      {/* Auth modal */}
      {AuthModalComponent && showAuthModal && (
        <AuthModalComponent
          open={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </Box>
  );
}

export const RunResultPane = memo(RunResultPaneComponent) as <
  VO = unknown,
  RefType = unknown,
>(
  props: RunResultPaneProps<VO, RefType>,
) => ReturnType<typeof RunResultPaneComponent>;

// Add display name for debugging
(RunResultPane as { displayName?: string }).displayName = "RunResultPane";
