/**
 * @file rowBuilders.ts
 * @description OSS re-exports for row building utilities
 *
 * This file re-exports row builders from @datarecce/ui for backward compatibility.
 * New code should import directly from @datarecce/ui/utils.
 */

// Re-export everything from @datarecce/ui
export type {
  BuildDiffRowsConfig,
  BuildDiffRowsResult,
  DiffColumnMapEntry,
} from "@datarecce/ui/utils";

export { buildDiffRows } from "@datarecce/ui/utils";
