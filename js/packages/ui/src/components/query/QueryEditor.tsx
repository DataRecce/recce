"use client";

import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { memo, type ReactNode, useMemo } from "react";

/**
 * Supported editor languages
 */
export type QueryEditorLanguage = "sql" | "yaml";

/**
 * Editor theme options
 */
export type QueryEditorTheme = "light" | "dark";

/**
 * Keyboard binding configuration
 */
export interface QueryEditorKeyBinding {
  /** Key combination (e.g., "Mod-Enter" for Ctrl/Cmd+Enter) */
  key: string;
  /** Handler function, return true to indicate event was handled */
  run: () => boolean;
}

/**
 * Props for the QueryEditor component
 */
export interface QueryEditorProps {
  /** SQL/YAML value */
  value: string;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Editor language */
  language?: QueryEditorLanguage;
  /** Whether editor is read-only */
  readOnly?: boolean;
  /** Show line numbers */
  lineNumbers?: boolean;
  /** Enable word wrap */
  wordWrap?: boolean;
  /** Font size in pixels */
  fontSize?: number;
  /** Editor height (CSS value) */
  height?: string;
  /** Color theme */
  theme?: QueryEditorTheme;
  /** Custom keyboard bindings */
  keyBindings?: QueryEditorKeyBinding[];
  /** Optional CSS class name */
  className?: string;
}

/**
 * Props for QueryEditorToolbar
 */
