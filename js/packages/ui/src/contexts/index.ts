"use client";

// Idle timeout context - session management and keep-alive
export type { IdleTimeoutContextType } from "./idle";
export {
  IdleTimeoutProvider,
  useIdleDetection,
  useIdleTimeout,
  useIdleTimeoutSafe,
} from "./idle";
// Instance context - feature toggles and session info
export type {
  InstanceInfoType,
  RecceFeatureMode,
  RecceFeatureToggles,
} from "./instance";
export {
  defaultFeatureToggles,
  defaultInstanceInfo,
  RecceInstanceInfoProvider,
  useRecceInstanceContext,
  useRecceInstanceInfo,
} from "./instance";
