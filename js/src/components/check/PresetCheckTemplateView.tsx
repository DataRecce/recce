import YAML from "yaml";
import { CodeEditor } from "@/components/editor";
import { useIsDark } from "@/lib/hooks/useIsDark";

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
  const isDark = useIsDark();
  return (
    <CodeEditor
      value={yamlTemplate}
      language="yaml"
      readOnly={true}
      lineNumbers={false}
      wordWrap={true}
      fontSize={14}
      theme={isDark ? "dark" : "light"}
      height="300px"
    />
  );
}
