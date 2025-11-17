import {
  Badge,
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  Heading,
  Icon,
  IconButton,
  Image,
  Portal,
  Spacer,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { DiffEditor } from "@monaco-editor/react";
import { useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { editor } from "monaco-editor";
import React, { useEffect, useRef, useState } from "react";
import { AiOutlineExperiment } from "react-icons/ai";
import { VscFeedback } from "react-icons/vsc";
import { Tooltip } from "@/components/ui/tooltip";
import { QueryParams, submitQueryDiff } from "@/lib/api/adhocQuery";
import { NodeData } from "@/lib/api/info";
import { localStorageKeys } from "@/lib/api/localStorageKeys";
import { SubmitOptions, waitRun } from "@/lib/api/runs";
import {
  trackPreviewChange,
  trackPreviewChangeFeedback,
  trackSingleEnvironment,
} from "@/lib/api/track";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { useFeedbackCollectionToast } from "@/lib/hooks/useFeedbackCollectionToast";
import { useGuideToast } from "@/lib/hooks/useGuideToast";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { formatTimestamp } from "../app/EnvInfo";
import { QueryForm } from "../query/QueryForm";
import { RunResultPane } from "../run/RunResultPane";
import { VSplit } from "../split/Split";

interface SandboxViewProps {
  isOpen: boolean;
  onClose: () => void;
  current?: NodeData;
  height?: string;
}

function SandboxTopBar({
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
          Sandbox
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
      <Tooltip content="Run diff to see the changes">
        <Button
          size="xs"
          marginTop={"16px"}
          fontSize="14px"
          onClick={() => {
            onRunResultOpen();
            runQuery();
          }}
          colorPalette="blue"
          loading={isPending}
        >
          Run Diff
        </Button>
      </Tooltip>
    </Flex>
  );
}
function SandboxEditorLabels({
  currentModelID,
  height = "32px",
  flex = "0 0 auto",
}: {
  currentModelID: string;
  height?: string;
  flex?: string;
}) {
  const { lineageGraph, envInfo } = useLineageGraphContext();
  const widthOfBar = "50%";
  const margin = "0 16px";

  const currentTime = formatTimestamp(
    envInfo?.dbt?.current?.generated_at ?? "",
  );
  const latestUpdateDistanceToNow = formatDistanceToNow(currentTime, {
    addSuffix: true,
  });
  let schema = "N/A";
  if (lineageGraph?.nodes[currentModelID]) {
    const value = lineageGraph.nodes[currentModelID];
    if (value.data.data.current?.schema) {
      schema = value.data.data.current.schema;
    }
  }

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
          ORIGINAL (Schema: {schema}, Last Updated: {latestUpdateDistanceToNow})
        </Text>
      </Stack>
      <Stack width={widthOfBar}>
        <Text as="b" margin={margin}>
          SANDBOX EDITOR
        </Text>
      </Stack>
    </Flex>
  );
}

interface UseDiffEditorSync {
  onMount: (editor: editor.IStandaloneDiffEditor) => void;
}

function useDiffEditorSync(
  value: string,
  onChange: (value: string) => void,
): UseDiffEditorSync {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.getValue()) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  return {
    onMount(editor: editor.IStandaloneDiffEditor) {
      const modified = editor.getModifiedEditor();
      editorRef.current = modified;

      modified.onDidChangeModelContent(() => {
        onChange(modified.getValue());
      });
    },
  };
}

interface SqlPreviewProps {
  current?: NodeData;
  onChange: (value: string) => void;
}

function SqlPreview({ current, onChange }: SqlPreviewProps) {
  const diffEditorSync = useDiffEditorSync(current?.raw_code ?? "", onChange);

  return (
    <Box flex={1} overflowY={"auto"}>
      <DiffEditor
        language="sql"
        theme="vs"
        original={current?.raw_code}
        modified={current?.raw_code}
        options={{
          readOnly: false,
          fontSize: 14,
          lineNumbers: "on",
          automaticLayout: true,
          renderOverviewRuler: false,
          minimap: { enabled: true },
        }}
        onMount={diffEditorSync.onMount}
      />
    </Box>
  );
}

export function SandboxView({ isOpen, onClose, current }: SandboxViewProps) {
  const {
    open: isRunResultOpen,
    onClose: onRunResultClose,
    onOpen: onRunResultOpen,
  } = useDisclosure();
  const [modifiedCode, setModifiedCode] = useState<string>(
    current?.raw_code ?? "",
  );
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const { showRunId, clearRunResult } = useRecceActionContext();
  const { primaryKeys, setPrimaryKeys } = useRecceQueryContext();
  const { data: flags, isLoading } = useRecceServerFlag();

  const queryFn = async () => {
    const sqlTemplate = modifiedCode;
    const runFn = submitQueryDiff;
    const params: QueryParams = {
      current_model: current?.name ?? "",
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
    onSuccess(data) {
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
        setTimeout(() => {
          feedbackToast();
        }, 1000);
        if (!isLoading && flags?.single_env_onboarding) {
          setTimeout(() => {
            prepareEnvToast();
          }, 2000);
        }
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
    externalLink:
      "https://docs.datarecce.io/get-started/#prepare-dbt-artifacts",
    externalLinkText: "Learn how.",
    onExternalLinkClick: () => {
      trackSingleEnvironment({
        action: "external_link",
        from: "preview_changes",
        node: current?.name,
      });
    },
  });

  // Reset modifiedCode when modal opens (during render)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      // Modal just opened, reset to original code
      setModifiedCode(current?.raw_code ?? "");
    }
  }

  return (
    <Dialog.Root
      open={isOpen}
      size="cover"
      onOpenChange={() => {
        onClose();
        onRunResultClose();
        clearRunResult();
        closeToast();
        closeGuideToast();
        trackPreviewChange({ action: "close", node: current?.name });
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content height={"100%"}>
            <Dialog.Header height={"40px"} bg="rgb(77, 209, 176)" px={0} py={4}>
              <Flex alignItems="center" height={"100%"} gap={"10px"}>
                <Image
                  boxSize="20px"
                  ml="18px"
                  src="/logo/recce-logo-white.png"
                  alt="recce-logo-white"
                />
                <Dialog.Title
                  as="h1"
                  fontFamily={`"Montserrat", sans-serif`}
                  fontSize="lg"
                  color="white"
                >
                  RECCE
                </Dialog.Title>
                <Badge fontSize="sm" color="white/80" variant="outline">
                  Experiment
                </Badge>
              </Flex>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body p={0}>
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
                  <SandboxTopBar
                    current={current}
                    primaryKeys={primaryKeys ?? []}
                    setPrimaryKeys={setPrimaryKeys}
                    onRunResultOpen={onRunResultOpen}
                    runQuery={runQuery}
                    isPending={isPending}
                  />
                  <SandboxEditorLabels
                    height="32pxs"
                    flex="0 0 auto"
                    currentModelID={current?.id ?? ""}
                  />
                  <SqlPreview current={current} onChange={setModifiedCode} />
                </Flex>
                {isRunResultOpen ? (
                  <RunResultPane
                    onClose={onRunResultClose}
                    disableAddToChecklist
                  />
                ) : (
                  <Box></Box>
                )}
              </VSplit>
            </Dialog.Body>
            {/* Fixed position button */}
            <Box position="fixed" bottom="4" right="4" opacity={0.5}>
              <Tooltip content="Give us feedback">
                <IconButton
                  aria-label="feedback"
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    feedbackToast(true);
                  }}
                >
                  <VscFeedback />
                </IconButton>
              </Tooltip>
            </Box>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
