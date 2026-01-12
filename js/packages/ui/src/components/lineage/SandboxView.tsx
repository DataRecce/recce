"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MuiDialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import { AiOutlineExperiment } from "react-icons/ai";
import { IoClose } from "react-icons/io5";
import { VscFeedback } from "react-icons/vsc";
import { useLineageGraphContext } from "../../contexts/lineage";
import { colors } from "../../theme";
import { VSplit } from "../ui/Split";

/**
 * Props for a diff editor component used in the sandbox.
 * Supports editing the modified version while keeping original read-only.
 */
export interface SandboxDiffEditorProps {
  original: string;
  modified: string;
  language?: string;
  readOnly?: boolean;
  lineNumbers?: boolean;
  sideBySide?: boolean;
  theme?: "light" | "dark";
  height?: string;
  onModifiedChange?: (value: string) => void;
}

/**
 * Node data structure representing model information for the sandbox.
 */
export interface SandboxNodeData {
  id?: string;
  name?: string;
  raw_code?: string;
}

/**
 * Props for the QueryForm slot component.
 */
export interface SandboxQueryFormProps {
  defaultPrimaryKeys: string[];
  onPrimaryKeysChange: (primaryKeys: string[]) => void;
}

/**
 * Props for the RunResultPane slot component.
 */
export interface SandboxRunResultPaneProps {
  onClose: () => void;
  disableAddToChecklist?: boolean;
}

/**
 * Tracking event types for the sandbox.
 */
export interface SandboxTrackingCallbacks {
  onPreviewChange?: (params: {
    action: "run" | "close";
    node?: string;
    status?: "success" | "failure";
  }) => void;
  onFeedbackSubmit?: (params: {
    feedback: "like" | "dislike" | "form";
    node?: string;
  }) => void;
  onSingleEnvironment?: (params: {
    action: string;
    from: string;
    node?: string;
  }) => void;
}

/**
 * Props for the SandboxView component.
 *
 * This component uses dependency injection for editor and form components
 * to avoid coupling to specific implementations.
 */
export interface SandboxViewProps {
  /**
   * Whether the sandbox dialog is open.
   */
  isOpen: boolean;

  /**
   * Callback when the dialog is closed.
   */
  onClose: () => void;

  /**
   * Current node data containing model info and SQL code.
   */
  current?: SandboxNodeData;

  /**
   * Height of the dialog (not used in fullscreen mode).
   */
  height?: string;

  /**
   * Diff editor component for SQL editing.
   * Should accept props matching SandboxDiffEditorProps interface.
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  DiffEditor: ComponentType<any>;

  /**
   * Query form component for primary key selection.
   * Should accept props matching SandboxQueryFormProps interface.
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  QueryForm: ComponentType<any>;

  /**
   * Run result pane component for displaying query results.
   * Should accept props matching SandboxRunResultPaneProps interface.
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  RunResultPane: ComponentType<any>;

  /**
   * Whether dark mode is enabled.
   */
  isDark?: boolean;

  /**
   * Primary keys for query diffing.
   */
  primaryKeys?: string[];

  /**
   * Callback when primary keys change.
   */
  onPrimaryKeysChange?: (keys: string[]) => void;

  /**
   * Whether a query is currently running.
   */
  isPending?: boolean;

  /**
   * Callback to run the query.
   */
  onRunQuery?: () => void;

  /**
   * Callback when run result pane opens (before running query).
   */
  onRunResultOpen?: () => void;

  /**
   * Callback when modified code changes.
   */
  onModifiedCodeChange?: (code: string) => void;

  /**
   * Callback to show feedback toast.
   */
  onShowFeedback?: () => void;

  /**
   * Tracking callbacks for analytics.
   */
  tracking?: SandboxTrackingCallbacks;

  /**
   * Logo image URL for the header.
   * @default "/logo/recce-logo-white.png"
   */
  logoUrl?: string;

  /**
   * Brand name to display in header.
   * @default "RECCE"
   */
  brandName?: string;
}

/**
 * Helper function to format timestamp for display.
 */
function formatTimestamp(timestamp: string): string {
  const date = parseISO(timestamp);
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}

