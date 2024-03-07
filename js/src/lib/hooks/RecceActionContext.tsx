import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Run, RunType } from "../api/types";
import { ValueDiffResultView } from "@/components/valuediff/ValueDiffResultView";
import { ValueDiffForm } from "@/components/valuediff/ValueDiffForm";
import { ProfileDiffResultView } from "@/components/profile/ProfileDiffResultView";
import { RunModal } from "@/components/run/RunModal";
import { useDisclosure } from "@chakra-ui/react";
import { ValueDiffDetailResultView } from "@/components/valuediff/ValueDiffDetailResultView";
import { useLocation } from "wouter";
import { TopKDiffResultView } from "@/components/top-k/TopKDiffResultView";
import { TopKDiffForm } from "@/components/top-k/TopKDiffForm";
import { HistogramDiffResultView } from "@/components/histogram/HistogramDiffResultView";
import { HistogramDiffForm } from "@/components/histogram/HistogramDiffForm";
import { searchRuns } from "../api/runs";

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

interface RegistryEntry {
  title: string;
  RunResultView: any;
  RunForm?: any;
}

const registry: { [key: string]: RegistryEntry } = {
  profile_diff: {
    title: "Profile Diff",
    RunResultView: ProfileDiffResultView,
  },
  value_diff: {
    title: "Value Diff",
    RunResultView: ValueDiffResultView,
    RunForm: ValueDiffForm,
  },
  value_diff_detail: {
    title: "Value Diff Detail",
    RunResultView: ValueDiffDetailResultView,
    RunForm: ValueDiffForm,
  },
  top_k_diff: {
    title: "Top-K Diff",
    RunResultView: TopKDiffResultView,
    RunForm: TopKDiffForm,
  },
  histogram_diff: {
    title: "Histogram Diff",
    RunResultView: HistogramDiffResultView,
    RunForm: HistogramDiffForm,
  },
};

const useCloseModalEffect = (onClose: () => void) => {
  const [location] = useLocation();

  useEffect(() => {
    onClose();
  }, [onClose, location]);
};

export function RecceActionContextProvider({
  children,
}: RecceActionContextProviderProps) {
  const [action, setAction] = useState<{
    session: string;
    type: RunType;
    params?: any;
    lastRun?: Run;
    options?: RecceActionOptions;
  }>();
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
      {action && registry[action.type] && (
        <RunModal
          key={action.session}
          isOpen={isOpen}
          onClose={onClose}
          title={registry[action.type].title}
          type={action.type}
          params={action.params}
          initialRun={action.lastRun}
          RunResultView={registry[action.type].RunResultView}
          RunForm={
            action.options?.showForm ? registry[action.type].RunForm : undefined
          }
        ></RunModal>
      )}
      {children}
    </RecceActionContext.Provider>
  );
}

export const useRecceActionContext = () => useContext(RecceActionContext);
