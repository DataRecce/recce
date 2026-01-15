"use client";

// Idle timeout context and provider
export type { IdleTimeoutContextType } from "./IdleTimeoutContext";
export {
  IdleTimeoutProvider,
  useIdleTimeout,
  useIdleTimeoutSafe,
} from "./IdleTimeoutContext";

// Idle detection hook (typically used internally by IdleTimeoutProvider)
export { useIdleDetection } from "./useIdleDetection";
