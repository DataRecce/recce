import { cacheKeys } from "@/lib/api/cacheKeys";
import { waitRun } from "@/lib/api/runs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RunView } from "./RunView";
import { findByRunType } from "./registry";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRun } from "@/lib/hooks/useRun";
import {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Flex,
  Button,
  Spacer,
  CloseButton,
  HStack,
  Box,
} from "@chakra-ui/react";
import { use, useCallback, useState } from "react";
import { createCheckByRun } from "@/lib/api/checks";
import { useLocation } from "wouter";
import { Editor } from "@monaco-editor/react";

interface RunPageProps {
  onClose?: () => void;
}

const _ParamView = ({ params }: { params: any }) => {
  const json = JSON.stringify(params, null, 2);

  return (
    <Editor
      height="100%"
      language="json"
      theme="vs"
      value={json}
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

export const _LoadableRunView = ({
  runId,
  onClose,
}: {
  runId?: string;
  onClose?: () => void;
}) => {
  const { runAction } = useRecceActionContext();

  const { isPending, error, run } = useRun(runId);
  const [viewOptions, setViewOptions] = useState();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [tabIndex, setTabIndex] = useState(0);

  const RunResultView = run?.type
    ? findByRunType(run.type)?.RunResultView
    : undefined;

  const handleRerun = useCallback(() => {
    runAction(run?.type || "", run?.params);
  }, [run, runAction]);

  const handleAddToChecklist = useCallback(async () => {
    if (!runId) {
      return;
    }
    const check = await createCheckByRun(runId, viewOptions);

    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [runId, setLocation, queryClient, viewOptions]);

  return (
    <Flex direction="column">
      <Tabs
        tabIndex={tabIndex}
        onChange={setTabIndex}
        flexDirection="column"
        mb="1px"
      >
        <TabList height="50px">
          <Tab>Result</Tab>
          <Tab>Params</Tab>
          <Spacer />
          <HStack>
            <Button
              isDisabled={!runId || isPending}
              size="sm"
              colorScheme="blue"
              onClick={handleRerun}
            >
              Rerun
            </Button>
            <Button
              isDisabled={!runId || !run?.result}
              size="sm"
              colorScheme="blue"
              onClick={handleAddToChecklist}
            >
              Add to Checklist
            </Button>

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
          isPending={isPending}
          error={error}
          run={run}
          RunResultView={RunResultView}
        />
      )}

      {tabIndex === 1 && <_ParamView params={run?.params} />}
    </Flex>
  );
};

export const LatestRunPage = ({ onClose }: RunPageProps) => {
  const { runId } = useRecceActionContext();

  return <_LoadableRunView runId={runId} onClose={onClose} />;
};