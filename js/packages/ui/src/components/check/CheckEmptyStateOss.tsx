"use client";

/**
 * CheckEmptyStateOss - wrapper around CheckEmptyState primitive
 *
 * Adds business logic:
 * - API calls to create schema diff check
 * - Navigation after check creation
 * - Query cache invalidation
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TbChecklist } from "react-icons/tb";
import { type Check, cacheKeys, createSchemaDiffCheck } from "../../api";
import { useRouteConfig } from "../../contexts";
import { useApiConfig } from "../../hooks";
import { CheckEmptyState as CheckEmptyStateUI } from "../../primitives";

export const CheckEmptyStateOss = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { apiClient } = useApiConfig();
  const { basePath } = useRouteConfig();

  const { mutate: createSchemaCheck, isPending } = useMutation({
    mutationFn: () =>
      createSchemaDiffCheck({ select: "state:modified" }, apiClient),
    onSuccess: async (check: Check) => {
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      router.push(`${basePath}/checks/?id=${check.check_id}`);
    },
  });

  const handleCreateSchemaCheck = () => {
    createSchemaCheck();
  };

  return (
    <CheckEmptyStateUI
      title="No checks yet"
      description="Checks help you validate data quality and catch issues."
      icon={<TbChecklist size={48} />}
      actionText="Create Schema Diff Check"
      onAction={handleCreateSchemaCheck}
      isLoading={isPending}
      helperText="The schema checks compare modified models between environments to detect changes, additions, or removals."
    />
  );
};
