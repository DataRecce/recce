import {
  Button,
  Center,
  Heading,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { TbChecklist, TbPlus } from "react-icons/tb";
import { useLocation } from "wouter";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check } from "@/lib/api/checks";
import { createSchemaDiffCheck } from "@/lib/api/schemacheck";

export const CheckEmptyState = () => {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { mutate: createSchemaCheck, isPending } = useMutation({
    mutationFn: () => createSchemaDiffCheck({ select: "state:modified" }),
    onSuccess: async (check: Check) => {
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      setLocation(`/checks/${check.check_id}`);
    },
  });

  const handleCreateSchemaCheck = () => {
    createSchemaCheck();
  };

  return (
    <Center h="100%" w="100%">
      <VStack gap={6} textAlign="center" maxW="400px">
        <Icon as={TbChecklist} boxSize={16} color="gray.400" />

        <VStack gap={2}>
          <Heading size="lg" color="gray.600">
            No checks yet
          </Heading>
          <Text color="gray.500" fontSize="md">
            Checks help you validate data quality and catch issues.
          </Text>
        </VStack>

        <VStack gap={3} w="100%">
          <Text fontSize="sm" color="gray.600" fontWeight="medium">
            Get started with your first check:
          </Text>

          <Button
            colorPalette="blue"
            onClick={handleCreateSchemaCheck}
            loading={isPending}
            size="lg"
            w="100%"
          >
            <HStack>
              <Icon as={TbPlus} />
              <Text>Create Schema Diff Check</Text>
            </HStack>
          </Button>

          <Text fontSize="xs" color="gray.400" mt={2}>
            The schema checks compare modified models between environments to
            detect changes, additions, or removals.
          </Text>
        </VStack>
      </VStack>
    </Center>
  );
};
