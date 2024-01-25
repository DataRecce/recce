import { Check } from "@/lib/api/checks";
import { stripIndent } from "common-tags";

export function buildTitle(check: Check) {
    return `${check.is_checked ? "✅ " : ""}${check.name}`;
  }

export function buildDescription(check: Check) {
    return check.description ? check.description : "_(no description)_";
  }
  
export function buildQuery(check: Check) {
    return stripIndent`
    **SQL**
    \`\`\`sql
    ${check.params?.sql_template}
    \`\`\`
    `;
  }
