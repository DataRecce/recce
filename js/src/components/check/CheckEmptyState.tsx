import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { TbChecklist, TbPlus } from "react-icons/tb";
import {
  Button,
  Center,
  Heading,
  HStack,
  Icon,
  Text,
  VStack,
} from "@/components/ui/mui";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check } from "@/lib/api/checks";
import { createSchemaDiffCheck } from "@/lib/api/schemacheck";
import { useAppLocation } from "@/lib/hooks/useAppRouter";

export const CheckEmptyState = () => {
  const queryClient = useQueryClient();
  const [, setLocation] = useAppLocation();

  const { mutate: createSchemaCheck, isPending } = useMutation({
    mutationFn: () => createSchemaDiffCheck({ select: "state:modified" }),
    onSuccess: async (check: Check) => {
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      setLocation(`/checks/?id=${check.check_id}`);
    },
  });

  const handleCreateSchemaCheck = () => {
    createSchemaCheck();
  };

  return (
    <Center sx={{ height: "100%", width: "100%" }}>
      <VStack sx={{ textAlign: "center", maxWidth: "400px" }} spacing={6}>
        <Icon as={TbChecklist} boxSize="64px" color="grey.400" />

        <VStack spacing={2}>
          <Heading size="lg" sx={{ color: "grey.600" }}>
            No checks yet
          </Heading>
          <Text sx={{ color: "grey.500", fontSize: "md" }}>
            Checks help you validate data quality and catch issues.
          </Text>
        </VStack>

        <VStack sx={{ width: "100%" }} spacing={3}>
          <Text
            sx={{ fontSize: "sm", color: "grey.600", fontWeight: "medium" }}
          >
            Get started with your first check:
          </Text>

          <Button
            colorPalette="iochmara"
            onClick={handleCreateSchemaCheck}
            loading={isPending}
            size="lg"
            sx={{ width: "100%" }}
          >
            <HStack>
              <Icon as={TbPlus} />
              <Text>Create Schema Diff Check</Text>
            </HStack>
          </Button>

          <Text sx={{ fontSize: "xs", color: "grey.400", mt: 1 }}>
            The schema checks compare modified models between environments to
            detect changes, additions, or removals.
          </Text>
        </VStack>
      </VStack>
    </Center>
  );
};
