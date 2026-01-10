/**
 * @file DiffText.tsx
 * @description Re-exports DiffTextWithToast from @datarecce/ui as DiffText
 *
 * This file re-exports the toast-enabled DiffText component from @datarecce/ui.
 * The implementation has been migrated to the shared UI package.
 *
 * For consumers that need the base DiffText without toast, import directly:
 * import { DiffText } from "@datarecce/ui/components/ui/DiffText";
 */

export {
  DiffTextWithToast as DiffText,
  type DiffTextWithToastProps as DiffTextProps,
} from "@datarecce/ui/components/ui";
