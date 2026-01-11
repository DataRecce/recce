import { NodeSqlView as BaseNodeSqlView } from "@datarecce/ui/components/lineage";
import { useRecceServerFlag } from "@datarecce/ui/contexts";
import { useIsDark } from "@datarecce/ui/hooks";
import { CodeEditor, DiffEditor } from "@datarecce/ui/primitives";
import type { LineageGraphNode } from "./lineage";

interface NodeSqlViewProps {
  node: LineageGraphNode;
}

/**
 * OSS wrapper for NodeSqlView that injects CodeMirror-based editors.
 *
 * This wrapper:
 * 1. Handles loading state from useRecceServerFlag
 * 2. Injects the OSS editor components (CodeEditor, DiffEditor)
 * 3. Provides dark mode detection via useIsDark hook
 *
 * The underlying BaseNodeSqlView from @datarecce/ui is framework-agnostic
 * and accepts editor components as props for dependency injection.
 */
export const NodeSqlView = ({ node }: NodeSqlViewProps) => {
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
