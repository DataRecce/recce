/**
 * @file inlineRenderCell.tsx
 * @description OSS wrapper for inline cell renderer with toast notifications
 *
 * This file creates an inline cell renderer that uses the OSS DiffText component
 * which includes toast notifications on copy actions. The base implementation
 * is provided by @datarecce/ui.
 */

import {
  asNumber as baseAsNumber,
  createInlineRenderCell,
  DiffTextWithToast as DiffText,
  type InlineDiffTextProps,
  type InlineRenderCellConfig,
} from "@datarecce/ui/components/ui";

// Re-export types for backward compatibility
export type { InlineDiffTextProps, InlineRenderCellConfig };
export { baseAsNumber as asNumber };

/**
 * OSS inline cell renderer with DiffText that includes toast notifications
 *
 * This renderer uses the OSS-specific DiffText component which adds
 * clipboard toast notifications on top of the base @datarecce/ui DiffText.
 */
export const inlineRenderCell = createInlineRenderCell({
  DiffTextComponent: DiffText,
});
