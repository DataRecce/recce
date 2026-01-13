"use client";

/**
 * @file LineageViewTopBarOss.tsx
 * @description OSS wrapper for the LineageViewTopBar component.
 *
 * This thin wrapper imports the core component from @datarecce/ui and injects
 * OSS-specific implementations including:
 * - Run type icons from the local registry
 * - HistoryToggle component
 * - SetupConnectionPopover component
 * - Context hooks for state management
 */

import type { ReactElement, Ref } from "react";
import {
  useLineageGraphContext,
  useLineageViewContextSafe,
  useRecceInstanceContext,
  useRecceServerFlag,
} from "../../../contexts";
import { SetupConnectionPopover } from "../../app";
import { findByRunType } from "../../run";
import { HistoryToggle } from "../../shared";
import {
  LineageViewTopBar as LineageViewTopBarCore,
  type SetupConnectionPopoverSlotProps,
} from "./LineageViewTopBar";

/**
 * SetupConnectionPopover wrapper to adapt to the slot props interface.
 * We need to cast the children to match SetupConnectionPopover's expected type.
 */
const SetupConnectionPopoverSlot = ({
  display,
  children,
}: SetupConnectionPopoverSlotProps) => {
  return (
    <SetupConnectionPopover display={display}>
      {
        children as ReactElement<{
          ref?: Ref<HTMLElement>;
          [key: string]: unknown;
        }>
      }
    </SetupConnectionPopover>
  );
};

/**
 * LineageViewTopBar component for OSS.
 *
 * Wraps the core @datarecce/ui component with OSS-specific implementations:
 * - Injects run type icons from the local registry
 * - Provides HistoryToggle slot
 * - Provides SetupConnectionPopover slot
 * - Connects to LineageViewContext for state
 */
export const LineageViewTopBarOss = () => {
  const {
    deselect,
    focusedNode,
    selectedNodes,
    viewOptions,
    onViewOptionsChanged,
    runRowCount,
    runRowCountDiff,
    runValueDiff,
    addLineageDiffCheck,
    addSchemaDiffCheck,
  } = useLineageViewContextSafe();

  const { lineageGraph } = useLineageGraphContext();
  const { featureToggles } = useRecceInstanceContext();
  const { data: flags } = useRecceServerFlag();
  const runTypeIcons = {
    rowCountDiff: findByRunType("row_count_diff").icon,
    valueDiff: findByRunType("value_diff").icon,
    lineageDiff: findByRunType("lineage_diff").icon,
    schemaDiff: findByRunType("schema_diff").icon,
  };

  return (
    <LineageViewTopBarCore
      viewOptions={viewOptions}
      onViewOptionsChanged={onViewOptionsChanged}
      lineageGraph={lineageGraph}
      featureToggles={featureToggles}
      serverFlags={flags}
      focusedNode={focusedNode}
      selectedNodes={selectedNodes}
      onDeselect={deselect}
      onRunRowCount={runRowCount}
      onRunRowCountDiff={runRowCountDiff}
      onRunValueDiff={runValueDiff}
      onAddLineageDiffCheck={addLineageDiffCheck}
      onAddSchemaDiffCheck={addSchemaDiffCheck}
      runTypeIcons={runTypeIcons}
      historyToggleSlot={<HistoryToggle />}
      SetupConnectionPopoverSlot={SetupConnectionPopoverSlot}
    />
  );
};
