"use client";

import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { EditorState, type Extension, Prec } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import Box from "@mui/material/Box";
import { memo, useEffect, useRef } from "react";

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
function getLanguageExtension(language: CodeEditorLanguage): Extension | null {
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
 * Get theme extensions for CodeMirror
 * Matches the style used by DiffEditor for consistency
 */
function getThemeExtensions(isDark: boolean, fontSize: number): Extension[] {
  const baseTheme = EditorView.theme(
    {
      "&": {
        backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
        color: isDark ? "#d4d4d4" : "#1f2937",
        fontSize: `${fontSize}px`,
      },
      ".cm-content": {
        caretColor: isDark ? "#d4d4d4" : "#1f2937",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      },
      ".cm-gutters": {
        backgroundColor: isDark ? "#252526" : "#f5f5f5",
        color: isDark ? "#858585" : "#6b7280",
        border: "none",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      },
      ".cm-activeLineGutter": {
        backgroundColor: isDark ? "#2a2d2e" : "#e5e7eb",
      },
      ".cm-activeLine": {
        backgroundColor: isDark ? "#2a2d2e40" : "#f3f4f640",
      },
      ".cm-cursor": {
        borderLeftColor: isDark ? "#d4d4d4" : "#1f2937",
      },
      ".cm-selectionBackground": {
        backgroundColor: isDark ? "#264f78" : "#add6ff",
      },
      "&.cm-focused .cm-selectionBackground": {
        backgroundColor: isDark ? "#264f78" : "#add6ff",
      },
    },
    { dark: isDark },
  );

  return [baseTheme];
}

/**
 * CodeEditor Component
 *
 * A pure presentation component for editing code using CodeMirror.
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
function CodeEditorComponent({
  value,
  onChange,
  language = "sql",
  readOnly = false,
  lineNumbers: showLineNumbers = true,
  wordWrap = true,
  fontSize = 14,
  height = "100%",
  className,
  theme = "light",
  keyBindings = [],
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Track value prop to detect external changes vs internal edits
  const lastValueRef = useRef<string>(value);
  // Store onChange in ref to avoid recreating editor when callback changes
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const isDark = theme === "dark";

  // Create and configure editor
  // biome-ignore lint/correctness/useExhaustiveDependencies: value is intentionally omitted - it's handled by the sync effect below to avoid recreating the editor on every keystroke
  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous view
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    // Build extensions
    const extensions: Extension[] = [...getThemeExtensions(isDark, fontSize)];

    // Add line numbers
    if (showLineNumbers) {
      extensions.push(lineNumbers());
    }

    // Add language extension
    const langExt = getLanguageExtension(language);
    if (langExt) {
      extensions.push(langExt);
    }

    // Add word wrap
    if (wordWrap) {
      extensions.push(EditorView.lineWrapping);
    }

    // Add read-only state
    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    // Add custom key bindings with highest precedence
    if (keyBindings.length > 0) {
      extensions.push(Prec.highest(keymap.of(keyBindings)));
    }

    // Add change listener - use ref to always call current onChange
    if (!readOnly) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            lastValueRef.current = newValue;
            onChangeRef.current?.(newValue);
          }
        }),
      );
    }

    // Create editor view with initial value
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions,
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;
    lastValueRef.current = value;

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [
    language,
    readOnly,
    showLineNumbers,
    wordWrap,
    fontSize,
    isDark,
    keyBindings,
  ]);

  // Sync external value changes into editor without recreating it
  useEffect(() => {
    if (viewRef.current && value !== lastValueRef.current) {
      const currentContent = viewRef.current.state.doc.toString();
      if (currentContent !== value) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: value,
          },
        });
        lastValueRef.current = value;
      }
    }
  }, [value]);

  return (
    <Box
      ref={containerRef}
      className={`${className || ""} no-track-pii-safe`}
      sx={{
        height,
        width: "100%",
        overflow: "auto",
        border: "1px solid",
        borderColor: isDark ? "grey.700" : "grey.300",
        borderRadius: 1,
        "& .cm-editor": {
          height: "100%",
        },
        "& .cm-scroller": {
          overflow: "auto",
        },
      }}
    />
  );
}

export const CodeEditor = memo(CodeEditorComponent);
CodeEditor.displayName = "CodeEditor";
