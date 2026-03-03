"use client";

import { memo } from "react";
import YAML from "yaml";
import { useIsDark } from "../../hooks/useIsDark";
import { CodeEditor } from "../editor/CodeEditor";

/**
 * Props for generating a preset check template
 */
export interface GenerateCheckTemplateOptions {
  /** Check name */
  name: string;
  /** Check description */
  description: string;
  /** Check type (e.g., "row_count_diff", "schema_diff") */
  type: string;
  /** Check parameters */
  params: Record<string, unknown>;
  /** View options (optional) */
  viewOptions?: Record<string, unknown>;
}

/**
 * Generates a YAML template for a preset check configuration.
 * This can be used to export checks to recce.yml.
 *
 * @example
 * ```ts
 * const template = generateCheckTemplate({
 *   name: "Schema Check",
 *   description: "Check for schema changes",
 *   type: "schema_diff",
 *   params: { select: "state:modified" },
 * });
 * // Returns:
 * // checks:
 * //   - name: Schema Check
 * //     description: Check for schema changes
 * //     type: schema_diff
 * //     params:
 * //       select: state:modified
 * ```
 */
export function generateCheckTemplate({
  name,
  description,
  type,
  params,
  viewOptions,
}: GenerateCheckTemplateOptions): string {
  const check: Record<string, unknown> = { name, description, type, params };
  if (viewOptions) {
    check.view_options = viewOptions;
  }
  return YAML.stringify({
    checks: [check],
  });
}

/**
 * Props for the PresetCheckTemplateView component
 */
export interface PresetCheckTemplateViewProps {
  /** The YAML template string to display */
  yamlTemplate: string;
  /** Optional height for the editor */
  height?: string;
}

/**
 * PresetCheckTemplateView Component
 *
 * A presentation component for displaying a preset check YAML template
 * in a read-only code editor. Used in modals to show users how to
 * add checks to their recce.yml file.
 *
 * @example Basic usage
 * ```tsx
 * import { PresetCheckTemplateView, generateCheckTemplate } from '@datarecce/ui/primitives';
 *
 * function CheckTemplateDialog({ check }) {
 *   const template = generateCheckTemplate({
 *     name: check.name,
 *     description: check.description,
 *     type: check.type,
 *     params: check.params,
 *   });
 *
 *   return (
 *     <Dialog open>
 *       <DialogContent>
 *         <PresetCheckTemplateView yamlTemplate={template} />
 *       </DialogContent>
 *     </Dialog>
 *   );
 * }
 * ```
 */
function PresetCheckTemplateViewComponent({
  yamlTemplate,
  height = "300px",
}: PresetCheckTemplateViewProps) {
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
      height={height}
    />
  );
}

export const PresetCheckTemplateView = memo(PresetCheckTemplateViewComponent);
PresetCheckTemplateView.displayName = "PresetCheckTemplateView";
