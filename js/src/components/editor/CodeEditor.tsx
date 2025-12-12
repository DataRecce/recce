"use client";

import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { EditorView, keymap } from "@codemirror/view";
import CodeMirror, { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { useMemo } from "react";

export type CodeEditorLanguage = "sql" | "yaml";

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: CodeEditorLanguage;
  readOnly?: boolean;
  lineNumbers?: boolean;
  wordWrap?: boolean;
  fontSize?: number;
  height?: string;
  className?: string;
  /** Custom keyboard shortcuts: { key: handler } */
  keyBindings?: Array<{ key: string; run: () => boolean }>;
}

const getLanguageExtension = (language: CodeEditorLanguage) => {
  switch (language) {
    case "sql":
      return sql({ dialect: PostgreSQL });
    case "yaml":
      return yaml();
    default:
      return sql({ dialect: PostgreSQL });
  }
};

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
  keyBindings = [],
}: CodeEditorProps) {
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
      exts.push(keymap.of(keyBindings));
    }

    return exts;
  }, [language, fontSize, wordWrap, keyBindings]);

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
      theme="light"
    />
  );
}

export default CodeEditor;
