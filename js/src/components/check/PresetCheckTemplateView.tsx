import { Editor } from "@monaco-editor/react";
import YAML from "yaml";

export function generateCheckTemplate({
  name,
  description,
  type,
  params,
  viewOptions,
}: PresetCheckTemplateViewProps) {
  const check: Record<string, unknown> = { name, description, type, params };
  if (viewOptions) {
    check.view_options = viewOptions;
  }
  return YAML.stringify({
    checks: [check],
  });
}

interface PresetCheckTemplateViewProps {
  name: string;
  description: string;
  type: string;
  params: Record<string, unknown>;
  viewOptions?: Record<string, unknown>;
}

export function PresetCheckTemplateView({
  yamlTemplate,
}: {
  yamlTemplate: string;
}) {
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
