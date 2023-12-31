import MonacoEditor, { EditorProps } from "@monaco-editor/react";

interface SqlEditorProps {
  language?: string;
  theme?: string;
  value: string;
  onChange?: (value: string) => void;
  onRun?: () => void;
  onRunDiff?: () => void;
  options?: EditorProps["options"];
}

const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onRun,
  onRunDiff,
  options = {},
  ...props
}: SqlEditorProps) => {
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && onChange) {
      onChange(value);
    }
  };

  return (
    <MonacoEditor
      language="sql"
      theme="vs"
      value={value}
      onChange={handleEditorChange}
      onMount={(editor, monaco) => {
        if (onRun) {
          editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
            onRun
          );
        }

        if (onRunDiff) {
          editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
            onRunDiff
          );
        }
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
        ...options,
      }}
    />
  );
};

export default SqlEditor;
