import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Run, RunType } from "../api/types";
import { RunModal } from "@/components/run/RunModal";
import { useDisclosure, useToast } from "@chakra-ui/react";

import { useLocation } from "wouter";

import { searchRuns, submitRun, waitRun } from "../api/runs";
import { findByRunType } from "@/components/run/registry";
import { RunFormProps } from "@/components/run/types";
import { on } from "events";

export interface RecceActionOptions {
  showForm: boolean;
  showLast?: boolean;
}

export interface RecceActionContextType {
  runAction: (
    type: string,
    params?: any,
    actionOptions?: RecceActionOptions
  ) => void;
  runId?: string;
  showRunId: (runId: string) => void;
  isRunResultOpen: boolean;
  closeRunResult: () => void;
  isHistoryOpen: boolean;
  closeHistory: () => void;
  showHistory: () => void;
}

export const RecceActionContext = createContext<RecceActionContextType>({
  runAction: () => {},
  showRunId: (runId: string) => {},
  isRunResultOpen: false,
  closeRunResult: () => {},
  isHistoryOpen: false,
  closeHistory: () => {},
  showHistory: () => {},
});

interface RecceActionContextProviderProps {
  children: React.ReactNode;
}

const useCloseModalEffect = (onClose: () => void) => {
  const [location] = useLocation();

  useEffect(() => {
    onClose();
  }, [onClose, location]);
};

interface RunActionInternal {
  session: string;
  title: string;
  type: RunType;
  params?: any;
  lastRun?: Run;
  options?: RecceActionOptions;
  RunForm: React.ComponentType<RunFormProps<any>>;
}

export function RecceActionContextProvider({
  children,
}: RecceActionContextProviderProps) {
  const [action, setAction] = useState<RunActionInternal>();
  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure();
  const {
    isOpen: isRunResultOpen,
    onOpen: onResultPaneOpen,
    onClose: closeRunResult,
  } = useDisclosure();
  const {
    isOpen: isHistoryOpen,
    onOpen: showHistory,
    onClose: closeHistory,
  } = useDisclosure();
  const toast = useToast();
  const [runId, setRunId] = useState<string>();
  const [location, setLocation] = useLocation();
  const showRunId = useCallback(
    (runId: string) => {
      setRunId(runId);
      onResultPaneOpen();
    },
    [setRunId, onResultPaneOpen]
  );

  const runAction = useCallback(
    async (type: string, params?: any, options?: RecceActionOptions) => {
      try {
        const session = new Date().getTime().toString();
        let lastRun = undefined;
        if (options?.showLast) {
          const runs = await searchRuns(type, params, 1);
          if (runs.length === 1) {
            lastRun = runs[0];
          }
        }

        const entry = findByRunType(type);
        if (entry === undefined) {
          throw new Error(`Unknown run type: ${type}`);
        }

        const { title, RunResultView, RunForm } = entry;
        if (RunResultView === undefined) {
          throw new Error(`Run type ${type} does not have a result view`);
        }

        if (RunForm === undefined || !options?.showForm) {
          const { run_id } = await submitRun(type, params, {
            nowait: true,
          });
          showRunId(run_id);
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
      } catch (e: any) {
        toast({
          title: "Failed to submit a run",
          description: e?.message,
          position: "bottom-right",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    },
    [setAction, onModalOpen, showRunId, toast, location, setLocation]
  );
  useCloseModalEffect(onModalClose);

  const handleExecute = async (type: string, params: any) => {
    try {
      onModalClose();
      const { run_id } = await submitRun(type, params, {
        nowait: true,
      });
      showRunId(run_id);
    } catch (e: any) {
      toast({
        title: "Failed to submit a run",
        description: e?.message,
        position: "bottom-right",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  useEffect(() => {
    if (runId) {
      if (location.startsWith("/checks")) {
        setLocation("/lineage");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

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
