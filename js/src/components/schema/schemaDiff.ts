import { NodeData } from "@/lib/api/info";

export function isSchemaChanged(
  baseSchema: NodeData["columns"],
  currSchema: NodeData["columns"],
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
    if (!baseSchema[key] || baseSchema[key].type !== currSchema[key]?.type) {
      return true;
    }
  }
  return false;
}
