"use client";

import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { MergeView, unifiedMergeView } from "@codemirror/merge";
import { EditorState, Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useMemo, useRef } from "react";

export type DiffEditorLanguage = "sql" | "yaml";

export interface DiffEditorProps {
  original: string;
  modified: string;
  language?: DiffEditorLanguage;
  readOnly?: boolean;
  lineNumbers?: boolean;
  sideBySide?: boolean;
  height?: string;
  className?: string;
  /** Called when modified content changes (only if not readOnly) */
  onModifiedChange?: (value: string) => void;
}

const getLanguageExtension = (language: DiffEditorLanguage) => {
  switch (language) {
    case "sql":
      return sql({ dialect: PostgreSQL });
    case "yaml":
      return yaml();
    default:
      return sql({ dialect: PostgreSQL });
  }
};

export function DiffEditor({
  original,
  modified,
  language = "sql",
  readOnly = true,
  lineNumbers = true,
  sideBySide = true,
  height = "100%",
  className = "",
  onModifiedChange,
}: DiffEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MergeView | EditorView | null>(null);

  const extensions = useMemo(() => {
    return [getLanguageExtension(language)];
  }, [language]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous instance
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    if (sideBySide) {
      // Side-by-side mode using MergeView
      const mergeView = new MergeView({
        a: {
          doc: original,
          extensions: [
            ...extensions,
            EditorView.editable.of(false),
            EditorState.readOnly.of(true),
          ],
        },
        b: {
          doc: modified,
          extensions: [
            ...extensions,
            EditorView.editable.of(!readOnly),
            EditorState.readOnly.of(readOnly),
            EditorView.updateListener.of((update) => {
              if (update.docChanged && onModifiedChange) {
                onModifiedChange(update.state.doc.toString());
              }
            }),
          ],
        },
        parent: containerRef.current,
        revertControls: !readOnly ? "a-to-b" : undefined,
        highlightChanges: true,
        gutter: lineNumbers,
      });

      viewRef.current = mergeView;
    } else {
      // Unified/inline mode using unifiedMergeView
      const editorView = new EditorView({
        doc: modified,
        extensions: [
          ...extensions,
          unifiedMergeView({
            original: Text.of(original.split("\n")),
            highlightChanges: true,
            gutter: lineNumbers,
          }),
          EditorView.editable.of(!readOnly),
          EditorState.readOnly.of(readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && onModifiedChange) {
              onModifiedChange(update.state.doc.toString());
            }
          }),
        ],
        parent: containerRef.current,
      });

      viewRef.current = editorView;
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, [
    original,
    modified,
    extensions,
    readOnly,
    lineNumbers,
    sideBySide,
    onModifiedChange,
  ]);

  return (
    <div
      ref={containerRef}
      className={`${className} no-track-pii-safe`}
      style={{ height, overflow: "auto" }}
    />
  );
}

export default DiffEditor;
