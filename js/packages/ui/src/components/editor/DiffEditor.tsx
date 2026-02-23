"use client";

import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import {
  type Chunk,
  getChunks,
  MergeView,
  unifiedMergeView,
} from "@codemirror/merge";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import Box from "@mui/material/Box";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { DiffScrollMap, type ScrollMapMark } from "./DiffScrollMap";

/**
 * Supported languages for the diff editor
 */
export type DiffEditorLanguage = "sql" | "yaml" | "text";

/**
 * Theme options for the diff editor
 */
export type DiffEditorTheme = "light" | "dark";

/**
 * Props for the DiffEditor component
 */
export interface DiffEditorProps {
  /** Original (base) text content */
  original: string;
  /** Modified (current) text content */
  modified: string;
  /** Language for syntax highlighting */
  language?: DiffEditorLanguage;
  /** Whether editor is read-only */
  readOnly?: boolean;
  /** Show line numbers */
  lineNumbers?: boolean;
  /** Side-by-side view (true) or unified view (false) */
  sideBySide?: boolean;
  /** Editor height */
  height?: string;
  /** Theme mode */
  theme?: DiffEditorTheme;
  /** Callback when modified content changes */
  onModifiedChange?: (value: string) => void;
  /** Optional CSS class */
  className?: string;
}

/**
 * Get language extension for CodeMirror
 */
function getLanguageExtension(language: DiffEditorLanguage): Extension | null {
  switch (language) {
    case "sql":
      return sql();
    case "yaml":
      return yaml();
    default:
      return null;
  }
}

/**
 * Get theme extensions for CodeMirror
 */
function getThemeExtensions(isDark: boolean): Extension[] {
  const baseTheme = EditorView.theme(
    {
      "&": {
        backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
        color: isDark ? "#d4d4d4" : "#1f2937",
      },
      ".cm-content": {
        caretColor: isDark ? "#d4d4d4" : "#1f2937",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: "13px",
      },
      ".cm-gutters": {
        backgroundColor: isDark ? "#252526" : "#f5f5f5",
        color: isDark ? "#858585" : "#6b7280",
        border: "none",
      },
      ".cm-activeLineGutter": {
        backgroundColor: isDark ? "#2a2d2e" : "#e5e7eb",
      },
      ".cm-activeLine": {
        backgroundColor: isDark ? "#2a2d2e40" : "#f3f4f640",
      },
      // Merge view specific styles
      ".cm-changedLine": {
        backgroundColor: isDark ? "#3d3d0050" : "#fff3c550",
      },
      ".cm-changedText": {
        backgroundColor: isDark ? "#5c5c0080" : "#fef08a80",
      },
      ".cm-deletedChunk": {
        backgroundColor: isDark ? "#5c1f1f50" : "#ffc5c550",
      },
      ".cm-insertedChunk": {
        backgroundColor: isDark ? "#1a4d1a50" : "#cefece50",
      },
    },
    { dark: isDark },
  );

  return [baseTheme];
}

/**
 * Compute scroll-map marks from diff chunks using the editor view's
 * visual layout. This accounts for collapsed unchanged regions, ensuring
 * marks align with the scrollbar regardless of fold state.
 */
function computeVisualMarks(
  chunks: readonly Chunk[],
  view: EditorView,
): ScrollMapMark[] {
  const lastBlock = view.lineBlockAt(view.state.doc.length);
  const totalHeight = lastBlock.bottom;
  if (totalHeight === 0) return [];

  return chunks.map((c) => {
    let type: "added" | "deleted" | "modified";
    if (c.fromA === c.toA) type = "added";
    else if (c.fromB === c.toB) type = "deleted";
    else type = "modified";

    const fromBlock = view.lineBlockAt(
      Math.min(c.fromB, view.state.doc.length),
    );
    const toBlock =
      c.fromB === c.toB
        ? fromBlock
        : view.lineBlockAt(
            Math.min(Math.max(c.toB - 1, 0), view.state.doc.length),
          );

    const topPercent = (fromBlock.top / totalHeight) * 100;
    const heightPercent = Math.max(
      ((toBlock.bottom - fromBlock.top) / totalHeight) * 100,
      0.5,
    );

    return { topPercent, heightPercent, type };
  });
}

/**
 * DiffEditor Component
 *
 * A pure presentation component for displaying text diffs using CodeMirror's
 * merge view. Supports side-by-side and unified diff views.
 *
 * @example Basic usage
 * ```tsx
 * import { DiffEditor } from '@datarecce/ui/primitives';
 *
 * function SqlDiffPanel({ baseSql, currentSql }) {
 *   return (
 *     <DiffEditor
 *       original={baseSql}
 *       modified={currentSql}
 *       language="sql"
 *       sideBySide
 *     />
 *   );
 * }
 * ```
 *
 * @example Unified view with editing
 * ```tsx
 * const [modifiedSql, setModifiedSql] = useState(currentSql);
 *
 * <DiffEditor
 *   original={baseSql}
 *   modified={modifiedSql}
 *   language="sql"
 *   sideBySide={false}
 *   onModifiedChange={setModifiedSql}
 * />
 * ```
 */
