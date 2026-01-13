/**
 * CheckEmptyState - OSS wrapper around @datarecce/ui primitive
 *
 * Adds OSS-specific business logic:
 * - API calls to create schema diff check
 * - Navigation after check creation
 * - Query cache invalidation
 */

import {
  type Check,
  cacheKeys,
  createSchemaDiffCheck,
} from "@datarecce/ui/api";
import { useApiConfig } from "@datarecce/ui/hooks";
import { CheckEmptyState as CheckEmptyStateUI } from "@datarecce/ui/primitives";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TbChecklist } from "react-icons/tb";

export const CheckEmptyState = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { apiClient } = useApiConfig();

  const { mutate: createSchemaCheck, isPending } = useMutation({
    mutationFn: () =>
      createSchemaDiffCheck({ select: "state:modified" }, apiClient),
    onSuccess: async (check: Check) => {
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      router.push(`/checks/?id=${check.check_id}`);
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
