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

  // OSS aliases for backward compatibility
  /** @remarks Alias of selectedCheckId (OSS backward compatibility). */
  latestSelectedCheckId?: string;
  /** @remarks Alias of onSelectCheck (OSS backward compatibility). */
  setLatestSelectedCheckId?: (checkId: string) => void;
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

  // OSS aliases for backward compatibility (prefer canonical names above)
  /** @remarks Alias of selectedCheckId (OSS backward compatibility). */
  latestSelectedCheckId?: string;
  /** @remarks Alias of onSelectCheck (OSS backward compatibility). */
  setLatestSelectedCheckId?: (checkId: string) => void;
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
  // OSS aliases (canonical props take precedence)
  latestSelectedCheckId,
  setLatestSelectedCheckId,
}: CheckProviderProps) {
  // Resolve values: canonical props take precedence over OSS aliases
  const resolvedSelectedCheckId = selectedCheckId ?? latestSelectedCheckId;
  const resolvedOnSelectCheck = onSelectCheck ?? setLatestSelectedCheckId;

  const contextValue = useMemo<CheckContextType>(
    () => ({
      checks,
      isLoading,
      error,
      // Canonical properties
      selectedCheckId: resolvedSelectedCheckId,
      onSelectCheck: resolvedOnSelectCheck,
      onCreateCheck,
      onUpdateCheck,
      onDeleteCheck,
      onReorderChecks,
      refetchChecks,
      // OSS aliases (point to same resolved values)
      latestSelectedCheckId: resolvedSelectedCheckId,
      setLatestSelectedCheckId: resolvedOnSelectCheck,
    }),
    [
      checks,
      isLoading,
      error,
      resolvedSelectedCheckId,
      resolvedOnSelectCheck,
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