function DiffEditorComponent({
  original,
  modified,
  language = "text",
  readOnly = true,
  lineNumbers: showLineNumbers = true,
  sideBySide = true,
  height = "400px",
  theme = "light",
  onModifiedChange,
  className,
}: DiffEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MergeView | EditorView | null>(null);
  const [marks, setMarks] = useState<ScrollMapMark[]>([]);

  const isDark = theme === "dark";

  const handleMarkClick = useCallback((topPercent: number) => {
    const view = viewRef.current;
    if (!view) return;
    const editorView = view instanceof MergeView ? view.b : view;
    const lastBlock = editorView.lineBlockAt(editorView.state.doc.length);
    const targetPx = (topPercent / 100) * lastBlock.bottom;
    const block = editorView.lineBlockAtHeight(targetPx);
    editorView.dispatch({
      effects: EditorView.scrollIntoView(block.from, { y: "start" }),
    });
  }, []);

  useEffect(() => {
    setMarks([]); // Clear stale marks from previous render
    if (!containerRef.current) return;

    // Clear previous view
    if (viewRef.current) {
      if (viewRef.current instanceof MergeView) {
        viewRef.current.destroy();
      } else {
        viewRef.current.destroy();
      }
      viewRef.current = null;
    }

    // Build extensions
    const extensions: Extension[] = [...getThemeExtensions(isDark)];

    if (showLineNumbers) {
      extensions.push(lineNumbers());
    }

    const langExt = getLanguageExtension(language);
    if (langExt) {
      extensions.push(langExt);
    }

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    // Create update listener if callback provided
    if (onModifiedChange && !readOnly) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onModifiedChange(update.state.doc.toString());
          }
        }),
      );
    }

    // Recompute scroll-map marks when editor geometry changes
    // (e.g. collapsed regions expand/collapse)
    const marksListener = EditorView.updateListener.of((update) => {
      if (update.geometryChanged) {
        const chunkResult = getChunks(update.state);
        if (chunkResult) {
          setMarks(computeVisualMarks(chunkResult.chunks, update.view));
        }
      }
    });

    if (sideBySide) {
      // Side-by-side merge view
      // Note: revertControls is intentionally omitted - MergeView shows no
      // buttons when undefined (unlike unifiedMergeView which defaults to true)
      const mergeView = new MergeView({
        a: {
          doc: original,
          extensions: [...extensions],
        },
        b: {
          doc: modified,
          extensions: [...extensions, marksListener],
        },
        parent: containerRef.current,
        orientation: "a-b",
        highlightChanges: true,
        gutter: true,
        collapseUnchanged: { margin: 3, minSize: 4 },
      });

      viewRef.current = mergeView;

      // Compute initial marks (refined by marksListener on first geometry update)
      const chunkResult = getChunks(mergeView.b.state);
      if (chunkResult) {
        setMarks(computeVisualMarks(chunkResult.chunks, mergeView.b));
      }
    } else {
      // Unified diff view
      const unifiedExtensions = [
        ...extensions,
        marksListener,
        unifiedMergeView({
          original,
          highlightChanges: true,
          gutter: true,
          // Disable accept/reject buttons - this is a read-only diff view
          mergeControls: false,
          collapseUnchanged: { margin: 3, minSize: 4 },
        }),
      ];

      const view = new EditorView({
        state: EditorState.create({
          doc: modified,
          extensions: unifiedExtensions,
        }),
        parent: containerRef.current,
      });

      viewRef.current = view;

      // Compute initial marks (refined by marksListener on first geometry update)
      const chunkResult = getChunks(view.state);
      if (chunkResult) {
        setMarks(computeVisualMarks(chunkResult.chunks, view));
      }
    }

    return () => {
      if (viewRef.current) {
        if (viewRef.current instanceof MergeView) {
          viewRef.current.destroy();
        } else {
          viewRef.current.destroy();
        }
        viewRef.current = null;
      }
    };
  }, [
    original,
    modified,
    language,
    readOnly,
    showLineNumbers,
    sideBySide,
    isDark,
    onModifiedChange,
  ]);

  return (
    <Box
      className={className}
      sx={{
        height,
        width: "100%",
        position: "relative",
        border: "1px solid",
        borderColor: isDark ? "grey.700" : "grey.300",
        borderRadius: 1,
      }}
    >
      <Box
        ref={containerRef}
        sx={{
          height: "100%",
          width: "100%",
          overflow: "auto",
          "& .cm-editor": {
            height: "100%",
          },
          "& .cm-scroller": {
            overflow: "auto",
          },
          // Merge view layout
          "& .cm-merge-view": {
            height: "100%",
          },
          "& .cm-merge-view > div": {
            height: "100%",
          },
        }}
      />
      {marks.length > 0 && (
        <DiffScrollMap
          marks={marks}
          isDark={isDark}
          onMarkClick={handleMarkClick}
        />
      )}
    </Box>
  );
}

export const DiffEditor = memo(DiffEditorComponent);
DiffEditor.displayName = "DiffEditor";
