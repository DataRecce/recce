"use client";

import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getModelInfo, type LineageGraphNode } from "../..";
import { useRecceServerFlag } from "../../contexts";
import { useApiConfig, useIsDark } from "../../hooks";
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
 * 2. Fetches raw_code on demand via /api/model/{model_id} when the inline
 *    raw_code is absent from the /info lineage payload (DRC-3263). Uses
 *    React Query with a 5-minute cache.
 * 3. Injects editor components (CodeEditor, DiffEditor)
 * 4. Provides dark mode detection via useIsDark hook
 *
 * The underlying BaseNodeSqlView from @datarecce/ui is framework-agnostic
 * and accepts editor components as props for dependency injection.
 */
export const NodeSqlViewOss = ({ node }: NodeSqlViewProps) => {
  const { data: flags, isLoading } = useRecceServerFlag();
  const isDark = useIsDark();
  const { apiClient } = useApiConfig();

  const resourceType = node.data.resourceType;
  const isCodeResource =
    resourceType === "model" || resourceType === "snapshot";

  const inlineBase = node.data.data.base?.raw_code;
  const inlineCurrent = node.data.data.current?.raw_code;

  // Use loose equality (== null) so both undefined (field absent) and null
  // (JSON null from backend / Pydantic serialization) trigger the fetch.
  const needsFetch =
    isCodeResource && inlineBase == null && inlineCurrent == null;

  const { data: modelDetail, isLoading: isModelDetailLoading } = useQuery({
    queryKey: ["modelDetail", node.id],
    queryFn: () => getModelInfo(node.id, apiClient),
    enabled: needsFetch && !!apiClient,
    staleTime: 5 * 60 * 1000, // 5 minutes — raw_code rarely changes in-session
    retry: 1,
  });

  // Merge fetched raw_code into the node so the base view renders without
  // knowing about the on-demand fetch. Inline raw_code wins when present.
  const nodeWithRawCode = useMemo(() => {
    if (!needsFetch || !modelDetail) {
      return node;
    }
    const fetchedBase = modelDetail.model.base?.raw_code;
    const fetchedCurrent = modelDetail.model.current?.raw_code;
    return {
      ...node,
      data: {
        ...node.data,
        data: {
          base: node.data.data.base
            ? { ...node.data.data.base, raw_code: inlineBase ?? fetchedBase }
            : fetchedBase
              ? { raw_code: fetchedBase }
              : undefined,
          current: node.data.data.current
            ? {
                ...node.data.data.current,
                raw_code: inlineCurrent ?? fetchedCurrent,
              }
            : fetchedCurrent
              ? { raw_code: fetchedCurrent }
              : undefined,
        },
      },
    } as LineageGraphNode;
  }, [node, needsFetch, modelDetail, inlineBase, inlineCurrent]);

  if (isLoading) {
    return <></>;
  }

  // Show a loading skeleton while fetching raw_code on demand.
  if (needsFetch && isModelDetailLoading) {
    return (
      <Box
        aria-label="Loading model code"
        sx={{ p: 2, height: "100%" }}
        data-testid="node-sql-view-loading"
      >
        <Skeleton variant="rectangular" height="100%" animation="wave" />
      </Box>
    );
  }

  return (
    <BaseNodeSqlView
      node={nodeWithRawCode}
      isSingleEnv={flags?.single_env_onboarding ?? false}
      CodeEditor={CodeEditor}
      DiffEditor={DiffEditor}
      isDark={isDark}
    />
  );
};
