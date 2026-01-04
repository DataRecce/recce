"use client";

import {
  CheckProvider,
  type CheckProviderProps,
  useCheckContext,
} from "@datarecce/ui/providers";
import type { ReactNode } from "react";

interface CheckContextAdapterProps {
  children: ReactNode;
}

/**
 * CheckContextAdapter bridges OSS with @datarecce/ui's CheckProvider.
 *
 * Since @datarecce/ui CheckProvider now supports OSS aliases
 * (latestSelectedCheckId, setLatestSelectedCheckId), this adapter
 * is a thin wrapper that just passes children to the provider.
 *
 * The OSS RecceCheckContext was very simple - just selection state:
 * - latestSelectedCheckId: string
 * - setLatestSelectedCheckId: (checkId: string) => void
 *
 * The @datarecce/ui CheckProvider manages this internally and exposes
 * it through both canonical names and OSS aliases.
 */
export function CheckContextAdapter({ children }: CheckContextAdapterProps) {
  return <CheckProvider>{children}</CheckProvider>;
}

// Re-export types for backward compatibility
export type {
  Check,
  CheckContextType,
  CheckProviderProps,
} from "@datarecce/ui/providers";

// Re-export hook with OSS alias for backward compatibility
export { useCheckContext, useCheckContext as useRecceCheckContext };
