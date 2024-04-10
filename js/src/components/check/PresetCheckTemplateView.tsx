import { Editor } from "@monaco-editor/react";
import YAML from "yaml";

interface PresetCheckTemplateViewProps {
  name: string;
  description: string;
  type: string;
  viewOptions: any;
}

export function PresetCheckTemplateView({
  name,
  description,
  type,
  viewOptions,
}: PresetCheckTemplateViewProps) {
  const yamlTemplate = YAML.stringify({
    checks: [{ name, description, type, view_options: viewOptions }],
  });
  return (
    <Editor
      height="300px"
      language="yaml"
      theme="vs"
      value={yamlTemplate}
      options={{
        readOnly: true,
        fontSize: 14,
        lineNumbers: "off",
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: "on",
        wrappingIndent: "same",
        scrollBeyondLastLine: false,
      }}
    />
  );
}
