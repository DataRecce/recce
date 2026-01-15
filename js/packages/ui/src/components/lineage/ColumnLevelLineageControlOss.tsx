"use client";

/**
 * @file ColumnLevelLineageControlOss.tsx
 * @description OSS wrapper around @datarecce/ui ColumnLevelLineageControl
 *
 * This wrapper:
 * 1. Connects the @datarecce/ui component to specific contexts
 * 2. Provides LineageViewContext callbacks as props
 * 3. Fetches server flags for single_env_onboarding
 */

import type { UseMutationResult } from "@tanstack/react-query";
import type { CllInput, ColumnLineageData } from "../../api";
import {
  useLineageGraphContext,
  useLineageViewContextSafe,
  useRecceServerFlag,
} from "../../contexts";
import { ColumnLevelLineageControl as BaseColumnLevelLineageControl } from "./controls";

/**
 * OSS wrapper for ColumnLevelLineageControl.
 *
 * Connects the @datarecce/ui component to:
 * - LineageViewContext for CLL operations
 * - LineageGraphContext for graph data
 * - Server flags for environment mode
 */
export const ColumnLevelLineageControlOss = ({
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
