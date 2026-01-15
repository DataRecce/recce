"use client";

import type { LineageGraphNode } from "../..";
import { useRecceServerFlag } from "../../contexts";
import { useIsDark } from "../../hooks";
import { CodeEditor, DiffEditor } from "../../primitives";
import { NodeSqlView as BaseNodeSqlView } from "./NodeSqlView";

interface NodeSqlViewProps {
  node: LineageGraphNode;
}

/**
 * wrapper for NodeSqlView that injects CodeMirror-based editors.
 *
 * This wrapper:
 * 1. Handles loading state from useRecceServerFlag
 * 2. Injects editor components (CodeEditor, DiffEditor)
 * 3. Provides dark mode detection via useIsDark hook
 *
 * The underlying BaseNodeSqlView from @datarecce/ui is framework-agnostic
 * and accepts editor components as props for dependency injection.
 */
export const NodeSqlViewOss = ({ node }: NodeSqlViewProps) => {
  const { data: flags, isLoading } = useRecceServerFlag();
  const isDark = useIsDark();

  if (isLoading) {
    return <></>;
  }

  return (
    <BaseNodeSqlView
      node={node}
      isSingleEnv={flags?.single_env_onboarding ?? false}
      CodeEditor={CodeEditor}
      DiffEditor={DiffEditor}
      isDark={isDark}
    />
  );
};
