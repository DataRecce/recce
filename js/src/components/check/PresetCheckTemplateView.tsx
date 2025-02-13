import { Editor } from "@monaco-editor/react";
import YAML from "yaml";
export function generateCheckTemplate({
  name,
  description,
  type,
  params,
  viewOptions,
}: PresetCheckTemplateViewProps) {
  const check: any = { name, description, type, params };
  if (viewOptions) {
    check.view_options = viewOptions;
  }
  const yamlTemplate = YAML.stringify({
    checks: [check],
  });
  return yamlTemplate;
}

interface PresetCheckTemplateViewProps {
  name: string;
  description: string;
  type: string;
  params: any;
  viewOptions: any;
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
