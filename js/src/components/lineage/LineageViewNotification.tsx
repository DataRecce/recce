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
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { getCheck, listChecks } from "@/lib/api/checks";
import { InfoOutlineIcon } from "@chakra-ui/icons";

export const LineageViewNotification = () => {
  const [recommendCheckId, setRecommendCheckId] = useState<string>("");
  const [affectedModels, setAffectedModels] = useState<string | undefined>(
    undefined
  );
  const maxNotificationLen = 100;

  const { isOpen, onOpen, onClose } = useDisclosure();

  const { data: checks, status } = useQuery({
    queryKey: cacheKeys.checks(),
    queryFn: listChecks,
    refetchOnMount: true,
  });

  const {
    data: checkDetail,
    isLoading: isLoadingDetail,
    error,
  } = useQuery({
    queryKey: cacheKeys.check(recommendCheckId),
    queryFn: async () => getCheck(recommendCheckId),
    enabled: !!recommendCheckId,
    refetchOnMount: true,
  });

  useEffect(() => {
    // filter out the preset checks and it's the latest row count diff check
    if (status === "success" && checks.length > 0) {
      const check = checks
        .filter((check) => check.is_preset)
        .findLast((check) => check.type === "row_count_diff");
      if (check) {
        setRecommendCheckId(check.check_id);
      }
    }
  }, [status, checks]);

  useEffect(() => {
    if (!isLoadingDetail && !error && checkDetail) {
      if (checkDetail.last_run?.run_id) {
        setAffectedModels(undefined);
        return;
      }
      const check = checkDetail;
      const shortenAffectedModels = "models defined in the recce.yml";

      if (check.params?.select && check.params?.exclude) {
        setAffectedModels(shortenAffectedModels);
      } else if (check.params?.select) {
        setAffectedModels(`'${check.params?.select}'`);
      } else if (check.params?.node_ids) {
        const nodeIds = check.params?.node_ids.join(", ");
        setAffectedModels(`'${nodeIds}'`);
      } else if (check.params?.node_names) {
        const nodeNames = check.params?.node_names.join(", ");
        setAffectedModels(`'${nodeNames}'`);
      }

      if (affectedModels && affectedModels?.length > maxNotificationLen) {
        setAffectedModels(shortenAffectedModels);
      }
    }
  }, [isLoadingDetail, checkDetail]);

  const notificationKey = "notificationClosed";
  if (!sessionStorage.getItem(notificationKey)) {
    // Show the notification
    sessionStorage.setItem(notificationKey, "true");
  }

  return (
    !!affectedModels && (
      <>
        <HStack width="100%" padding="2pt 8pt" backgroundColor={"blue.50"}>
          <HStack flex="1" fontSize={"10pt"} color="blue.600">
            <InfoOutlineIcon />
            <Text>
              Preform the row count of {affectedModels} to get a baseline for
              your further actions.
            </Text>
            <Spacer />
            <Button colorScheme="blue" size="xs" onClick={onOpen}>
              Perform
            </Button>
            <Button size="xs">Ignore</Button>
          </HStack>
        </HStack>
        <Modal isOpen={isOpen} onClose={onClose} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Row Count</ModalHeader>
            <ModalBody>
              <Text>
                Row count will be executed on 3 nodes in the Lineage, which can
                add extra costs to your bill
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button onClick={onClose}>Cancel</Button>
              <Button colorScheme="blue" onClick={() => {}}>
                Execute on N models
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    )
  );
};
