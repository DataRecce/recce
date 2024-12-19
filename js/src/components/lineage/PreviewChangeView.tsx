import {
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  Box,
  Text,
  Stack,
  Button,
  Spacer,
  Tooltip,
  useDisclosure,
} from "@chakra-ui/react";
import { SqlPreview } from "../schema/SqlDiffView";
import { NodeData } from "@/lib/api/info";
import { RunResultPane } from "../run/RunResultPane";
import { VSplit } from "../split/Split";
import { QueryParams, submitQuery } from "@/lib/api/adhocQuery";
import { SubmitOptions, waitRun } from "@/lib/api/runs";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

interface PreviewChangeViewProps {
  isOpen: boolean;
  onClose: () => void;
  current?: NodeData;
  height?: string;
}

function PreviewChangeBar({ height = "32px", flex = "0 0 auto" }) {
  const widthOfBar = "50%";
  const margin = "0 16px";

  return (
    <Flex
      gap={0}
      height={height}
      flex={flex}
      fontSize={"14px"}
      align="center"
      margin={"0"}
      backgroundColor="#EDF2F880"
    >
      <Stack width={widthOfBar}>
        <Text as="b" margin={margin}>
          CURRENT
        </Text>
      </Stack>
      <Stack width={widthOfBar}>
        <Text as="b" margin={margin}>
          PREVIEW EDITOR
        </Text>
      </Stack>
    </Flex>
  );
}
export function PreviewChangeView({
  isOpen,
  onClose,
  current,
}: PreviewChangeViewProps) {
  const {
    isOpen: isRunResultOpen,
    onClose: onRunResultClose,
    onOpen: onRunResultOpen,
  } = useDisclosure();
  const [modifiedCode, setModifiedCode] = useState<string>(
    current?.raw_code || ""
  );
  const { showRunId, clearRunResult } = useRecceActionContext();
  const queryFn = async () => {
    const sqlTemplate = modifiedCode;
    const runFn = submitQuery;
    const params: QueryParams = {
      current_model: current?.name || "",
      sql_template: sqlTemplate,
    };
    const options: SubmitOptions = { nowait: true };

    const { run_id } = await runFn(params, options);

    showRunId(run_id);

    return await waitRun(run_id);
  };
  const { mutate: runQuery, isPending } = useMutation({
    mutationFn: queryFn,
  });

  return (
    <Modal
      isOpen={isOpen}
      size="full"
      onClose={() => {
        onClose();
        onRunResultClose();
        clearRunResult();
      }}
    >
      {/* <ModalOverlay /> */}
      <ModalContent height={"100%"}>
        <ModalHeader height={"40px"} bg="rgb(255, 110, 66)" p={4}>
          <Flex align="center" height={"100%"}>
            <Text as={"b"} color="white">
              Preview Changes
            </Text>
            <Spacer />
            <Tooltip label="Run diff to see the changes">
              <Button
                size="xs"
                mr={10}
                fontSize="14px"
                onClick={() => {
                  onRunResultOpen();
                  runQuery();
                }}
              >
                Run Diff
              </Button>
            </Tooltip>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VSplit
            sizes={isRunResultOpen ? [50, 50] : [100, 0]}
            minSize={isRunResultOpen ? 100 : 0}
            gutterSize={isRunResultOpen ? 5 : 0}
            style={{
              flex: "1",
              contain: "size",
              height: "100%",
            }}
          >
            <Flex direction="column" height="100%">
              <PreviewChangeBar height="32pxs" flex="0 0 auto" />
              <SqlPreview current={current} onChange={setModifiedCode} />
            </Flex>
            {isRunResultOpen ? (
              <RunResultPane onClose={onRunResultClose} />
            ) : (
              <Box></Box>
            )}
          </VSplit>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
