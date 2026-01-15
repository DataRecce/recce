"use client";

import type { AxiosInstance } from "axios";

/**
 * Check if debug logging is enabled via window.RECCE_DEBUG_IDLE
 */
function isDebugEnabled(): boolean {
  // biome-ignore lint/suspicious/noExplicitAny: window flag for debug logging
  return typeof window !== "undefined" && !!(window as any).RECCE_DEBUG_IDLE;
}

/**
 * Minimum interval between keep-alive API calls (3 seconds)
 * This prevents excessive API calls while still maintaining responsive idle detection
 */
const MIN_KEEP_ALIVE_INTERVAL_MS = 3 * 1000;

/**
 * State for axios-layer throttling
 * - lastKeepAliveTime: timestamp of last SUCCESSFUL keep-alive sent to server
 * - isSending: lock to prevent concurrent API calls
 */
let lastKeepAliveTime = 0;
let isSending = false;

/** Callback to notify listeners when keep-alive is successfully sent */
type KeepAliveCallback = (timestamp: number) => void;
let onKeepAliveSuccess: KeepAliveCallback | null = null;

/**
 * Register a callback to be notified when keep-alive is successfully sent
 * Used by IdleTimeoutContext to track server sync time
 */
export function setKeepAliveCallback(callback: KeepAliveCallback | null): void {
  onKeepAliveSuccess = callback;
}

/**
 * Send a keep-alive signal to the server to reset the idle timeout timer.
 * This prevents the server from shutting down due to inactivity.
 *
 * Includes built-in throttling at the axios layer:
 * - Minimum 3 seconds between API calls
 * - Prevents concurrent API calls with a lock
 *
 * @param client - Axios instance for API configuration (required)
 * @returns true if keep-alive was sent, false if throttled/skipped
 */
export async function sendKeepAlive(client: AxiosInstance): Promise<boolean> {
  const now = Date.now();
  const elapsed = now - lastKeepAliveTime;

  // Throttle: skip if called within minimum interval
  if (elapsed < MIN_KEEP_ALIVE_INTERVAL_MS) {
    return false;
  }

  // Prevent concurrent sends
  if (isSending) {
    return false;
  }

  try {
    // Acquire lock inside try to ensure finally always releases it
    isSending = true;
    await client.post("/api/keep-alive");
    // Update timestamp only on SUCCESS
    lastKeepAliveTime = Date.now();
    // Notify listeners
    if (onKeepAliveSuccess) {
      onKeepAliveSuccess(lastKeepAliveTime);
    }
    return true;
  } catch (error) {
    // Silent fail - don't disrupt user experience if keep-alive fails
    if (isDebugEnabled()) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log("[Keep-Alive] Failed to send", {
        error: errorMessage,
        timestamp: new Date().toISOString(),
        willRetryOnNextActivity: true,
      });
    }
    return false;
  } finally {
    isSending = false;
  }
}

/**
 * Get the last successful keep-alive timestamp
 * This represents the last time the server confirmed it received our keep-alive
 */
export function getLastKeepAliveTime(): number {
  return lastKeepAliveTime;
}

/**
 * Reset all module state (for testing purposes)
 */
export function resetKeepAliveState(): void {
  lastKeepAliveTime = 0;
  isSending = false;
  onKeepAliveSuccess = null;
}