export interface QueryEditorToolbarProps {
  /** Label to display (e.g., "BASE", "CURRENT") */
  label?: string;
  /** Metadata info (e.g., schema, timestamp) */
  metadata?: string;
  /** Show run button */
  showRunButton?: boolean;
  /** Callback when run is clicked */
  onRun?: () => void;
  /** Whether run is disabled */
  runDisabled?: boolean;
  /** Run button label */
  runLabel?: string;
  /** Run button icon */
  runIcon?: ReactNode;
  /** Additional toolbar content */
  children?: ReactNode;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Props for QueryEditorWithToolbar
 */
export interface QueryEditorWithToolbarProps extends QueryEditorProps {
  /** Toolbar label */
  label?: string;
  /** Toolbar metadata */
  metadata?: string;
  /** Show run button */
  showRunButton?: boolean;
  /** Callback when run is clicked */
  onRun?: () => void;
  /** Whether run is disabled */
  runDisabled?: boolean;
  /** Custom toolbar content */
  toolbarContent?: ReactNode;
}

/**
 * Get CodeMirror language extension
 */
const getLanguageExtension = (language: QueryEditorLanguage) => {
  switch (language) {
    case "sql":
      return sql({ dialect: PostgreSQL });
    case "yaml":
      return yaml();
    default:
      return sql({ dialect: PostgreSQL });
  }
};

/**
 * QueryEditorToolbar Component
 *
 * A toolbar for SQL editors with label, metadata, and run button.
 *
 * @example Basic usage
 * ```tsx
 * <QueryEditorToolbar
 *   label="BASE"
 *   metadata="public.users, 2 hours ago"
 *   showRunButton
 *   onRun={() => executeQuery()}
 * />
 * ```
 */
function QueryEditorToolbarComponent({
  label,
  metadata,
  showRunButton = false,
  onRun,
  runDisabled = false,
  runLabel = "Run Query",
  runIcon,
  children,
  className,
}: QueryEditorToolbarProps) {
  return (
    <Stack
      direction="row"
      className={className}
      sx={{
        bgcolor: "action.hover",
        height: 40,
        minHeight: 40,
        fontSize: "14px",
        alignItems: "center",
        px: 2,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      {label && (
        <Typography component="strong" sx={{ fontWeight: "bold" }}>
          {label.toUpperCase()}
        </Typography>
      )}
      {metadata && (
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          ({metadata})
        </Typography>
      )}
      <Box sx={{ flexGrow: 1 }} />
      {children}
      {showRunButton && onRun && (
        <Button
          size="small"
          variant="outlined"
          onClick={onRun}
          disabled={runDisabled}
          startIcon={runIcon}
          sx={{ bgcolor: "background.paper" }}
        >
          {runLabel}
        </Button>
      )}
    </Stack>
  );
}

export const QueryEditorToolbar = memo(QueryEditorToolbarComponent);
QueryEditorToolbar.displayName = "QueryEditorToolbar";

/**
 * QueryEditor Component
 *
 * A pure presentation component for SQL/YAML editing based on CodeMirror 6.
 * Supports custom keyboard bindings, themes, and various editor options.
 *
 * @example Basic usage
 * ```tsx
 * import { QueryEditor } from '@datarecce/ui/primitives';
 *
 * function SqlPanel({ sql, onChange }) {
 *   return (
 *     <QueryEditor
 *       value={sql}
 *       onChange={onChange}
 *       language="sql"
 *       theme="dark"
 *     />
 *   );
 * }
 * ```
 *
 * @example With keyboard shortcuts
 * ```tsx
 * <QueryEditor
 *   value={sql}
 *   onChange={setSql}
 *   keyBindings={[
 *     { key: 'Mod-Enter', run: () => { executeQuery(); return true; } },
 *   ]}
 * />
 * ```
 *
 * @example Read-only view
 * ```tsx
 * <QueryEditor
 *   value={sql}
 *   readOnly
 *   lineNumbers={false}
 * />
 * ```
 */
function QueryEditorComponent({
  value,
  onChange,
  language = "sql",
  readOnly = false,
  lineNumbers = true,
  wordWrap = true,
  fontSize = 14,
  height = "100%",
  theme = "light",
  keyBindings = [],
  className,
}: QueryEditorProps) {
  const extensions = useMemo(() => {
    const exts = [
      getLanguageExtension(language),
      EditorView.theme({
        "&": { fontSize: `${fontSize}px` },
        ".cm-content": { fontFamily: "monospace" },
        ".cm-gutters": { fontFamily: "monospace" },
      }),
    ];

    if (wordWrap) {
      exts.push(EditorView.lineWrapping);
    }

    if (keyBindings.length > 0) {
      exts.push(Prec.highest(keymap.of(keyBindings)));
    }

    return exts;
  }, [language, fontSize, wordWrap, keyBindings]);

  const themeExtension = useMemo(() => {
    return theme === "dark" ? githubDark : githubLight;
  }, [theme]);

  const handleChange = (val: string) => {
    onChange?.(val);
  };

  return (
    <CodeMirror
      value={value}
      onChange={handleChange}
      extensions={extensions}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers,
        foldGutter: true,
        highlightActiveLineGutter: !readOnly,
        highlightActiveLine: !readOnly,
        tabSize: 2,
      }}
      height={height}
      className={className}
      theme={themeExtension}
    />
  );
}

export const QueryEditor = memo(QueryEditorComponent);
QueryEditor.displayName = "QueryEditor";

/**
 * QueryEditorWithToolbar Component
 *
 * QueryEditor with an integrated toolbar for label, metadata, and run button.
 *
 * @example Basic usage
 * ```tsx
 * import { QueryEditorWithToolbar } from '@datarecce/ui/primitives';
 *
 * function SqlPanel() {
 *   return (
 *     <QueryEditorWithToolbar
 *       value={sql}
 *       onChange={setSql}
 *       label="BASE"
 *       metadata="public.users"
 *       showRunButton
 *       onRun={executeQuery}
 *     />
 *   );
 * }
 * ```
 */
function QueryEditorWithToolbarComponent({
  label,
  metadata,
  showRunButton,
  onRun,
  runDisabled,
  toolbarContent,
  ...editorProps
}: QueryEditorWithToolbarProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {(label || showRunButton || toolbarContent) && (
        <QueryEditorToolbar
          label={label}
          metadata={metadata}
          showRunButton={showRunButton}
          onRun={onRun}
          runDisabled={runDisabled}
        >
          {toolbarContent}
        </QueryEditorToolbar>
      )}
      <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
        <QueryEditor {...editorProps} />
      </Box>
    </Box>
  );
}

export const QueryEditorWithToolbar = memo(QueryEditorWithToolbarComponent);
QueryEditorWithToolbar.displayName = "QueryEditorWithToolbar";
