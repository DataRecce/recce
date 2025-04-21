import { cacheKeys } from "@/lib/api/cacheKeys";
import { useQueryClient } from "@tanstack/react-query";
import { RunView } from "./RunView";
import { findByRunType } from "./registry";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRun } from "@/lib/hooks/useRun";
import {
  Tabs,
  TabList,
  Tab,
  Text,
  Flex,
  Button,
  Spacer,
  CloseButton,
  HStack,
  useDisclosure,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  PopoverBody,
  PopoverTrigger,
  PopoverContent,
  Popover,
  Link,
  Portal,
} from "@chakra-ui/react";
import { useCallback, useState } from "react";
import { createCheckByRun } from "@/lib/api/checks";
import { useLocation } from "wouter";
import { Editor } from "@monaco-editor/react";
import YAML from "yaml";
import SqlEditor, { DualSqlEditor } from "../query/SqlEditor";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  RepeatIcon,
} from "@chakra-ui/icons";
import { useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";
import { RunStatusAndDate } from "./RunStatusAndDate";
import { LearnHowLink, RecceNotification } from "../onboarding-guide/Notification";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { TbCloudUpload } from "react-icons/tb";
import { useRecceShareStateContext } from "@/lib/hooks/RecceShareStateContext";
import { PUBLIC_CLOUD_WEB_URL } from "@/lib/const";

interface RunPageProps {
  onClose?: () => void;
  disableAddToChecklist?: boolean;
  isSingleEnvironment?: boolean;
}

const _ParamView = (data: { type: string; params: any }) => {
  const yaml = YAML.stringify(data, null, 2);

  return (
    <Editor
      height="100%"
      language="yaml"
      theme="vs"
      value={yaml}
      options={{
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
  const { isOpen, onClose } = useDisclosure({ defaultIsOpen: true });

  if (!isOpen) {
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

  return (
    <Menu>
      <MenuButton as={Button} size="sm" rightIcon={<ChevronDownIcon />} variant="outline">
        Share
      </MenuButton>
      <MenuList minW="0">
        <MenuItem
          fontSize="14px"
          icon={<CopyIcon />}
          onClick={onCopyToClipboard}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          isDisabled={disableCopyToClipboard}>
          Copy to Clipboard
        </MenuItem>
        <MenuDivider />
        {authed ? (
          <MenuItem fontSize="14px" icon={<TbCloudUpload />} onClick={handleShareClick}>
            Share to Cloud
          </MenuItem>
        ) : (
          <Popover trigger="hover" placement="bottom-start" closeOnBlur={false}>
            <PopoverTrigger>
              <MenuItem
                fontSize="14px"
                icon={<ExternalLinkIcon />}
                onClick={() => {
                  window.open(`${PUBLIC_CLOUD_WEB_URL}/settings#tokens`, "_blank");
                }}>
                Enable sharing
              </MenuItem>
            </PopoverTrigger>
            <Portal>
              <PopoverContent bg="black" color="white" sx={{ width: "max-content" }}>
                <PopoverBody fontSize="sm">
                  API token required.{" "}
                  <Link
                    href="https://docs.datarecce.io/recce-cloud/share-recce-session-securely"
                    target="_blank"
                    textDecoration="underline">
                    Learn more
                  </Link>
                  .
                </PopoverBody>
              </PopoverContent>
            </Portal>
          </Popover>
        )}
      </MenuList>
    </Menu>
  );
};

export const PrivateLoadableRunView = ({
  runId,
  onClose,
  isSingleEnvironment,
}: {
  runId?: string;
  onClose?: () => void;
  isSingleEnvironment?: boolean;
}) => {
  const { readOnly } = useRecceInstanceContext();
  const { runAction } = useRecceActionContext();
  const { error, run, onCancel, isRunning } = useRun(runId);
  const [viewOptions, setViewOptions] = useState();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [tabIndex, setTabIndex] = useState(0);
  const disableAddToChecklist = !!isSingleEnvironment;
  const showSingleEnvironmentSetupNotification = !!isSingleEnvironment;

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
  const disableCopyToClipboard = !runId || !run?.result || !!error || tabIndex !== 0;

  const AddToCheckButton = function () {
    if (disableAddToChecklist) {
      return <></>;
    }
    if (run?.check_id) {
      return (
        <Button
          leftIcon={<CheckIcon />}
          isDisabled={!runId || !run.result || !!error}
          size="sm"
          colorScheme="blue"
          onClick={handleGoToCheck}>
          Go to Check
        </Button>
      );
    }
    return (
      <Button
        leftIcon={<CheckIcon />}
        isDisabled={!runId || !run?.result || !!error}
        size="sm"
        colorScheme="blue"
        onClick={handleAddToChecklist}>
        Add to Checklist
      </Button>
    );
  };

  return (
    <Flex direction="column">
      {showSingleEnvironmentSetupNotification && (
        <SingleEnvironmentSetupNotification runType={run?.type} />
      )}
      <Tabs tabIndex={tabIndex} onChange={setTabIndex} flexDirection="column" mb="1px">
        <TabList height="50px">
          <Tab>Result</Tab>
          <Tab>Params</Tab>
          {isQuery && <Tab>Query</Tab>}
          <Spacer />
          <HStack overflow="hidden">
            {run && <RunStatusAndDate run={run} />}
            <Button
              leftIcon={<RepeatIcon />}
              variant="outline"
              isDisabled={!runId || isRunning || readOnly}
              size="sm"
              onClick={handleRerun}>
              Rerun
            </Button>
            {isSingleEnvironment || readOnly ? (
              <Button
                leftIcon={<CopyIcon />}
                variant="outline"
                isDisabled={!runId || !run?.result || !!error || tabIndex !== 0}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                size="sm"
                onClick={onCopyToClipboard}>
                Copy to Clipboard
              </Button>
            ) : (
              <RunResultShareMenu
                disableCopyToClipboard={disableCopyToClipboard}
                onCopyToClipboard={onCopyToClipboard}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
              />
            )}

            <AddToCheckButton />

            <CloseButton
              onClick={() => {
                if (onClose) {
                  onClose();
                }
              }}
            />
          </HStack>
        </TabList>
      </Tabs>
      {tabIndex === 0 && (
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

      {tabIndex === 1 && run && <_ParamView type={run.type} params={run.params} />}

      {tabIndex === 2 &&
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
