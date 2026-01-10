/**
 * @file toaster.tsx
 * @description Re-exports toaster from @datarecce/ui
 *
 * This file re-exports the toast notification system from @datarecce/ui.
 * The implementation has been migrated to the shared UI package.
 */

export {
  Toaster,
  ToasterProvider,
  type ToastOptions,
  toaster,
  useToaster,
} from "@datarecce/ui/components/ui";
