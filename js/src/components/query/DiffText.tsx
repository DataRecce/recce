/**
 * DiffText - OSS wrapper around @datarecce/ui DiffText with toast notifications
 *
 * This file re-exports the DiffText component from @datarecce/ui and adds
 * the OSS-specific toast notification for copy actions.
 */

// Import directly from source to avoid pulling in ag-grid through primitives barrel
import {
  DiffText as DiffTextBase,
  type DiffTextProps as DiffTextPropsBase,
} from "@datarecce/ui/components/ui/DiffText";
import { useCopyToClipboard } from "usehooks-ts";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";

// Re-export the type for consumers
export type DiffTextProps = Omit<DiffTextPropsBase, "onCopy">;

/**
 * DiffText component with OSS-specific copy-to-clipboard toast notifications.
 *
 * This is a wrapper around the @datarecce/ui DiffText component that adds
 * the toast notification behavior used throughout the OSS application.
 */
export function DiffText(props: DiffTextProps) {
  const [, copyToClipboard] = useCopyToClipboard();
  const { successToast } = useClipBoardToast();

  const handleCopy = (value: string) => {
    copyToClipboard(value);
    successToast(`${value} copied`);
  };

  return <DiffTextBase {...props} onCopy={handleCopy} />;
}