interface SandboxTopBarProps {
  current?: SandboxNodeData;
  primaryKeys: string[];
  onPrimaryKeysChange: (primaryKeys: string[]) => void;
  onRunResultOpen: () => void;
  runQuery: () => void;
  isPending: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  QueryForm: ComponentType<any>;
}

function SandboxTopBar({
  current,
  primaryKeys,
  onPrimaryKeysChange,
  onRunResultOpen,
  runQuery,
  isPending,
  QueryForm,
}: SandboxTopBarProps) {
  return (
    <Stack
      direction="row"
      justifyContent="flex-end"
      alignItems="center"
      sx={{
        p: "4pt 8pt",
        gap: "5px",
        height: "54px",
        borderBottom: "1px solid",
        borderBottomColor: "divider",
        flex: "0 0 54px",
      }}
    >
      <Box>
        <Typography
          variant="h6"
          component="h2"
          sx={{ display: "flex", alignItems: "center", gap: "5px" }}
        >
          <Box component={AiOutlineExperiment} sx={{ fontSize: "1.2em" }} />
          Sandbox
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "grey.500" }}>
          Compare the run results based on the modified SQL code of model{" "}
          <b>{current?.name}</b>
        </Typography>
      </Box>
      <Box sx={{ flexGrow: 1 }} />
      <QueryForm
        defaultPrimaryKeys={primaryKeys}
        onPrimaryKeysChange={onPrimaryKeysChange}
      />
      <MuiTooltip title="Run diff to see the changes">
        <Button
          size="small"
          sx={{ mt: "16px", fontSize: "14px" }}
          onClick={() => {
            onRunResultOpen();
            runQuery();
          }}
          color="iochmara"
          variant="contained"
          disabled={isPending}
        >
          {isPending ? "Running..." : "Run Diff"}
        </Button>
      </MuiTooltip>
    </Stack>
  );
}

interface SandboxEditorLabelsProps {
  currentModelID: string;
  height?: string;
  flex?: string;
  isDark?: boolean;
}

function SandboxEditorLabels({
  currentModelID,
  height = "32px",
  flex = "0 0 auto",
  isDark = false,
}: SandboxEditorLabelsProps) {
  const { lineageGraph, envInfo } = useLineageGraphContext();
  const widthOfBar = "50%";
  const margin = "0 16px";

  const currentTime = formatTimestamp(
    envInfo?.dbt?.current?.generated_at ?? "",
  );
  const latestUpdateDistanceToNow = formatDistanceToNow(currentTime, {
    addSuffix: true,
  });
  let schema = "N/A";
  if (lineageGraph?.nodes[currentModelID]) {
    const value = lineageGraph.nodes[currentModelID];
    if (value.data.data.current?.schema) {
      schema = value.data.data.current.schema;
    }
  }

  return (
    <Stack
      direction="row"
      sx={{
        gap: 0,
        height,
        flex,
        fontSize: "14px",
        alignItems: "center",
        m: 0,
        bgcolor: isDark
          ? alpha(colors.neutral[700], 0.5)
          : alpha(colors.neutral[100], 0.5),
      }}
    >
      <Stack sx={{ width: widthOfBar }}>
        <Typography sx={{ fontWeight: "bold", margin }}>
          ORIGINAL (Schema: {schema}, Last Updated: {latestUpdateDistanceToNow})
        </Typography>
      </Stack>
      <Stack sx={{ width: widthOfBar }}>
        <Typography sx={{ fontWeight: "bold", margin }}>
          SANDBOX EDITOR
        </Typography>
      </Stack>
    </Stack>
  );
}

interface SqlPreviewProps {
  current?: SandboxNodeData;
  onChange: (value: string) => void;
  isDark?: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  DiffEditor: ComponentType<any>;
}

function SqlPreview({
  current,
  onChange,
  isDark,
  DiffEditor,
}: SqlPreviewProps) {
  return (
    <DiffEditor
      original={current?.raw_code ?? ""}
      modified={current?.raw_code ?? ""}
      language="sql"
      readOnly={false}
      lineNumbers={true}
      sideBySide={true}
      theme={isDark ? "dark" : "light"}
      height="100%"
      onModifiedChange={onChange}
    />
  );
}

