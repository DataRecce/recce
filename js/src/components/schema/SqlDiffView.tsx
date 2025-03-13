import { NodeData } from "@/lib/api/info";
import { Box } from "@chakra-ui/react";
import { DiffEditor } from "@monaco-editor/react";
import type { editor as monacoEditor } from "monaco-editor";
import { useEffect, useRef } from "react";

interface SqlDiffProps {
  base?: NodeData;
  current?: NodeData;
  singleEnv?: boolean;
  options?: monacoEditor.IDiffEditorConstructionOptions;
}

interface UseDiffEditorSync {
  onMount: (editor: monacoEditor.IStandaloneDiffEditor) => void;
}

function useDiffEditorSync(value: string, onChange: (value: string) => void): UseDiffEditorSync {
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.getValue()) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  return {
    onMount(editor: monacoEditor.IStandaloneDiffEditor) {
      const modified = editor.getModifiedEditor();
      editorRef.current = modified;

      modified.onDidChangeModelContent(() => {
        onChange(modified.getValue());
      });
    },
  };
}

export function SqlDiffView({ base, current, singleEnv, options }: SqlDiffProps) {
  return (
    <DiffEditor
      language="sql"
      theme="vs"
      original={base?.raw_code}
      modified={current?.raw_code}
      options={{
        readOnly: true,
        lineNumbers: "on",
        automaticLayout: true,
        renderOverviewRuler: false,
        minimap: { enabled: false },
        ...options,
      }}
    />
  );
}
interface SqlPreviewProps {
  current?: NodeData;
  onChange: (value: string) => void;
}

export function SqlPreview({ current, onChange }: SqlPreviewProps) {
  const diffEditorSync = useDiffEditorSync(current?.raw_code || "", onChange);

  return (
    <Box flex={1} overflowY={"auto"}>
      <DiffEditor
        language="sql"
        theme="vs"
        original={current?.raw_code}
        modified={current?.raw_code}
        options={{
          readOnly: false,
          fontSize: 14,
          lineNumbers: "on",
          automaticLayout: true,
          renderOverviewRuler: false,
          minimap: { enabled: true },
        }}
        onMount={diffEditorSync.onMount}
      />
    </Box>
  );
}
