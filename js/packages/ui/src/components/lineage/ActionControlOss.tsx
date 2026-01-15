"use client";

/**
 * @file ActionControlOss.tsx
 * @description OSS wrapper around @datarecce/ui ActionControl
 */

import { useLineageViewContextSafe } from "../../contexts";
import { ActionControl as BaseActionControl } from "./controls";

/**
 * Props for the ActionControl wrapper component.
 */
export interface ActionControlOssProps {
  /**
   * Callback invoked when the user clicks the Close button (after action completes)
   */
  onClose: () => void;
}

/**
 * ActionControl Component (Wrapper)
 *
 * Wraps the @datarecce/ui ActionControl component with context from
 * LineageViewContext.
 */
export function ActionControlOss({ onClose }: ActionControlOssProps) {
  const { cancel, actionState } = useLineageViewContextSafe();

  return (
    <BaseActionControl
      actionState={actionState}
      onCancel={cancel}
      onClose={onClose}
    />
  );
}
