import {
  HStack,
  Button,
  Spacer,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Stack,
  Flex,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { getCheck, listChecks } from "@/lib/api/checks";
import { InfoOutlineIcon } from "@chakra-ui/icons";
import { select, SelectInput } from "@/lib/api/select";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { submitRunFromCheck } from "@/lib/api/runs";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { sessionStorageKeys } from "@/lib/api/sessionStorageKeys";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";

export const PresetCheckRecommendation = () => {
  const { lineageGraph } = useLineageGraphContext();
  const { showRunId } = useRecceActionContext();
  const { data: flags } = useRecceServerFlag();
  const queryClient = useQueryClient();
  const [recommendCheckId, setRecommendCheckId] = useState<string>("");
  const [recommendCheckParam, setRecommendCheckParam] = useState<SelectInput>();
  const [showRecommendation, setShowRecommendation] = useState<boolean>(false);
  const [affectedModels, setAffectedModels] = useState<string>();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const recommendationKey = sessionStorageKeys.recommendationIgnored;

  const { data: checks, status } = useQuery({
    queryKey: cacheKeys.checks(),
    queryFn: listChecks,
  });

  const { data: presetCheck, status: presetCheckStatus } = useQuery({
    queryKey: cacheKeys.check(recommendCheckId),
    queryFn: async () => getCheck(recommendCheckId),
    enabled: !!recommendCheckId,
  });

  const queryKey = [...cacheKeys.check(recommendCheckId), "select"];
  const { data: selectedModels, status: selectedModelsStatus } = useQuery({
    queryKey,
    queryFn: async () =>
      select({
        select: recommendCheckParam?.select,
        exclude: recommendCheckParam?.exclude,
      }),
    enabled: !!recommendCheckParam?.select,
  });

  useEffect(() => {
    // filter out the preset checks and it's the latest row count diff check
    if (status === "success" && checks.length > 0) {
      const check = checks
        .filter((check) => check.is_preset)
        .findLast((check) => check.type === "row_count_diff");
      if (check) {
        setRecommendCheckId(check.check_id);
        setRecommendCheckParam(check.params);
      }
    }
  }, [status, checks]);

  const numNodes = useMemo(() => {
    if (presetCheckStatus === "success" && presetCheck) {
      if (presetCheck.params?.node_names) {
        return presetCheck.params.node_names.length;
      }

      if (presetCheck.params?.node_ids) {
        return presetCheck.params.node_ids.length;
      }
    }

    if (selectedModelsStatus === "success" && selectedModels) {
      return selectedModels.nodes.length;
    }
  }, [presetCheckStatus, presetCheck, selectedModelsStatus, selectedModels]);

  useEffect(() => {
    if (presetCheckStatus !== "success" || !presetCheck) {
      setShowRecommendation(false);
      return;
    }

    if (presetCheck.last_run?.run_id) {
      setShowRecommendation(false);
      return;
    }

    const check = presetCheck;
    if (numNodes > 0 && numNodes <= 3) {
      if (check.params?.node_names) {
        const nodeNames = check.params?.node_names.join(", ");
        setAffectedModels(`'${nodeNames}'`);
      } else if (check.params?.node_ids) {
        const nodes = [];
        for (const nodeId of check.params?.node_ids) {
          const node = lineageGraph?.nodes[nodeId];
          if (node) {
            nodes.push(node.name);
          }
        }
        const nodeNames = nodes.join(", ");
        setAffectedModels(`'${nodeNames}'`);
      } else if (selectedModelsStatus === "success" && selectedModels) {
        const nodes = [];
        for (const nodeId of selectedModels.nodes) {
          const node = lineageGraph?.nodes[nodeId];
          if (node) {
            nodes.push(node.name);
          }
        }
        const nodeNames = nodes.join(", ");
        setAffectedModels(`'${nodeNames}'`);
      }
    } else if (lineageGraph?.modifiedSet?.length === numNodes) {
      setAffectedModels("modified and potentially impacted models");
    } else if (check.params?.select && !check.params?.exclude) {
      setAffectedModels(`'${check.params?.select}'`);
    } else {
      setAffectedModels(`${numNodes} models`);
    }

    const ignored = sessionStorage.getItem(recommendationKey);
    if (!ignored && !flags?.single_env_onboarding) {
      setShowRecommendation(true);
    }
  }, [
    presetCheckStatus,
    presetCheck,
    selectedModelsStatus,
    selectedModels,
    numNodes,
    lineageGraph,
    recommendationKey,
    flags,
  ]);

  const performPresetCheck = useCallback(async () => {
    const check = presetCheck;
    if (presetCheckStatus !== "success" || !check || check.last_run?.run_id) {
      return;
    }
    const submittedRun = await submitRunFromCheck(check.check_id, {
      nowait: true,
    });
    showRunId(submittedRun.run_id);
    queryClient.invalidateQueries({
      queryKey: cacheKeys.check(check.check_id),
    });
  }, [presetCheckStatus, presetCheck, showRunId, queryClient]);

  return (
    showRecommendation && (
      <>
        <HStack width="100%" padding="2pt 8pt" backgroundColor={"blue.50"}>
          <HStack flex="1" fontSize={"10pt"} color="blue.600">
            <InfoOutlineIcon />
            <Text>
              First Check: Perform a row count diff of {affectedModels} for
              basic impact assessment
            </Text>
            <Spacer />
            <Button
              size="xs"
              onClick={() => {
                setShowRecommendation(false);
                sessionStorage.setItem(recommendationKey, "true");
              }}
            >
              Ignore
            </Button>
            <Button colorScheme="blue" size="xs" onClick={onOpen}>
              Perform
            </Button>
          </HStack>
        </HStack>
        <Modal isOpen={isOpen} onClose={onClose} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Row Count Check</ModalHeader>
            <ModalBody>
              <Stack spacing="4">
                <Text>
                  Perform a row count check of the {numNodes} node(s) displayed
                  in the lineage diff DAG.
                </Text>
                <Flex bg="blue.100" color="blue.700">
                  <InfoOutlineIcon mt="10px" ml="5px" />
                  <Text margin="5px" paddingX="3px">
                    This is a recommended first check based on the preset checks
                    defined in your recce.yml file.
                  </Text>
                </Flex>
              </Stack>
            </ModalBody>
            <ModalFooter gap="5px">
              <Button onClick={onClose}>Cancel</Button>
              <Button
                colorScheme="blue"
                onClick={() => {
                  onClose();
                  setShowRecommendation(false);
                  performPresetCheck();
                }}
              >
                Execute on {numNodes} models
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    )
  );
};