/**
 * SandboxView Component
 *
 * A modal dialog for previewing and comparing SQL code changes in a sandbox environment.
 * Allows editing modified SQL and running diff queries against the data warehouse.
 *
 * Components are injected as props to allow the consuming application
 * to provide its own implementations (e.g., specific editors, form components).
 */
export function SandboxView({
  isOpen,
  onClose,
  current,
  DiffEditor,
  QueryForm,
  RunResultPane,
  isDark = false,
  primaryKeys = [],
  onPrimaryKeysChange,
  isPending = false,
  onRunQuery,
  onRunResultOpen,
  onModifiedCodeChange,
  onShowFeedback,
  tracking,
  logoUrl = "/logo/recce-logo-white.png",
  brandName = "RECCE",
}: SandboxViewProps) {
  const [isRunResultOpen, setIsRunResultOpen] = useState(false);

  const handleModifiedCodeChange = (code: string) => {
    onModifiedCodeChange?.(code);
  };

  const handleRunResultOpen = () => {
    setIsRunResultOpen(true);
    onRunResultOpen?.();
  };

  const handleRunQuery = () => {
    onRunQuery?.();
  };

  const handleClose = () => {
    onClose();
    setIsRunResultOpen(false);
    tracking?.onPreviewChange?.({ action: "close", node: current?.name });
  };

  const handlePrimaryKeysChange = (keys: string[]) => {
    onPrimaryKeysChange?.(keys);
  };

  return (
    <MuiDialog
      open={isOpen}
      onClose={handleClose}
      maxWidth={false}
      fullWidth
      slotProps={{
        paper: {
          sx: {
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            m: 0,
          },
        },
      }}
    >
      <Box
        sx={{
          height: "40px",
          bgcolor: "cyan.600",
          px: 0,
          py: 2,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          sx={{ height: "100%", gap: "10px" }}
        >
          <Box
            component="img"
            sx={{ width: "20px", height: "20px", ml: "18px" }}
            src={logoUrl}
            alt="logo"
          />
          <Typography
            variant="h6"
            component="h1"
            sx={{
              fontFamily: '"Montserrat", sans-serif',
              fontSize: "1.125rem",
              color: "common.white",
            }}
          >
            {brandName}
          </Typography>
          <Chip
            label="Experiment"
            size="small"
            variant="outlined"
            sx={{
              fontSize: "0.875rem",
              color: "common.white",
              borderColor: "rgba(255,255,255,0.5)",
            }}
          />
        </Stack>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: "absolute",
            right: 8,
            top: 4,
            color: "common.white",
          }}
        >
          <IoClose />
        </IconButton>
      </Box>
      <DialogContent sx={{ p: 0 }}>
        <VSplit
          sizes={isRunResultOpen ? [50, 50] : [100, 0]}
          minSize={isRunResultOpen ? 100 : 0}
          gutterSize={isRunResultOpen ? 5 : 0}
          style={{
            flex: "1",
            contain: "size",
            height: "100%",
          }}
        >
          <Stack sx={{ height: "100%", m: 0, p: 0 }}>
            <SandboxTopBar
              current={current}
              primaryKeys={primaryKeys}
              onPrimaryKeysChange={handlePrimaryKeysChange}
              onRunResultOpen={handleRunResultOpen}
              runQuery={handleRunQuery}
              isPending={isPending}
              QueryForm={QueryForm}
            />
            <SandboxEditorLabels
              height="32px"
              flex="0 0 auto"
              currentModelID={current?.id ?? ""}
              isDark={isDark}
            />
            <SqlPreview
              current={current}
              onChange={handleModifiedCodeChange}
              isDark={isDark}
              DiffEditor={DiffEditor}
            />
          </Stack>
          {isRunResultOpen ? (
            <RunResultPane
              onClose={() => setIsRunResultOpen(false)}
              disableAddToChecklist
            />
          ) : (
            <Box />
          )}
        </VSplit>
      </DialogContent>
      {/* Fixed position button */}
      <Box sx={{ position: "fixed", bottom: 16, right: 16, opacity: 0.5 }}>
        <MuiTooltip title="Give us feedback">
          <IconButton
            aria-label="feedback"
            size="medium"
            onClick={() => {
              onShowFeedback?.();
            }}
          >
            <VscFeedback />
          </IconButton>
        </MuiTooltip>
      </Box>
    </MuiDialog>
  );
}
