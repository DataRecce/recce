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
  Image,
  Heading,
  Badge,
  Icon,
  IconButton,
} from "@chakra-ui/react";
import { SqlPreview } from "../schema/SqlDiffView";
import { NodeData } from "@/lib/api/info";
import { RunResultPane } from "../run/RunResultPane";
import { VSplit } from "../split/Split";
import { QueryParams, submitQueryDiff } from "@/lib/api/adhocQuery";
import { SubmitOptions, waitRun } from "@/lib/api/runs";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { QueryForm } from "../query/QueryForm";
import { AiOutlineExperiment } from "react-icons/ai";
import { useFeedbackCollectionToast } from "@/lib/hooks/useFeedbackCollectionToast";
import { VscFeedback } from "react-icons/vsc";
import { localStorageKeys } from "@/lib/api/localStorageKeys";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import {
  trackPreviewChange,
  trackPreviewChangeFeedback,
} from "@/lib/api/track";
import { useGuideToast } from "@/lib/hooks/useGuideToast";

interface PreviewChangeViewProps {
  isOpen: boolean;
  onClose: () => void;
  current?: NodeData;
  height?: string;
}

function PreviewChangeTopBar({
  current,
  primaryKeys,
  setPrimaryKeys,
  onRunResultOpen,
  runQuery,
  isPending,
}: {
  current?: NodeData;
  primaryKeys: string[];
  setPrimaryKeys: (primaryKeys: string[]) => void;
  onRunResultOpen: () => void;
  runQuery: () => void;
  isPending: boolean;
}) {
  return (
    <Flex
      justifyContent="right"
      alignItems="center"
      padding="4pt 8pt"
      gap="5px"
      height="54px"
      borderBottom="1px solid lightgray"
      flex="0 0 54px"
    >
      <Box>
        <Heading as="h2" size="md" display="flex" alignItems="center" gap="5px">
          <Icon as={AiOutlineExperiment} boxSize="1.2em" />
          Preview Changes
        </Heading>
        <Text fontSize="xs" color="gray.500">
          Compare the run results based on the modified SQL code of model{" "}
          <b>{current?.name}</b>
        </Text>
      </Box>
      <Spacer />
      <QueryForm
        defaultPrimaryKeys={primaryKeys}
        onPrimaryKeysChange={setPrimaryKeys}
      />
      <Tooltip label="Run diff to see the changes">
        <Button
          size="xs"
          marginTop={"16px"}
          fontSize="14px"
          onClick={() => {
            onRunResultOpen();
            runQuery();
          }}
          colorScheme="blue"
          isLoading={isPending}
        >
          Run Diff
        </Button>
      </Tooltip>
    </Flex>
  );
}
function PreviewChangeEditorLabels({ height = "32px", flex = "0 0 auto" }) {
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
  const { primaryKeys, setPrimaryKeys } = useRecceQueryContext();

  const queryFn = async () => {
    const sqlTemplate = modifiedCode;
    const runFn = submitQueryDiff;
    const params: QueryParams = {
      current_model: current?.name || "",
      primary_keys: primaryKeys,
      sql_template: sqlTemplate,
    };
    const options: SubmitOptions = { nowait: true };

    const { run_id } = await runFn(params, options);

    showRunId(run_id);

    return await waitRun(run_id);
  };

  const { mutate: runQuery, isPending } = useMutation({
    mutationFn: queryFn,
    onSuccess(data, variables) {
      if (data.error) {
        trackPreviewChange({
          action: "run",
          node: current?.name,
          status: "failure",
        });
      } else {
        trackPreviewChange({
          action: "run",
          node: current?.name,
          status: "success",
        });
        setTimeout(() => feedbackToast(), 1000);
        setTimeout(() => prepareEnvToast(), 3000);
      }
    },
  });

  const { feedbackToast, closeToast } = useFeedbackCollectionToast({
    feedbackId: localStorageKeys.previewChangeFeedbackID,
    description: "Enjoy preview change?",

    onFeedbackSubmit: (feedback: string) => {
      switch (feedback) {
        case "like":
          trackPreviewChangeFeedback({ feedback: "like", node: current?.name });
          break;
        case "dislike":
          trackPreviewChangeFeedback({
            feedback: "dislike",
            node: current?.name,
          });
          break;
        case "link":
          trackPreviewChangeFeedback({ feedback: "form", node: current?.name });
          break;
        default:
          console.log("Not support feedback type");
      }
    },
    externalLink:
      "https://docs.google.com/forms/d/e/1FAIpQLSd7Lei7Ijwo7MinWaI0K6rzZi_21gV1BKetmiNEX254kDziDA/viewform?usp=header",
    externalLinkText: "Give us feedback",
  });

  const { guideToast: prepareEnvToast, closeGuideToast } = useGuideToast({
    guideId: localStorageKeys.prepareEnvGuideID,
    description: "Want to compare data changes with production data?",
    externalLink: "https://datarecce.io/docs",
    externalLinkText: "Learn how.",
  });

  useEffect(() => {
    if (isOpen) {
      setModifiedCode(current?.raw_code || "");
    }
  }, [isOpen, current]);

  return (
    <Modal
      isOpen={isOpen}
      size="full"
      onClose={() => {
        onClose();
        onRunResultClose();
        clearRunResult();
        closeToast();
        closeGuideToast();
        trackPreviewChange({ action: "close", node: current?.name });
      }}
    >
      {/* <ModalOverlay /> */}
      <ModalContent height={"100%"}>
        <ModalHeader height={"40px"} bg="rgb(77, 209, 176)" px={0} py={4}>
          <Flex alignItems="center" height={"100%"} gap={"10px"}>
            <Image
              boxSize="20px"
              ml="18px"
              src="/logo/recce-logo-white.png"
              alt="recce-logo-white"
            />
            <Heading
              as="h1"
              fontFamily={`"Montserrat", sans-serif`}
              fontSize="lg"
              color="white"
            >
              RECCE
            </Heading>
            <Badge
              fontSize="sm"
              color="white"
              colorScheme="whiteAlpha"
              variant="outline"
            >
              Experiment
            </Badge>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={0}>
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
            <Flex direction="column" height="100%" m={0} p={0}>
              <PreviewChangeTopBar
                current={current}
                primaryKeys={primaryKeys ?? []}
                setPrimaryKeys={setPrimaryKeys}
                onRunResultOpen={onRunResultOpen}
                runQuery={runQuery}
                isPending={isPending}
              />
              <PreviewChangeEditorLabels height="32pxs" flex="0 0 auto" />
              <SqlPreview current={current} onChange={setModifiedCode} />
            </Flex>
            {isRunResultOpen ? (
              <RunResultPane onClose={onRunResultClose} disableAddToChecklist />
            ) : (
              <Box></Box>
            )}
          </VSplit>
        </ModalBody>
        {/* Fixed position button */}
        <Box position="fixed" bottom="4" right="4" opacity={0.5}>
          <Tooltip label="Give us feedback">
            <IconButton
              aria-label="feedback"
              icon={<VscFeedback />}
              variant={"ghost"}
              size={"md"}
              onClick={() => {
                feedbackToast(true);
                prepareEnvToast(true);
              }}
            />
          </Tooltip>
        </Box>
      </ModalContent>
    </Modal>
  );
}
