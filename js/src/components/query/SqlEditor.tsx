import React from 'react';
import MonacoEditor from '@monaco-editor/react';


interface SqlEditorProps {
  language?: string;
  theme?: string;
  value: string;
  onChange: (e: any) => void;
}

const SqlEditor: React.FC<SqlEditorProps> = ({ value, onChange, ...props}: SqlEditorProps) => {
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
    onChange(value);
    }
  };

  return (
    <MonacoEditor
      language={props.language || "sql"}
      theme={props.theme || "vs"}
      defaultValue={value}
      onChange={handleEditorChange}
      options={{
        tabSize: 2,
        fontSize: 16,
        lineNumbers: "off",
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: "on",
        wrappingIndent: 'indent',
        // Additional options as needed
      }}
    />
  );
};

export default SqlEditor;
