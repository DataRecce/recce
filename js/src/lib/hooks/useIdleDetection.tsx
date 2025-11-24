import { useCallback, useEffect, useRef } from "react";
import { sendKeepAlive } from "@/lib/api/keepAlive";
import { useRecceInstanceInfo } from "./useRecceInstanceInfo";

/**
 * Check if running in development mode
 */
const isDev = !process.env.NODE_ENV.startsWith("prod");

/**
 * Log function that only outputs in development mode
 */
function devLog(message: string, data?: Record<string, unknown>) {
  if (isDev) {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
}

/**
 * Configuration for idle detection behavior
 */
const IDLE_DETECTION_CONFIG = {
  /** Events to listen for user activity */
  ACTIVITY_EVENTS: ["focus", "mousemove", "keydown", "scroll"] as const,
  /** Throttle activity logs to avoid console spam (1 second) */
  ACTIVITY_LOG_THROTTLE: 1000,
  /** Minimum debounce interval in milliseconds (30 seconds) */
  MIN_DEBOUNCE_INTERVAL: 30 * 1000,
  /** Maximum debounce interval in milliseconds (5 minutes) */
  MAX_DEBOUNCE_INTERVAL: 5 * 60 * 1000,
} as const;

/**
 * Calculate dynamic debounce interval based on idle timeout
 * Formula: idle_timeout / 3, clamped between 30s and 5min
 */
function calculateDebounceInterval(idleTimeoutSeconds: number): number {
  const calculatedMs = (idleTimeoutSeconds * 1000) / 3;
  return Math.max(
    IDLE_DETECTION_CONFIG.MIN_DEBOUNCE_INTERVAL,
    Math.min(IDLE_DETECTION_CONFIG.MAX_DEBOUNCE_INTERVAL, calculatedMs),
  );
}

/**
 * Hook to detect user activity and send keep-alive signals to prevent server idle timeout.
 *
 * This hook:
 * - Listens for user activities (focus, mouse, keyboard, scroll)
 * - Sends keep-alive requests at most once every 5 minutes
 * - Pauses when the tab is inactive (using Page Visibility API)
 * - Immediately sends a keep-alive when tab becomes active if > 5 minutes elapsed
 * - Only activates when idle_timeout is configured on the server
 */
export function useIdleDetection() {
  const { data: instanceInfo, isLoading, isError } = useRecceInstanceInfo();
  const lastActivityRef = useRef<number>(Date.now());
  const lastActivityLogRef = useRef<number>(0);
  const isSendingRef = useRef<boolean>(false); // Lock to prevent concurrent sends

  // Only enable idle detection if idle_timeout is configured
  const idleTimeout = instanceInfo?.idle_timeout;
  const isEnabled = idleTimeout !== undefined && idleTimeout > 0;

  // Calculate dynamic debounce interval based on idle_timeout
  const debounceInterval = isEnabled
    ? calculateDebounceInterval(idleTimeout)
    : IDLE_DETECTION_CONFIG.MAX_DEBOUNCE_INTERVAL;

  // Debug: Log instance info state
  devLog("[Idle Detection] Hook called", {
    instanceInfo,
    isLoading,
    isError,
    hasIdleTimeout: instanceInfo?.idle_timeout !== undefined,
    idleTimeout: idleTimeout ? `${idleTimeout}s` : undefined,
    debounceInterval: `${debounceInterval / 1000}s`,
  });

  /**
   * Send keep-alive signal to server
   * This is called directly when we determine a ping should be sent
   * Uses a lock to prevent concurrent API calls
   */
  const sendKeepAliveNow = useCallback(async () => {
    if (document.hidden) return;

    // Check if already sending
    if (isSendingRef.current) {
      devLog("[Idle Detection] Skipping - already sending keep-alive");
      return;
    }

    // Acquire lock
    isSendingRef.current = true;
    const now = Date.now();
    const timeSinceLast = (now - lastActivityRef.current) / 1000;

    // Update lastActivityRef BEFORE sending to prevent race conditions
    lastActivityRef.current = now;

    devLog("[Idle Detection] Sending keep-alive", {
      timestamp: new Date().toISOString(),
      timeSinceLastPing: `${timeSinceLast.toFixed(1)}s`,
      nextPingIn: `${debounceInterval / 1000}s`,
      tabActive: !document.hidden,
    });

    try {
      await sendKeepAlive();

      devLog("[Idle Detection] Keep-alive sent successfully", {
        timestamp: new Date().toISOString(),
        nextPingAt: new Date(now + debounceInterval).toISOString(),
      });
    } catch (error) {
      // Keep console.error in production for debugging critical issues
      console.error("[Idle Detection] Failed to send keep-alive:", error);
    } finally {
      // Release lock
      isSendingRef.current = false;
    }
  }, [debounceInterval]);

  /**
   * Handle any user activity event
   */
  const handleActivity = useCallback(
    (event: Event) => {
      if (isEnabled && !document.hidden) {
        const now = Date.now();
        const elapsed = now - lastActivityRef.current;
        const willSend = elapsed >= debounceInterval;

        // Throttle activity logs to avoid console spam
        const timeSinceLastLog = now - lastActivityLogRef.current;
        if (timeSinceLastLog >= IDLE_DETECTION_CONFIG.ACTIVITY_LOG_THROTTLE) {
          const remaining = Math.max(0, debounceInterval - elapsed);

          devLog("[Idle Detection] Activity detected", {
            event: event.type,
            tabActive: !document.hidden,
            timeSinceLastPing: `${(elapsed / 1000).toFixed(1)}s`,
            willSendAPI: willSend,
            remainingDebounce: willSend
              ? "0s (sending now)"
              : `${(remaining / 1000).toFixed(1)}s`,
            nextPingIn: willSend
              ? `${debounceInterval / 1000}s`
              : `${(remaining / 1000).toFixed(1)}s`,
          });

          lastActivityLogRef.current = now;
        }

        // Actually send keep-alive if debounce interval has passed
        if (willSend) {
          sendKeepAliveNow();
        }
      }
    },
    [isEnabled, debounceInterval, sendKeepAliveNow],
  );

  /**
   * Handle tab visibility changes
   * When tab becomes active, immediately send keep-alive if debounce interval elapsed
   */
  const handleVisibilityChange = useCallback(() => {
    if (!isEnabled) return;

    const elapsed = Date.now() - lastActivityRef.current;
    const willTrigger = !document.hidden && elapsed > debounceInterval;

    devLog("[Idle Detection] Tab visibility changed", {
      tabActive: !document.hidden,
      timeSinceLastPing: `${(elapsed / 1000).toFixed(1)}s`,
      willTriggerImmediate: willTrigger,
      reason: willTrigger
        ? "Elapsed > debounce interval"
        : document.hidden
          ? "Tab inactive"
          : "Within debounce window",
    });

    if (willTrigger) {
      // Send keep-alive immediately when tab becomes active after debounce interval
      sendKeepAliveNow();
    }
  }, [isEnabled, debounceInterval, sendKeepAliveNow]);

  useEffect(() => {
    if (!isEnabled) {
      devLog("[Idle Detection] Disabled", {
        idleTimeout: idleTimeout,
        reason:
          idleTimeout === undefined
            ? "idle_timeout not configured on server"
            : "idle_timeout is 0",
      });
      return;
    }

    devLog("[Idle Detection] Initialized", {
      enabled: true,
      idleTimeout: `${idleTimeout}s`,
      debounceInterval: `${debounceInterval / 1000}s (${(debounceInterval / 1000 / 60).toFixed(1)} minutes)`,
      calculationFormula: `idle_timeout / 3 = ${idleTimeout} / 3 = ${(idleTimeout / 3).toFixed(1)}s`,
      monitoredEvents: IDLE_DETECTION_CONFIG.ACTIVITY_EVENTS.join(", "),
    });

    // Register activity event listeners
    IDLE_DETECTION_CONFIG.ACTIVITY_EVENTS.forEach((eventType) => {
      window.addEventListener(eventType, handleActivity, { passive: true });
    });

    // Register visibility change listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup function
    return () => {
      devLog("[Idle Detection] Cleanup - removing event listeners");
      IDLE_DETECTION_CONFIG.ACTIVITY_EVENTS.forEach((eventType) => {
        window.removeEventListener(eventType, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    isEnabled,
    handleActivity,
    handleVisibilityChange,
    idleTimeout,
    debounceInterval,
  ]);
}
