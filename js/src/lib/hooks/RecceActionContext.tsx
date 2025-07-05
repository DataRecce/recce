import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Run, RunType } from "../api/types";
import { RunModal } from "@/components/run/RunModal";
import { useDisclosure } from "@chakra-ui/react";

import { useLocation } from "wouter";

import { searchRuns, submitRun, SubmitRunTrackProps } from "../api/runs";
import { findByRunType } from "@/components/run/registry";
import { RunFormProps } from "@/components/run/types";
import { useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "../api/cacheKeys";
import { toaster } from "@/components/ui/toaster";

export interface RecceActionOptions {
  showForm: boolean;
  showLast?: boolean;
  trackProps?: SubmitRunTrackProps;
}

export interface RecceActionContextType {
  runAction: (type: string, params?: any, actionOptions?: RecceActionOptions) => void;
  runId?: string;
  showRunId: (runId: string, refreshHistory?: boolean) => void;
  isRunResultOpen: boolean;
  closeRunResult: () => void;
  isHistoryOpen: boolean;
  closeHistory: () => void;
  showHistory: () => void;
  clearRunResult: () => void;
}

export const RecceActionContext = createContext<RecceActionContextType>({
  runAction: () => {},
  showRunId: (runId: string) => {},
  isRunResultOpen: false,
  closeRunResult: () => {},
  isHistoryOpen: false,
  closeHistory: () => {},
  showHistory: () => {},
  clearRunResult: () => {},
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
  RunForm?: React.ComponentType<RunFormProps<any>>;
}

export function RecceActionContextProvider({ children }: RecceActionContextProviderProps) {
  const [action, setAction] = useState<RunActionInternal>();
  const { open: isModalOpen, onOpen: onModalOpen, onClose: onModalClose } = useDisclosure();
  const {
    open: isRunResultOpen,
    onOpen: onResultPaneOpen,
    onClose: closeRunResult,
  } = useDisclosure();
  const { open: isHistoryOpen, onOpen: showHistory, onClose: closeHistory } = useDisclosure();
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
    [setRunId, onResultPaneOpen, queryClient],
  );

  const clearRunResult = useCallback(() => {
    setRunId(undefined);
    closeRunResult();
  }, [closeRunResult, setRunId]);

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
    [setAction, onModalOpen, showRunId, location, setLocation, queryClient],
  );
  useCloseModalEffect(onModalClose);

  const handleExecute = async (type: string, params: any) => {
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
        clearRunResult,
      }}>
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
          RunForm={action.options?.showForm && action.RunForm ? action.RunForm : undefined}
        />
      )}
      {children}
    </RecceActionContext.Provider>
  );
}

export const useRecceActionContext = () => useContext(RecceActionContext);
