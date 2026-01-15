"use client";

import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";

/**
 * Supported languages for the code editor
 */
export type CodeEditorLanguage = "sql" | "yaml" | "text";

/**
 * Theme options for the code editor
 */
export type CodeEditorTheme = "light" | "dark";

/**
 * Props for the CodeEditor component
 */
export interface CodeEditorProps {
  /** The code content to display */
  value: string;
  /** Callback when content changes */
  onChange?: (value: string) => void;
  /** Language for syntax highlighting */
  language?: CodeEditorLanguage;
  /** Whether editor is read-only */
  readOnly?: boolean;
  /** Show line numbers */
  lineNumbers?: boolean;
  /** Enable word wrap */
  wordWrap?: boolean;
  /** Font size in pixels */
  fontSize?: number;
  /** Editor height */
  height?: string;
  /** Optional CSS class */
  className?: string;
  /** Theme mode */
  theme?: CodeEditorTheme;
  /** Custom keyboard shortcuts */
  keyBindings?: Array<{ key: string; run: () => boolean }>;
}

/**
 * Get language extension for CodeMirror
 */
function getLanguageExtension(language: CodeEditorLanguage) {
  switch (language) {
    case "sql":
      return sql({ dialect: PostgreSQL });
    case "yaml":
      return yaml();
    default:
      return null;
  }
}

/**
 * CodeEditor Component
 *
 * A code editor component using CodeMirror with React integration.
 * Supports SQL and YAML syntax highlighting with customizable theming.
 *
 * @example Basic usage
 * ```tsx
 * import { CodeEditor } from '@datarecce/ui/primitives';
 *
 * function SqlEditor({ sql, onSqlChange }) {
 *   return (
 *     <CodeEditor
 *       value={sql}
 *       onChange={onSqlChange}
 *       language="sql"
 *     />
 *   );
 * }
 * ```
 *
 * @example Read-only with dark theme
 * ```tsx
 * <CodeEditor
 *   value={yamlContent}
 *   language="yaml"
 *   readOnly
 *   theme="dark"
 *   height="300px"
 * />
 * ```
 *
 * @example With custom key bindings
 * ```tsx
 * const keyBindings = [
 *   { key: "Mod-Enter", run: () => { handleSubmit(); return true; } }
 * ];
 *
 * <CodeEditor
 *   value={sql}
 *   onChange={setSql}
 *   language="sql"
 *   keyBindings={keyBindings}
 * />
 * ```
 */
export function CodeEditor({
  value,
  onChange,
  language = "sql",
  readOnly = false,
  lineNumbers = true,
  wordWrap = true,
  fontSize = 14,
  height = "100%",
  className = "",
  theme = "light",
  keyBindings = [],
}: CodeEditorProps) {
  const extensions = useMemo(() => {
    const exts = [
      EditorView.theme({
        "&": { fontSize: `${fontSize}px` },
        ".cm-content": {
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        },
        ".cm-gutters": {
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        },
      }),
    ];

    // Add language extension if not plain text
    const langExt = getLanguageExtension(language);
    if (langExt) {
      exts.push(langExt);
    }

    if (wordWrap) {
      exts.push(EditorView.lineWrapping);
    }

    // Use Prec.highest to ensure custom keybindings take precedence
    // over defaultKeymap bindings (e.g., Mod-Enter -> insertBlankLine)
    if (keyBindings.length > 0) {
      exts.push(Prec.highest(keymap.of(keyBindings)));
    }

    return exts;
  }, [language, fontSize, wordWrap, keyBindings]);

  const themeExtension = useMemo(() => {
    return theme === "dark" ? githubDark : githubLight;
  }, [theme]);

  const handleChange = (val: string) => {
    if (onChange) {
      onChange(val);
    }
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
      className={`${className} no-track-pii-safe`}
      theme={themeExtension}
    />
  );
}

export default CodeEditor;
