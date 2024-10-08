import { NodeData } from "@/lib/api/info";
import { DiffEditor } from "@monaco-editor/react";

interface SqlDiffProps {
  base?: NodeData;
  current?: NodeData;
}

export function SqlDiffView({ base, current }: SqlDiffProps) {
  return (
    <DiffEditor
      height="100%"
      language="sql"
      theme="vs"
      original={base?.raw_code}
      modified={current?.raw_code}
      options={{
        readOnly: true,
        fontSize: 14,
        lineNumbers: "on",
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: "on",
        wrappingIndent: "same",
      }}
    />
  );
}
