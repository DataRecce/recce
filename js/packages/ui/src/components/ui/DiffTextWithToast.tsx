/**
 * DiffTextWithToast - DiffText component with integrated toast notifications
 *
 * This component wraps the base DiffText and adds toast notification
 * feedback for copy-to-clipboard actions.
 */

import { useCopyToClipboard } from "usehooks-ts";
import { useClipBoardToast } from "../../hooks/useClipBoardToast";
import { DiffText, type DiffTextProps } from "./DiffText";

// Re-export the type for consumers (without onCopy since we handle it)
export type DiffTextWithToastProps = Omit<DiffTextProps, "onCopy">;

/**
 * DiffText component with automatic copy-to-clipboard toast notifications.
 *
 * This is a convenience wrapper around the base DiffText component that adds
 * the toast notification behavior. Use this when you want the "batteries included"
 * experience with copy feedback.
 *
 * @example
 * ```tsx
 * // Shows toast when user clicks copy icon
 * <DiffTextWithToast base="old value" current="new value" />
 * ```
 */
export function DiffTextWithToast(props: DiffTextWithToastProps) {
  const [, copyToClipboard] = useCopyToClipboard();
  const { successToast } = useClipBoardToast();

  const handleCopy = (value: string) => {
    copyToClipboard(value);
    successToast(`${value} copied`);
  };

  return <DiffText {...props} onCopy={handleCopy} />;
}
