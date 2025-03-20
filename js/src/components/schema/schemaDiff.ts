import { NodeColumnData } from "@/lib/api/info";

export function isSchemaChanged(
  baseSchema: Record<string, NodeColumnData> | undefined,
  currSchema: Record<string, NodeColumnData> | undefined,
) {
  if (!baseSchema || !currSchema) {
    return undefined;
  }
  const baseKeys = Object.keys(baseSchema);
  const currKeys = Object.keys(currSchema);

  // added, removed
  if (baseKeys.length !== currKeys.length) {
    return true;
  }

  // reordered
  for (let i = 0; i < baseKeys.length; i++) {
    if (baseKeys[i] !== currKeys[i]) {
      return true;
    }
  }

  // modified
  for (const key of currKeys) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!baseSchema[key] || baseSchema[key].type !== currSchema[key].type) {
      return true;
    }
  }
  return false;
}
