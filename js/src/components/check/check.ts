import { stripIndent } from "common-tags";
import { Check } from "@/lib/api/checks";
import { RunParamTypes } from "@/lib/api/types";

export function buildTitle(check: Check) {
  return `${check.is_checked ? "✅ " : ""}${check.name}`;
}

export function buildDescription(check: Check) {
  return (check.description ?? "") || "_(no description)_";
}

export function buildQuery(check: Check<RunParamTypes>) {
  const params = check.params;
  let sqlTemplate = "";
  if (params && "sql_template" in params) {
    sqlTemplate = params.sql_template;
  }
  return stripIndent`
    **SQL**
    \`\`\`sql
    ${sqlTemplate}
    \`\`\`
    `;
}
