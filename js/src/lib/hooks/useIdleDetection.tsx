import { useCallback, useEffect, useRef } from "react";
import { sendKeepAlive } from "@/lib/api/keepAlive";
import { useIdleTimeout } from "./IdleTimeoutContext";
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
} as const;

/**
 * Hook to detect user activity and send keep-alive signals to prevent server idle timeout.
 *
 * This hook:
 * - Listens for user activities (focus, mouse, keyboard, scroll)
 * - Sends keep-alive requests (throttled at axios layer to minimum 3 seconds)
 * - Pauses when the tab is inactive (using Page Visibility API)
 * - Immediately sends a keep-alive when tab becomes active
 * - Only activates when idle_timeout is configured on the server
 *
 * Note: The countdown in IdleTimeoutContext is based on successful keep-alive
 * API calls, not on user activity. This ensures accurate server state tracking.
 */
export function useIdleDetection() {
  const { data: instanceInfo, isLoading, isError } = useRecceInstanceInfo();
  const { isDisconnected } = useIdleTimeout();
  const lastActivityLogRef = useRef<number>(0);

  // Only enable idle detection if idle_timeout is configured and not disconnected
  const idleTimeout = instanceInfo?.idle_timeout;
  const isEnabled =
    idleTimeout !== undefined && idleTimeout > 0 && !isDisconnected;

  // Debug: Log instance info state
  devLog("[Idle Detection] Hook called", {
    instanceInfo,
    isLoading,
    isError,
    hasIdleTimeout: instanceInfo?.idle_timeout !== undefined,
    idleTimeout: idleTimeout ? `${idleTimeout}s` : undefined,
  });

  /**
   * Send keep-alive signal to server
   * Throttling is handled at the axios layer (minimum 3 seconds between API calls)
   * The successful send will notify IdleTimeoutContext to reset countdown
   */
  const sendKeepAliveNow = useCallback(async () => {
    if (document.hidden) return;

    const sent = await sendKeepAlive();

    if (sent) {
      devLog("[Idle Detection] Keep-alive sent successfully", {
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  /**
   * Handle any user activity event
   * Attempts to send keep-alive (axios layer handles throttling)
   */
  const handleActivity = useCallback(
    (event: Event) => {
      if (isEnabled && !document.hidden) {
        const now = Date.now();

        // Throttle activity logs to avoid console spam
        const timeSinceLastLog = now - lastActivityLogRef.current;
        if (timeSinceLastLog >= IDLE_DETECTION_CONFIG.ACTIVITY_LOG_THROTTLE) {
          devLog("[Idle Detection] Activity detected", {
            event: event.type,
            tabActive: !document.hidden,
          });

          lastActivityLogRef.current = now;
        }

        // Send keep-alive API call (axios layer handles throttling)
        void sendKeepAliveNow();
      }
    },
    [isEnabled, sendKeepAliveNow],
  );

  /**
   * Handle tab visibility changes
   * When tab becomes active, attempt to send keep-alive
   */
  const handleVisibilityChange = useCallback(() => {
    if (!isEnabled) return;

    if (!document.hidden) {
      devLog("[Idle Detection] Tab became active", {
        timestamp: new Date().toISOString(),
      });

      // Send keep-alive (axios layer handles throttling)
      void sendKeepAliveNow();
    }
  }, [isEnabled, sendKeepAliveNow]);

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
      throttleInterval: "3s (axios layer)",
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
  }, [isEnabled, handleActivity, handleVisibilityChange, idleTimeout]);
}
