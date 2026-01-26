"use client";

// Idle timeout context and provider
export { IdleTimeoutProvider, useIdleTimeout } from "./IdleTimeoutContext";
// Types and safe hook (no dependencies on other idle modules)
export type { IdleTimeoutContextType } from "./types";
export { useIdleTimeoutSafe } from "./types";

// Idle detection hook (typically used internally by IdleTimeoutProvider)
export { useIdleDetection } from "./useIdleDetection";
