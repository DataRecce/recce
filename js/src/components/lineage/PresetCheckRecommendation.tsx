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

const usePresetCheckRecommendation = () => {
  const queryChecks = useQuery({
    queryKey: cacheKeys.checks(),
    queryFn: listChecks,
  });

  const lastRecommendCheck = useMemo(() => {
    // filter out the preset checks and it's the latest row count diff check
    if (queryChecks.status === "success" && queryChecks.data.length > 0) {
      const check = queryChecks.data
        .filter((check) => check.is_preset)
        .findLast((check) => check.type === "row_count_diff");
      if (check) {
        return check;
      }
    }
  }, [queryChecks]);

  const queryPresetCheck = useQuery({
    queryKey: lastRecommendCheck?.check_id
      ? cacheKeys.check(lastRecommendCheck.check_id)
      : [],
    queryFn: async () => {
      if (lastRecommendCheck?.check_id) {
        return getCheck(lastRecommendCheck.check_id);
      }
    },
    enabled: !!lastRecommendCheck?.check_id,
  });

  const querySelectedModels = useQuery({
    queryKey: lastRecommendCheck?.check_id
      ? [...cacheKeys.check(lastRecommendCheck.check_id), "select"]
      : [],
    queryFn: async () =>
      select({
        select: lastRecommendCheck?.params?.select,
        exclude: lastRecommendCheck?.params?.exclude,
      }),
    enabled: !!lastRecommendCheck?.params?.select,
  });

  const selectedNodes = useMemo(() => {
    if (lastRecommendCheck) {
      if (lastRecommendCheck.params?.node_names) {
        return lastRecommendCheck.params.node_names;
      }

      if (lastRecommendCheck.params?.node_ids) {
        return lastRecommendCheck.params.node_ids;
      }
    }

    if (querySelectedModels.status === "success" && querySelectedModels.data) {
      return querySelectedModels.data.nodes;
    }
  }, [lastRecommendCheck, querySelectedModels]);

  return {
    recommendedCheck: queryPresetCheck.data,
    selectedNodes,
  };
};

export const PresetCheckRecommendation = () => {
  const { lineageGraph } = useLineageGraphContext();
  const { showRunId } = useRecceActionContext();
  const { data: flags } = useRecceServerFlag();
  const queryClient = useQueryClient();
  const { recommendedCheck, selectedNodes } = usePresetCheckRecommendation();
  const [affectedModels, setAffectedModels] = useState<string>();
  const [performedRecommend, setPerformedRecommend] = useState<boolean>(false);
  const [ignoreRecommend, setIgnoreRecommend] = useState<boolean>(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const recommendationKey = sessionStorageKeys.recommendationIgnored;

  useEffect(() => {
    const ignored = sessionStorage.getItem(recommendationKey);
    if (ignored) {
      setIgnoreRecommend(true);
    }
  }, []);

  useEffect(() => {
    if (!recommendedCheck || !selectedNodes) {
      return;
    }

    if (recommendedCheck.last_run?.run_id) {
      setPerformedRecommend(true);
      return;
    }

    const check = recommendedCheck;
    if (selectedNodes.length > 0 && selectedNodes.length <= 3) {
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
      } else if (selectedNodes) {
        const nodes = [];
        for (const nodeId of selectedNodes) {
          const node = lineageGraph?.nodes[nodeId];
          if (node) {
            nodes.push(node.name);
          }
        }
        const nodeNames = nodes.join(", ");
        setAffectedModels(`'${nodeNames}'`);
      }
    } else if (lineageGraph?.modifiedSet?.length === selectedNodes.length) {
      setAffectedModels("modified and potentially impacted models");
    } else if (check.params?.select && !check.params?.exclude) {
      setAffectedModels(`'${check.params?.select}'`);
    } else {
      setAffectedModels(`${selectedNodes.length} models`);
    }
  }, [recommendedCheck, selectedNodes, lineageGraph, recommendationKey, flags]);

  const performPresetCheck = useCallback(async () => {
    const check = recommendedCheck;
    if (!check || check.last_run?.run_id) {
      return;
    }
    const submittedRun = await submitRunFromCheck(check.check_id, {
      nowait: true,
    });
    showRunId(submittedRun.run_id);
    queryClient.invalidateQueries({
      queryKey: cacheKeys.check(check.check_id),
    });
  }, [recommendedCheck, showRunId, queryClient]);

  if (!recommendedCheck || !selectedNodes || flags?.single_env_onboarding) {
    return <></>;
  }
  const numNodes = selectedNodes.length;

  return (
    !ignoreRecommend &&
    !performedRecommend && (
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
                setIgnoreRecommend(true);
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
                  performPresetCheck();
                  setPerformedRecommend(true);
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
