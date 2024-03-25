import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Run, RunType } from "../api/types";
import { RunModal } from "@/components/run/RunModal";
import { useDisclosure } from "@chakra-ui/react";

import { useLocation } from "wouter";

import { searchRuns } from "../api/runs";
import { findByRunType } from "@/components/run/registry";

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
}

export const RecceActionContext = createContext<RecceActionContextType>({
  runAction: () => {},
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
  type: RunType;
  params?: any;
  lastRun?: Run;
  options?: RecceActionOptions;
}

function _ActionModal({
  action,
  isOpen,
  onClose,
}: {
  action: RunActionInternal;
  isOpen: boolean;
  onClose: () => void;
}) {
  const entry = findByRunType(action.type);
  if (entry === undefined) {
    throw new Error(`Unknown run type: ${action.type}`);
  }

  const { title, RunResultView, RunForm } = entry;
  if (RunResultView === undefined) {
    throw new Error(`Run type ${action.type} does not have a result view`);
  }

  return (
    <RunModal
      key={action.session}
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      type={action.type}
      params={action.params}
      initialRun={action.lastRun}
      RunResultView={RunResultView}
      RunForm={action.options?.showForm && RunForm ? RunForm : undefined}
    />
  );
}

export function RecceActionContextProvider({
  children,
}: RecceActionContextProviderProps) {
  const [action, setAction] = useState<RunActionInternal>();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const runAction = useCallback(
    async (type: string, params?: any, options?: RecceActionOptions) => {
      const session = new Date().getTime().toString();
      let lastRun = undefined;
      if (options?.showLast) {
        const runs = await searchRuns(type, params, 1);
        if (runs.length === 1) {
          lastRun = runs[0];
        }
      }
      setAction({ session, type, params, lastRun, options });
      onOpen();
    },
    [setAction, onOpen]
  );
  useCloseModalEffect(onClose);

  return (
    <RecceActionContext.Provider value={{ runAction }}>
      {action && (
        <_ActionModal action={action} isOpen={isOpen} onClose={onClose} />
      )}
      {children}
    </RecceActionContext.Provider>
  );
}

export const useRecceActionContext = () => useContext(RecceActionContext);
