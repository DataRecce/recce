"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

export interface Check {
  check_id: string;
  name: string;
  type: string;
  description?: string;
  is_checked?: boolean;
}

export interface CheckContextType {
  checks: Check[];
  isLoading: boolean;
  error?: string;
  selectedCheckId?: string;
  onSelectCheck?: (checkId: string) => void;
  onCreateCheck?: (check: Partial<Check>) => Promise<Check>;
  onUpdateCheck?: (checkId: string, updates: Partial<Check>) => Promise<Check>;
  onDeleteCheck?: (checkId: string) => Promise<void>;
  onReorderChecks?: (sourceIndex: number, destIndex: number) => Promise<void>;
  refetchChecks?: () => void;
}

const defaultContext: CheckContextType = {
  checks: [],
  isLoading: false,
};

const CheckContext = createContext<CheckContextType>(defaultContext);
CheckContext.displayName = "RecceCheckContext";

export interface CheckProviderProps {
  children: ReactNode;
  checks?: Check[];
  isLoading?: boolean;
  error?: string;
  selectedCheckId?: string;
  onSelectCheck?: (checkId: string) => void;
  onCreateCheck?: (check: Partial<Check>) => Promise<Check>;
  onUpdateCheck?: (checkId: string, updates: Partial<Check>) => Promise<Check>;
  onDeleteCheck?: (checkId: string) => Promise<void>;
  onReorderChecks?: (sourceIndex: number, destIndex: number) => Promise<void>;
  refetchChecks?: () => void;
}

export function CheckProvider({
  children,
  checks = [],
  isLoading = false,
  error,
  selectedCheckId,
  onSelectCheck,
  onCreateCheck,
  onUpdateCheck,
  onDeleteCheck,
  onReorderChecks,
  refetchChecks,
}: CheckProviderProps) {
  const contextValue = useMemo<CheckContextType>(
    () => ({
      checks,
      isLoading,
      error,
      selectedCheckId,
      onSelectCheck,
      onCreateCheck,
      onUpdateCheck,
      onDeleteCheck,
      onReorderChecks,
      refetchChecks,
    }),
    [
      checks,
      isLoading,
      error,
      selectedCheckId,
      onSelectCheck,
      onCreateCheck,
      onUpdateCheck,
      onDeleteCheck,
      onReorderChecks,
      refetchChecks,
    ],
  );

  return (
    <CheckContext.Provider value={contextValue}>
      {children}
    </CheckContext.Provider>
  );
}

export function useCheckContext(): CheckContextType {
  return useContext(CheckContext);
}
