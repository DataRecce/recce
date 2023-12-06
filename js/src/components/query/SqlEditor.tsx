import React, { useEffect, useRef } from "react";
import MonacoEditor from "@monaco-editor/react";

interface SqlEditorProps {
  language?: string;
  theme?: string;
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
}

const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onRun,
  ...props
}: SqlEditorProps) => {
  const editorRef = useRef(null);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
    }
  };

  return (
    <MonacoEditor
      language={props.language || "sql"}
      theme={props.theme || "vs"}
      value={value}
      onChange={handleEditorChange}
      onMount={(editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, onRun);
      }}
      options={{
        tabSize: 2,
        fontSize: 16,
        lineNumbers: "on",
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: "on",
        wrappingIndent: "indent",
        // Additional options as needed
      }}
    />
  );
};

export default SqlEditor;
