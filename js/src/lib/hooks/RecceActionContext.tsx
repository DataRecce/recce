import { useDisclosure } from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import React, {
  ComponentType,
  createContext,
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLocation } from "wouter";
import { RunModal } from "@/components/run/RunModal";
import {
  findByRunType,
  RegistryEntry,
  RunFormParamTypes,
  RunType,
} from "@/components/run/registry";
import { RunFormProps } from "@/components/run/types";
import { toaster } from "@/components/ui/toaster";
import { cacheKeys } from "../api/cacheKeys";
import { SubmitRunTrackProps, searchRuns, submitRun } from "../api/runs";
import { AxiosQueryParams, Run, RunParamTypes } from "../api/types";

export interface RecceActionOptions {
  showForm: boolean;
  showLast?: boolean;
  trackProps?: SubmitRunTrackProps;
}

export interface RecceActionContextType {
  runAction: (
    type: RunType,
    params?: AxiosQueryParams,
    actionOptions?: RecceActionOptions,
  ) => void;
  runId?: string;
  showRunId: (runId: string, refreshHistory?: boolean) => void;
  isRunResultOpen: boolean;
  closeRunResult: () => void;
  isHistoryOpen: boolean;
  closeHistory: () => void;
  showHistory: () => void;
  setHistoryOpen: Dispatch<SetStateAction<boolean>>;
  clearRunResult: () => void;
}

export const RecceActionContext = createContext<RecceActionContextType>({
  runAction: () => {
    return void 0;
  },
  showRunId: (runId: string) => {
    return void 0;
  },
  isRunResultOpen: false,
  closeRunResult: () => {
    return void 0;
  },
  isHistoryOpen: false,
  closeHistory: () => {
    return void 0;
  },
  showHistory: () => {
    return void 0;
  },
  setHistoryOpen: (v) => {
    return void 0;
  },
  clearRunResult: () => {
    return void 0;
  },
});

interface RecceActionContextProviderProps {
  children: React.ReactNode;
}

const useCloseModalEffect = (onClose: () => void) => {
  const [location] = useLocation();

  // biome-ignore lint/correctness/useExhaustiveDependencies: Specifically run in location changes
  useEffect(() => {
    onClose();
  }, [onClose, location]);
};

interface RunActionInternal {
  session: string;
  title: string;
  type: RunType;
  params?: RunFormParamTypes;
  lastRun?: Run;
  options?: RecceActionOptions;
  RunForm?: ComponentType<RunFormProps<RunFormParamTypes>>;
}

export function RecceActionContextProvider({
  children,
}: RecceActionContextProviderProps) {
  const [action, setAction] = useState<RunActionInternal>();
  const {
    open: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure();
  const {
    open: isRunResultOpen,
    onOpen: onResultPaneOpen,
    onClose: closeRunResult,
  } = useDisclosure();
  const {
    open: isHistoryOpen,
    onOpen: showHistory,
    onClose: closeHistory,
    setOpen: setHistoryOpen,
  } = useDisclosure();
  const [runId, setRunId] = useState<string>();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const showRunId = useCallback(
    async (runId: string, refreshHistory?: boolean) => {
      setRunId(runId);
      onResultPaneOpen();

      if (refreshHistory !== false) {
        await queryClient.invalidateQueries({ queryKey: cacheKeys.runs() });
      }
    },
    [onResultPaneOpen, queryClient],
  );

  const clearRunResult = useCallback(() => {
    setRunId(undefined);
    closeRunResult();
  }, [closeRunResult]);

  const runAction = useCallback(
    async (
      type: RunType,
      params?: AxiosQueryParams,
      options?: RecceActionOptions,
    ) => {
      try {
        const session = new Date().getTime().toString();
        let lastRun = undefined;
        if (options?.showLast) {
          const runs = await searchRuns(type, params, 1);
          if (runs.length === 1) {
            lastRun = runs[0];
          }
        }

        const run = findByRunType(type);
        const RunResultView = run.RunResultView as
          | RegistryEntry["RunResultView"]
          | undefined;
        const { title, RunForm } = run;
        if (RunResultView === undefined) {
          throw new Error(`Run type ${type} does not have a result view`);
        }

        if (RunForm == undefined || !options?.showForm) {
          const { run_id } = await submitRun(type, params, {
            nowait: true,
            trackProps: options?.trackProps,
          });
          await showRunId(run_id);
          await queryClient.invalidateQueries({ queryKey: cacheKeys.runs() });
          if (location.startsWith("/lineage")) {
            setLocation("/lineage");
          }
        } else {
          setAction({
            session,
            title,
            type,
            params,
            lastRun,
            options,
            RunForm,
          });
          onModalOpen();
        }
      } catch (e: unknown) {
        toaster.create({
          title: "Failed to submit a run",
          description: e instanceof Error ? e.message : undefined,
          type: "error",
          duration: 5000,
          closable: true,
        });
      }
    },
    [onModalOpen, showRunId, location, setLocation, queryClient],
  );
  useCloseModalEffect(onModalClose);

  const handleExecute = async (type: RunType, params: RunParamTypes) => {
    try {
      onModalClose();
      const { run_id } = await submitRun(type, params, {
        nowait: true,
        trackProps: action?.options?.trackProps,
      });
      await showRunId(run_id);
    } catch (e: unknown) {
      toaster.create({
        title: "Failed to submit a run",
        description: e instanceof Error ? e.message : undefined,
        type: "error",
        duration: 5000,
        closable: true,
      });
    }
  };

  return (
    <RecceActionContext.Provider
      value={{
        runAction,
        runId,
        showRunId,
        isRunResultOpen,
        closeRunResult,
        isHistoryOpen,
        closeHistory,
        showHistory,
        setHistoryOpen,
        clearRunResult,
      }}
    >
      {action && (
        <RunModal
          key={action.session}
          isOpen={isModalOpen}
          onClose={onModalClose}
          onExecute={handleExecute}
          title={action.title}
          type={action.type}
          params={action.params}
          initialRun={action.lastRun}
          RunForm={
            action.options?.showForm && action.RunForm
              ? action.RunForm
              : undefined
          }
        />
      )}
      {children}
    </RecceActionContext.Provider>
  );
}

export const useRecceActionContext = () => useContext(RecceActionContext);
