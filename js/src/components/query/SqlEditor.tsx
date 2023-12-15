import MonacoEditor from "@monaco-editor/react";

interface SqlEditorProps {
  language?: string;
  theme?: string;
  value: string;
  onChange?: (value: string) => void;
  onRun?: () => void;
}

const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onRun,
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
