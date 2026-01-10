"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getLastKeepAliveTime,
  setKeepAliveCallback,
} from "../../api/keepAlive";
import { useRecceInstanceInfo } from "../instance";
import { useIdleDetection } from "./useIdleDetection";

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

const IdleTimeoutContext = createContext<IdleTimeoutContextType | undefined>(
  undefined,
);

/**
 * Provider for idle timeout state
 *
 * The countdown is based on lastServerSyncTime (when keep-alive API was last
 * successfully sent), not on user activity. This provides accurate server state.
 */
export function IdleTimeoutProvider({ children }: { children: ReactNode }) {
  const { data: instanceInfo } = useRecceInstanceInfo();
  // Track the last time we successfully synced with server (keep-alive sent)
  const lastServerSyncRef = useRef<number>(Date.now());
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isDisconnected, setIsDisconnected] = useState(false);

  const idleTimeout = instanceInfo?.idle_timeout ?? null;
  const isEnabled = idleTimeout !== null && idleTimeout > 0;

  // Register callback to receive keep-alive success notifications
  // Use ref to track enabled state to avoid race condition in callback
  const isEnabledRef = useRef(isEnabled);
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled) {
      setKeepAliveCallback(null);
      return;
    }

    setKeepAliveCallback((timestamp: number) => {
      // Check current enabled state to avoid updating after disabled
      if (isEnabledRef.current) {
        lastServerSyncRef.current = timestamp;
      }
    });

    // Initialize with current keep-alive time if available
    const currentTime = getLastKeepAliveTime();
    if (currentTime > 0) {
      lastServerSyncRef.current = currentTime;
    }

    return () => {
      setKeepAliveCallback(null);
    };
  }, [isEnabled]);

  const setDisconnected = useCallback(() => {
    setIsDisconnected(true);
  }, []);

  const resetConnection = useCallback(() => {
    // Reset disconnected state
    setIsDisconnected(false);
    // Reset server sync time to now (server just restarted, timer reset)
    lastServerSyncRef.current = Date.now();
  }, []);

  // Update remaining seconds every second based on server sync time
  useEffect(() => {
    if (!isEnabled || idleTimeout === null) {
      setRemainingSeconds(null);
      return;
    }

    // Stop updating countdown if disconnected
    if (isDisconnected) {
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const elapsedSeconds = (now - lastServerSyncRef.current) / 1000;
      const remaining = Math.max(0, idleTimeout - elapsedSeconds);
      setRemainingSeconds(remaining);
    };

    // Initial update
    updateCountdown();

    // Set up interval for updates
    const intervalId = setInterval(updateCountdown, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isEnabled, idleTimeout, isDisconnected]);

  return (
    <IdleTimeoutContext.Provider
      value={{
        remainingSeconds,
        idleTimeout,
        isEnabled,
        setDisconnected,
        resetConnection,
        isDisconnected,
      }}
    >
      <IdleDetector />
      {children}
    </IdleTimeoutContext.Provider>
  );
}

/**
 * Internal component that activates idle detection
 * Placed inside provider so it has access to context
 */
function IdleDetector() {
  useIdleDetection();
  return null;
}

/**
 * Hook to access idle timeout context
 * @throws Error if used outside IdleTimeoutProvider
 */
export function useIdleTimeout() {
  const context = useContext(IdleTimeoutContext);
  if (!context) {
    throw new Error("useIdleTimeout must be used within IdleTimeoutProvider");
  }
  return context;
}

/**
 * Hook to access idle timeout context, returns null if outside provider
 * Used internally by useIdleDetection to avoid circular dependency
 */
export function useIdleTimeoutSafe(): IdleTimeoutContextType | null {
  return useContext(IdleTimeoutContext) ?? null;
}
