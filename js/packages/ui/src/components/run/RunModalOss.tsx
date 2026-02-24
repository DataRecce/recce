/**
 * @file run/RunModalOss.tsx
 * @description OSS wrapper for RunModal from @datarecce/ui.
 *
 * This wrapper injects OSS-specific behavior:
 * - Tracking callbacks for analytics (Amplitude)
 * - Documentation URL mapping for run types
 */

import type { ComponentType } from "react";
import { PiInfo } from "react-icons/pi";
import type { Run, RunType } from "../../api";
import {
  EXPLORE_FORM_EVENT,
  isExploreAction,
  trackExploreActionForm,
} from "../../lib/api/track";
import type { RunModalProps as UIRunModalProps } from "./RunModal";
import { RunModal as UIRunModal } from "./RunModal";
import type { RunFormParamTypes, RunFormProps } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * OSS-specific props for RunModal.
 * Extends the base props with OSS form parameter types.
 */
export interface RunModalProps {
  /** Whether the modal is currently open */
  isOpen: boolean;

  /** Callback when the modal is closed */
  onClose: () => void;

  /** Callback when the execute button is clicked */
  onExecute: (type: RunType, params: RunFormParamTypes) => void;

  /** The title displayed in the modal header */
  title: string;

  /** The run type being configured */
  type: RunType;

  /** Initial/default parameters for the form */
  params?: RunFormParamTypes;

  /** The initial run to display (for edit scenarios) */
  initialRun?: Run;

  /** The form component to render for configuring run parameters */
  RunForm?: ComponentType<RunFormProps<RunFormParamTypes>>;
}

// ============================================================================
// Documentation URL Mapping
// ============================================================================

/**
 * Maps run types to their documentation URLs.
 * Returns null for run types without documentation.
 */
const getDocumentationUrl = (type: RunType): string | null => {
  const urlMap: Record<string, string> = {
    value_diff: "https://docs.reccehq.com/features/lineage/#value-diff",
    profile_diff: "https://docs.reccehq.com/features/lineage/#profile-diff",
    histogram_diff: "https://docs.reccehq.com/features/lineage/#histogram-diff",
    top_k_diff: "https://docs.reccehq.com/features/lineage/#top-k-diff",
  };
  return urlMap[type] || null;
};

// ============================================================================
// Component
// ============================================================================

/**
 * OSS RunModal - Wraps @datarecce/ui's RunModal with OSS-specific behavior.
 *
 * This wrapper:
 * - Injects tracking callbacks for form cancellation and execution
 * - Provides documentation URLs based on run type
 * - Uses the OSS IconInfo component for the documentation link
 *
 * @example
 * ```tsx
 * <RunModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   onExecute={handleExecute}
 *   title="Profile Diff"
 *   type="profile_diff"
 *   params={{ model: "my_model" }}
 *   RunForm={ProfileDiffForm}
 * />
 * ```
 */
export function RunModalOss({
  isOpen,
  onClose,
  onExecute,
  type,
  title,
  params,
  initialRun,
  RunForm,
}: RunModalProps) {
  // Track form cancellation for explore actions
  const handleCancel = () => {
    if (isExploreAction(type)) {
      trackExploreActionForm({
        action: type,
        event: EXPLORE_FORM_EVENT.CANCEL,
      });
    }
  };

  // Track form execution for explore actions
  const handleExecuteClick = () => {
    if (isExploreAction(type)) {
      trackExploreActionForm({
        action: type,
        event: EXPLORE_FORM_EVENT.EXECUTE,
      });
    }
  };

  return (
    <UIRunModal<RunFormParamTypes>
      isOpen={isOpen}
      onClose={onClose}
      onExecute={onExecute}
      type={type}
      title={title}
      params={params}
      initialRun={initialRun}
      RunForm={RunForm as UIRunModalProps<RunFormParamTypes>["RunForm"]}
      onCancel={handleCancel}
      onExecuteClick={handleExecuteClick}
      documentationUrl={getDocumentationUrl(type)}
      InfoIcon={PiInfo}
    />
  );
}
