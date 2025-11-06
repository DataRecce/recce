import { Check } from "@/lib/api/checks";
import { QueryParams, QueryDiffParams } from "@/lib/api/adhocQuery";
import { stripIndent } from "common-tags";

export function buildTitle(check: Check) {
  return `${check.is_checked ? "✅ " : ""}${check.name}`;
}

export function buildDescription(check: Check) {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return check.description ? check.description : "_(no description)_";
}

export function buildQuery(check: Check) {
  const params = check.params as QueryParams | QueryDiffParams;
  return stripIndent`
    **SQL**
    \`\`\`sql
    ${
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      params?.sql_template ?? ""
    }
    \`\`\`
    `;
}
