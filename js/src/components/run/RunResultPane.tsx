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
  Flex,
  Button,
  Spacer,
  CloseButton,
  HStack,
} from "@chakra-ui/react";
import { useCallback, useState } from "react";
import { createCheckByRun } from "@/lib/api/checks";
import { useLocation } from "wouter";
import { Editor } from "@monaco-editor/react";
import YAML from "yaml";

interface RunPageProps {
  onClose?: () => void;
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

export const _LoadableRunView = ({
  runId,
  onClose,
}: {
  runId?: string;
  onClose?: () => void;
}) => {
  const { runAction } = useRecceActionContext();

  const { isPending, error, run, onCancel } = useRun(runId);
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
          onCancel={onCancel}
          viewOptions={viewOptions}
          onViewOptionsChanged={setViewOptions}
          RunResultView={RunResultView}
        />
      )}

      {tabIndex === 1 && run && (
        <_ParamView type={run.type} params={run.params} />
      )}
    </Flex>
  );
};

export const RunResultPane = ({ onClose }: RunPageProps) => {
  const { runId } = useRecceActionContext();

  return <_LoadableRunView runId={runId} onClose={onClose} />;
};
