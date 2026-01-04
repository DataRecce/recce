"use client";

import axios from "axios";
import throttle from "lodash/throttle";
import { useCallback, useEffect, useMemo } from "react";
import { sendKeepAlive } from "../../api/keepAlive";
import { useApiConfigOptional } from "../../providers/contexts/ApiContext";

import { useRecceInstanceInfo } from "../instance";
import { useIdleTimeoutSafe } from "./IdleTimeoutContext";

// Default axios client for use outside RecceProvider (OSS mode)
const defaultApiClient = axios.create();

/**
 * Check if debug logging is enabled via window.RECCE_DEBUG_IDLE
 * Enable in browser console: window.RECCE_DEBUG_IDLE = true
 * Disable: delete window.RECCE_DEBUG_IDLE
 */
function isDebugEnabled(): boolean {
  // biome-ignore lint/suspicious/noExplicitAny: window flag for debug logging
  return typeof window !== "undefined" && !!(window as any).RECCE_DEBUG_IDLE;
}

/**
 * Log function that only outputs when debug is enabled
 */
function debugLog(message: string, data?: Record<string, unknown>) {
  if (isDebugEnabled()) {
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
  /**
   * Throttle event handler execution to reduce JS overhead (150ms).
   * Uses lodash.throttle with { leading: true, trailing: true } to ensure
   * immediate response on first activity (leading) and also capture the final
   * event in a burst (trailing), which is important for user experience.
   */
  EVENT_THROTTLE_MS: 150,
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
  const idleTimeoutContext = useIdleTimeoutSafe();
  const isDisconnected = idleTimeoutContext?.isDisconnected ?? false;
  const apiConfig = useApiConfigOptional();
  const apiClient = apiConfig?.apiClient ?? defaultApiClient;

  // Only enable idle detection if idle_timeout is configured and not disconnected
  const idleTimeout = instanceInfo?.idle_timeout;
  const isEnabled =
    idleTimeout !== undefined && idleTimeout > 0 && !isDisconnected;

  // Debug: Log instance info state when debug is enabled
  debugLog("[Idle Detection] Instance info", {
    isLoading,
    isError,
    hasIdleTimeout: idleTimeout !== undefined,
    idleTimeout:
      idleTimeout !== undefined ? `${idleTimeout}s` : "not configured",
    isDisconnected,
    isEnabled,
  });

  /**
   * Send keep-alive signal to server
   * Throttling is handled at the axios layer (minimum 3 seconds between API calls)
   * The successful send will notify IdleTimeoutContext to reset countdown
   */
  const sendKeepAliveNow = useCallback(async () => {
    if (document.hidden) return;

    const sent = await sendKeepAlive(apiClient);

    if (sent) {
      debugLog("[Idle Detection] Keep-alive sent successfully", {
        timestamp: new Date().toISOString(),
      });
    }
  }, [apiClient]);

  /**
   * Handle any user activity event
   * Attempts to send keep-alive (axios layer handles throttling)
   */
  const handleActivity = useCallback(
    (event: Event) => {
      if (isEnabled && !document.hidden) {
        debugLog("[Idle Detection] Activity detected", {
          event: event.type,
          tabActive: !document.hidden,
        });

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
      debugLog("[Idle Detection] Tab became active", {
        timestamp: new Date().toISOString(),
      });

      // Send keep-alive (axios layer handles throttling)
      void sendKeepAliveNow();
    }
  }, [isEnabled, sendKeepAliveNow]);

  // Create throttled handler using lodash to reduce JS overhead from high-frequency events
  // useMemo ensures stable reference and proper cleanup
  const throttledHandler = useMemo(
    () =>
      throttle(handleActivity, IDLE_DETECTION_CONFIG.EVENT_THROTTLE_MS, {
        leading: true,
        trailing: true,
      }),
    [handleActivity],
  );

  useEffect(() => {
    if (!isEnabled) {
      debugLog("[Idle Detection] Disabled", {
        idleTimeout: idleTimeout,
        reason:
          idleTimeout === undefined
            ? "idle_timeout not configured on server"
            : idleTimeout === 0
              ? "idle_timeout is 0"
              : "disconnected",
      });
      return;
    }

    debugLog("[Idle Detection] Initialized", {
      enabled: true,
      idleTimeout: `${idleTimeout}s`,
      eventThrottle: `${IDLE_DETECTION_CONFIG.EVENT_THROTTLE_MS}ms`,
      apiThrottle: "3s (axios layer)",
      monitoredEvents: IDLE_DETECTION_CONFIG.ACTIVITY_EVENTS.join(", "),
    });

    // Register activity event listeners with throttled handler
    IDLE_DETECTION_CONFIG.ACTIVITY_EVENTS.forEach((eventType) => {
      window.addEventListener(eventType, throttledHandler, { passive: true });
    });

    // Register visibility change listener (not throttled - immediate response needed)
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup function
    return () => {
      debugLog("[Idle Detection] Cleanup - removing event listeners");
      IDLE_DETECTION_CONFIG.ACTIVITY_EVENTS.forEach((eventType) => {
        window.removeEventListener(eventType, throttledHandler);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      throttledHandler.cancel(); // Cancel any pending throttled calls
    };
  }, [isEnabled, throttledHandler, handleVisibilityChange, idleTimeout]);
}
