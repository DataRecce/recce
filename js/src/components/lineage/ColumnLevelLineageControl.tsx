/**
 * @file ColumnLevelLineageControl.tsx (OSS Wrapper)
 * @description Thin wrapper around @datarecce/ui ColumnLevelLineageControl
 *
 * This wrapper:
 * 1. Connects the @datarecce/ui component to OSS-specific contexts
 * 2. Provides LineageViewContext callbacks as props
 * 3. Fetches server flags for single_env_onboarding
 */

import type { CllInput, ColumnLineageData } from "@datarecce/ui/api";
import { ColumnLevelLineageControl as BaseColumnLevelLineageControl } from "@datarecce/ui/components/lineage/controls";
import {
  useLineageGraphContext,
  useLineageViewContextSafe,
  useRecceServerFlag,
} from "@datarecce/ui/contexts";
import type { UseMutationResult } from "@tanstack/react-query";

/**
 * OSS wrapper for ColumnLevelLineageControl.
 *
 * Connects the @datarecce/ui component to:
 * - LineageViewContext for CLL operations
 * - LineageGraphContext for graph data
 * - Server flags for environment mode
 */
export const ColumnLevelLineageControl = ({
  action,
}: {
  action: UseMutationResult<ColumnLineageData, Error, CllInput>;
}) => {
  const {
    showColumnLevelLineage,
    resetColumnLevelLineage,
    interactive,
    viewOptions,
    centerNode,
  } = useLineageViewContextSafe();
  const { data: flagData } = useRecceServerFlag();
  const singleEnv = flagData?.single_env_onboarding ?? false;
  const { lineageGraph } = useLineageGraphContext();

  return (
    <BaseColumnLevelLineageControl
      action={action}
      interactive={interactive}
      viewOptions={viewOptions}
      lineageGraph={lineageGraph}
      singleEnvMode={singleEnv}
      onShowCll={showColumnLevelLineage}
      onResetCll={() => resetColumnLevelLineage()}
      onCenterNode={centerNode}
    />
  );
};
