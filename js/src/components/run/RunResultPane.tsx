import { cacheKeys } from "@/lib/api/cacheKeys";
import { useQueryClient } from "@tanstack/react-query";
import { RunView } from "./RunView";
import { findByRunType } from "./registry";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRun } from "@/lib/hooks/useRun";
import {
  Tabs,
  Text,
  Flex,
  Button,
  Spacer,
  CloseButton,
  HStack,
  useDisclosure,
  Menu,
  IconButton,
  Portal,
} from "@chakra-ui/react";
import { useCallback, useState } from "react";
import { createCheckByRun } from "@/lib/api/checks";
import { useLocation } from "wouter";
import { Editor } from "@monaco-editor/react";
import YAML from "yaml";
import SqlEditor, { DualSqlEditor } from "../query/SqlEditor";
import { useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";
import { RunStatusAndDate } from "./RunStatusAndDate";
import { LearnHowLink, RecceNotification } from "../onboarding-guide/Notification";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { TbCloudUpload } from "react-icons/tb";
import { useRecceShareStateContext } from "@/lib/hooks/RecceShareStateContext";
import { trackShareState, trackCopyToClipboard } from "@/lib/api/track";
import AuthModal from "@/components/AuthModal/AuthModal";
import { PiCaretDown, PiCheck, PiCopy, PiRepeat } from "react-icons/pi";

interface RunPageProps {
  onClose?: () => void;
  disableAddToChecklist?: boolean;
  isSingleEnvironment?: boolean;
}

const _ParamView = (data: { type: string; params: any }) => {
  const yaml = YAML.stringify(data, null, 2);

  return (
    <Editor
      className="no-track-pii-safe"
      height="100%"
      language="yaml"
      theme="vs"
      value={yaml}
      options={{
        extraEditorClassName: "no-track-pii-safe",
        readOnly: true,
        fontSize: 14,
        lineNumbers: "off",
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: "on",
        wrappingIndent: "same",
        scrollBeyondLastLine: false,
      }}
    />
  );
};

const SingleEnvironmentSetupNotification = ({ runType }: { runType?: string }) => {
  const { open, onClose } = useDisclosure({ defaultOpen: true });

  if (!open) {
    return <></>;
  }
  switch (runType) {
    case "row_count":
      return (
        <RecceNotification onClose={onClose}>
          <Text>
            Enable row count diffing, and other Recce features, by configuring a base dbt
            environment to compare against. <LearnHowLink />
          </Text>
        </RecceNotification>
      );
    case "profile":
      return (
        <RecceNotification onClose={onClose}>
          <Text>
            Enable data-profile diffing, and other Recce features, by configuring a base dbt
            environment to compare against. <LearnHowLink />
          </Text>
        </RecceNotification>
      );
    default:
      return <></>;
  }
};

const RunResultShareMenu = ({
  disableCopyToClipboard,
  onCopyToClipboard,
  onMouseEnter,
  onMouseLeave,
}: {
  disableCopyToClipboard: boolean;
  onCopyToClipboard: () => Promise<void>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) => {
  const { authed } = useRecceInstanceContext();
  const { handleShareClick } = useRecceShareStateContext();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button size="xs" variant="outline" colorPalette="gray">
            Share <PiCaretDown />
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="0">
              <Menu.Item
                value="copy-to-clipboard"
                onClick={onCopyToClipboard}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                disabled={disableCopyToClipboard}>
                <PiCopy /> Copy to Clipboard
              </Menu.Item>
              <Menu.Separator />
              {authed ? (
                <Menu.Item
                  value="share-to-cloud"
                  onClick={async () => {
                    await handleShareClick();
                    trackShareState({ name: "create" });
                  }}>
                  <TbCloudUpload /> Share to Cloud
                </Menu.Item>
              ) : (
                <>
                  <Menu.Item
                    value="share"
                    onClick={() => {
                      setShowModal(true);
                    }}>
                    <TbCloudUpload /> Share
                  </Menu.Item>
                </>
              )}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
      {showModal && (
        <AuthModal parentOpen={showModal} handleParentClose={setShowModal} ignoreCookie />
      )}
    </>
  );
};

type TabValueItems = "result" | "params" | "query";

export const PrivateLoadableRunView = ({
  runId,
  onClose,
  isSingleEnvironment,
}: {
  runId?: string;
  onClose?: () => void;
  isSingleEnvironment?: boolean;
}) => {
  const { featureToggles } = useRecceInstanceContext();
  const { runAction } = useRecceActionContext();
  const { error, run, onCancel, isRunning } = useRun(runId);
  const [viewOptions, setViewOptions] = useState();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [tabValue, setTabValue] = useState<TabValueItems>("result");
  const disableAddToChecklist = isSingleEnvironment;
  const showSingleEnvironmentSetupNotification = isSingleEnvironment;

  const RunResultView = run?.type ? findByRunType(run.type)?.RunResultView : undefined;

  const handleRerun = useCallback(() => {
    runAction(run?.type ?? "", run?.params);
  }, [run, runAction]);

  const checkId = run?.check_id;

  const handleGoToCheck = useCallback(() => {
    if (!checkId) {
      return;
    }

    setLocation(`/checks/${checkId}`);
  }, [checkId, setLocation]);

  const handleAddToChecklist = useCallback(async () => {
    if (!runId) {
      return;
    }
    const check = await createCheckByRun(runId, viewOptions);

    await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [runId, setLocation, queryClient, viewOptions]);

  const isQuery = run?.type === "query" || run?.type === "query_diff" || run?.type === "query_base";
  const { ref, onCopyToClipboard, onMouseEnter, onMouseLeave } = useCopyToClipboardButton();
  const disableCopyToClipboard = !runId || !run?.result || !!error || tabValue !== "result";

  const AddToCheckButton = function () {
    if (featureToggles.disableUpdateChecklist) {
      return <></>;
    }
    if (run?.check_id) {
      return (
        <Button
          disabled={!runId || !run.result || !!error}
          size="sm"
          colorPalette="cyan"
          onClick={handleGoToCheck}>
          <PiCheck /> Go to Check
        </Button>
      );
    }
    return (
      <Button
        disabled={!runId || !run?.result || !!error}
        size="xs"
        colorPalette="cyan"
        onClick={handleAddToChecklist}>
        <PiCheck /> Add to Checklist
      </Button>
    );
  };

  return (
    <Flex direction="column">
      {showSingleEnvironmentSetupNotification && (
        <SingleEnvironmentSetupNotification runType={run?.type} />
      )}
      <Tabs.Root
        size="lg"
        colorPalette="cyan"
        value={tabValue}
        onValueChange={(e) => {
          setTabValue(e.value as TabValueItems);
        }}
        flexDirection="column"
        mb="1px">
        <Tabs.List>
          <Tabs.Trigger value="result">Result</Tabs.Trigger>
          <Tabs.Trigger value="params">Params</Tabs.Trigger>
          {isQuery && <Tabs.Trigger value="query">Query</Tabs.Trigger>}
          <Spacer />
          <HStack overflow="hidden">
            {run && <RunStatusAndDate run={run} />}
            <Button
              variant="outline"
              colorPalette="gray"
              disabled={!runId || isRunning || featureToggles.disableDatabaseQuery}
              size="xs"
              onClick={handleRerun}>
              <PiRepeat /> Rerun
            </Button>
            {featureToggles.disableShare ? (
              <Button
                variant="outline"
                disabled={!runId || !run?.result || !!error || tabValue !== "result"}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                size="sm"
                onClick={onCopyToClipboard}>
                <PiCopy /> Copy to Clipboard
              </Button>
            ) : (
              <RunResultShareMenu
                disableCopyToClipboard={disableCopyToClipboard}
                onCopyToClipboard={async () => {
                  await onCopyToClipboard();
                  trackCopyToClipboard({ type: run?.type ?? "unknown", from: "run" });
                }}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
              />
            )}

            <AddToCheckButton />

            <CloseButton
              size="sm"
              onClick={() => {
                if (onClose) {
                  onClose();
                }
              }}
            />
          </HStack>
        </Tabs.List>
      </Tabs.Root>
      {tabValue === "result" && (
        <RunView
          ref={ref}
          error={error}
          run={run}
          onCancel={onCancel}
          viewOptions={viewOptions}
          onViewOptionsChanged={setViewOptions}
          RunResultView={RunResultView}
        />
      )}

      {tabValue === "params" && run && <_ParamView type={run.type} params={run.params} />}

      {tabValue === "query" &&
        run &&
        (run.params?.base_sql_template ? (
          <DualSqlEditor
            value={run.params.sql_template}
            baseValue={run.params.base_sql_template}
            options={{ readOnly: true }}
          />
        ) : (
          <SqlEditor value={run.params?.sql_template ?? ""} options={{ readOnly: true }} />
        ))}
    </Flex>
  );
};

export const RunResultPane = ({ onClose, isSingleEnvironment }: RunPageProps) => {
  const { runId } = useRecceActionContext();

  return (
    <PrivateLoadableRunView
      runId={runId}
      onClose={onClose}
      isSingleEnvironment={isSingleEnvironment}
    />
  );
};
