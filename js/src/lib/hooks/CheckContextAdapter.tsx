"use client";

import {
  CheckProvider,
  type CheckProviderProps,
  useCheckContext,
} from "@datarecce/ui/providers";
import { type ReactNode, useState } from "react";

interface CheckContextAdapterProps {
  children: ReactNode;
}

/**
 * OSS-compatible CheckContext type with required fields.
 * The @datarecce/ui CheckContextType has optional OSS fields,
 * but OSS components expect them to be defined.
 */
export interface OSSCheckContext {
  latestSelectedCheckId: string;
  setLatestSelectedCheckId: (checkId: string) => void;
}

/**
 * CheckContextAdapter bridges OSS with @datarecce/ui's CheckProvider.
 *
 * The OSS RecceCheckContext was very simple - just selection state:
 * - latestSelectedCheckId: string
 * - setLatestSelectedCheckId: (checkId: string) => void
 *
 * This adapter manages internal state and provides the OSS interface
 * through the @datarecce/ui CheckProvider.
 */
export function CheckContextAdapter({ children }: CheckContextAdapterProps) {
  const [selectedCheckId, setSelectedCheckId] = useState<string>("");

  return (
    <CheckProvider
      selectedCheckId={selectedCheckId}
      onSelectCheck={setSelectedCheckId}
      latestSelectedCheckId={selectedCheckId}
      setLatestSelectedCheckId={setSelectedCheckId}
    >
      {children}
    </CheckProvider>
  );
}

// Re-export types for backward compatibility
export type {
  Check,
  CheckContextType,
  CheckProviderProps,
} from "@datarecce/ui/providers";

// No-op fallback for when hook is used outside provider
const noopSetCheckId = () => {
  // Intentionally empty - fallback when used outside CheckContextAdapter
};

/**
 * OSS-compatible hook that returns the check context with guaranteed non-optional fields.
 * This wraps @datarecce/ui's useCheckContext and provides type safety for OSS components.
 */
export function useRecceCheckContext(): OSSCheckContext {
  const ctx = useCheckContext();

  // Return OSS-compatible interface with guaranteed values
  // The CheckContextAdapter ensures these are always set
  return {
    latestSelectedCheckId: ctx.latestSelectedCheckId ?? "",
    setLatestSelectedCheckId: ctx.setLatestSelectedCheckId ?? noopSetCheckId,
  };
}

// Also export the raw hook for cases where the full type is needed
export { useCheckContext };
