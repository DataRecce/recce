import { Run, RunType } from "@/lib/api/types";

import {
  Box,
  Button,
  Flex,
  Icon,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { IconInfo } from "../icons";
import { RunFormProps } from "./types";
import { useState } from "react";

interface RunModalProps<PT> {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (type: string, params: PT) => void;
  title: string;
  type: RunType;
  params: PT;
  initialRun?: Run;
  RunForm?: React.ComponentType<RunFormProps<PT>>;
}

const getDocumentationUrl = (type: RunType): string | null => {
  const urlMap: Record<string, string> = {
    value_diff: "https://docs.datarecce.io/features/lineage/#value-diff",
    profile_diff: "https://docs.datarecce.io/features/lineage/#profile-diff",
    histogram_diff: "https://docs.datarecce.io/features/lineage/#histogram-diff",
    top_k_diff: "https://docs.datarecce.io/features/lineage/#top-k-diff",
  };
  return urlMap[type] || null;
};

export const RunModal = <PT,>({
  isOpen,
  onClose,
  onExecute,
  type,
  title,
  params: defaultParams,
  RunForm,
}: RunModalProps<PT>) => {
  const [params, setParams] = useState<Partial<PT>>(defaultParams);
  const [isReadyToExecute, setIsReadyToExecute] = useState(false);
  const documentationUrl = getDocumentationUrl(type);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent overflowY="auto" height="75%" minHeight={"400px"}>
        <ModalHeader>
          <Flex alignItems="center" gap={2}>
            {title}
            {documentationUrl && (
              <Link href={documentationUrl} isExternal>
                <Icon
                  as={IconInfo}
                  color="gray.500"
                  _hover={{ color: "blue.500" }}
                  w={4}
                  h={4}
                />
              </Link>
            )}
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p="0px" h="100%" overflow="auto" borderY="1px solid lightgray">
          <Box style={{ contain: "layout" }}>
            {RunForm && (
              <RunForm
                params={params}
                onParamsChanged={setParams}
                setIsReadyToExecute={setIsReadyToExecute}
              />
            )}
          </Box>
        </ModalBody>
        <ModalFooter>
          <Flex gap="10px">
            <Button
              isDisabled={!isReadyToExecute}
              colorScheme="blue"
              onClick={() => {
                onExecute(type, params as PT);
              }}>
              Execute
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
