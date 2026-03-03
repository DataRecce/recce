"use client";

import { createContext, useContext } from "react";

/**
 * Context for sharing idle timeout state across components
 *
 * IMPORTANT: The countdown is based on the last SUCCESSFUL keep-alive API call,
 * NOT on user activity. This ensures the countdown accurately reflects the
 * server's idle timeout state.
 */
export interface IdleTimeoutContextType {
  /** Remaining seconds until timeout (null if idle timeout not enabled) */
  remainingSeconds: number | null;
  /** Idle timeout value from server in seconds (null if not configured) */
  idleTimeout: number | null;
  /** Whether idle timeout is enabled */
  isEnabled: boolean;
  /** Mark as disconnected - stops countdown and keep-alive */
  setDisconnected: () => void;
  /** Reset connection state - restarts countdown and keep-alive after successful reconnect */
  resetConnection: () => void;
  /** Whether the connection is disconnected */
  isDisconnected: boolean;
}

export const IdleTimeoutContext = createContext<
  IdleTimeoutContextType | undefined
>(undefined);

/**
 * Hook to access idle timeout context, returns null if outside provider
 * Used internally by useIdleDetection to avoid circular dependency
 */
export function useIdleTimeoutSafe(): IdleTimeoutContextType | null {
  return useContext(IdleTimeoutContext) ?? null;
}
