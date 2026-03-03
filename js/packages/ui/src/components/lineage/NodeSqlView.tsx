"use client";

import Box from "@mui/material/Box";
import MuiDialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import type { ComponentType } from "react";
import { useState } from "react";
import { FaExpandArrowsAlt } from "react-icons/fa";
import { IoClose } from "react-icons/io5";

/**
 * Props for a code editor component.
 * Used for dependency injection to avoid coupling to a specific editor implementation.
 */
export interface CodeEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  lineNumbers?: boolean;
  wordWrap?: boolean;
  theme?: "light" | "dark";
  fontSize?: number;
  height?: string;
  className?: string;
}

/**
 * Props for a diff editor component.
 * Used for dependency injection to avoid coupling to a specific editor implementation.
 */
export interface DiffEditorProps {
  original: string;
  modified: string;
  language?: string;
  readOnly?: boolean;
  lineNumbers?: boolean;
  sideBySide?: boolean;
  theme?: "light" | "dark";
  height?: string;
  className?: string;
}

/**
 * Node data structure representing model information for SQL display.
 * Fields are optional to accommodate various node data structures from the API.
 */
export interface NodeSqlViewNodeData {
  resourceType?: string;
  data: {
    base?: { raw_code?: string; name?: string };
    current?: { raw_code?: string; name?: string };
  };
  name?: string;
}

/**
 * Props for the NodeSqlView component.
 *
 * This component uses dependency injection for editor components to avoid
 * coupling to specific editor implementations like CodeMirror.
 *
 * Editor component props use `ComponentType<any>` to allow implementations
 * with more specific prop types (e.g., language as a union type vs string).
 * The component internally passes the correct props matching the interfaces above.
 */
export interface NodeSqlViewProps {
  /**
   * Node containing model data with SQL code.
   */
  node: {
    data: NodeSqlViewNodeData;
  };
  /**
   * Whether the environment is single-env mode (no diff view).
   */
  isSingleEnv: boolean;
  /**
   * Code editor component for single-env mode.
   * Should accept props matching CodeEditorProps interface.
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  CodeEditor: ComponentType<any>;
  /**
   * Diff editor component for comparing base vs current.
   * Should accept props matching DiffEditorProps interface.
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  DiffEditor: ComponentType<any>;
  /**
   * Whether dark mode is enabled.
   */
  isDark?: boolean;
}

/**
 * Displays SQL code for a lineage node with an expandable dialog.
 *
 * In single-env mode, shows just the code. Otherwise, shows a diff view
 * comparing base and current versions.
 *
 * Editor components are injected as props to allow the consuming application
 * to provide its own editor implementations (e.g., CodeMirror, Monaco).
 */
export const NodeSqlView = ({
  node,
  isSingleEnv,
  CodeEditor,
  DiffEditor,
  isDark = false,
}: NodeSqlViewProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  if (
    node.data.resourceType !== "model" &&
    node.data.resourceType !== "snapshot"
  ) {
    return "Not available";
  }

  const original = node.data.data.base?.raw_code;
  const modified = node.data.data.current?.raw_code;
  const modelName =
    node.data.data.base?.name ?? node.data.data.current?.name ?? "";

  return (
    <Box
      className="no-track-pii-safe"
      sx={{ position: "relative", height: "100%" }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      {isSingleEnv ? (
        <CodeEditor
          language="sql"
          value={original ?? ""}
          readOnly={true}
          lineNumbers={true}
          wordWrap={false}
          theme={isDark ? "dark" : "light"}
        />
      ) : (
        <DiffEditor
          original={original ?? ""}
          modified={modified ?? ""}
          language="sql"
          readOnly={true}
          lineNumbers={true}
          sideBySide={false} // Inline diff mode
          theme={isDark ? "dark" : "light"}
          height="100%"
        />
      )}
      <IconButton
        onClick={() => setIsOpen(true)}
        size="medium"
        aria-label="Expand"
        sx={{
          position: "absolute",
          top: "5px",
          right: "20px",
          opacity: isHovered ? 0.5 : 0.1,
          transition: "opacity 0.3s ease-in-out",
        }}
      >
        <FaExpandArrowsAlt />
      </IconButton>
      <MuiDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { height: "75%", overflowY: "auto" } },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
          {isSingleEnv ? (
            <>
              <code>{modelName}</code>&nbsp;Model Code
            </>
          ) : (
            <>
              <code>{modelName}</code>&nbsp;Model Code Diff
            </>
          )}
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => setIsOpen(false)}>
            <IoClose />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {isSingleEnv ? (
            <CodeEditor
              language="sql"
              value={original ?? ""}
              fontSize={16}
              readOnly={true}
              lineNumbers={true}
              wordWrap={false}
              theme={isDark ? "dark" : "light"}
            />
          ) : (
            <DiffEditor
              original={original ?? ""}
              modified={modified ?? ""}
              language="sql"
              theme={isDark ? "dark" : "light"}
              className="text-base"
            />
          )}
        </DialogContent>
      </MuiDialog>
    </Box>
  );
};
