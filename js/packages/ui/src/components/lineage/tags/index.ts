/**
 * @file index.ts
 * @description Exports for lineage tag components
 *
 * Tag components are small visual indicators used within lineage graph nodes
 * to show metadata like resource type, row counts, etc.
 */

export {
  ResourceTypeTag,
  type ResourceTypeTagData,
  type ResourceTypeTagProps,
} from "./ResourceTypeTag";
export { getTagRootSx, tagStartElementSx } from "./tagStyles";
