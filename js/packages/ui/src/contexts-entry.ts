"use client";

/**
 * Contexts barrel export for @datarecce/ui
 *
 * This module exports all React contexts for OSS consumption:
 * - RecceInstanceContext: Feature toggles and session information
 * - IdleTimeoutContext: Session management and keep-alive
 *
 * @example
 * ```tsx
 * import {
 *   RecceInstanceInfoProvider,
 *   useRecceInstanceContext,
 *   IdleTimeoutProvider,
 *   useIdleTimeout,
 * } from "@datarecce/ui/contexts";
 * ```
 */

// IdleTimeoutContext exports - session management and keep-alive
export type { IdleTimeoutContextType } from "./contexts/idle";
export {
  IdleTimeoutProvider,
  useIdleDetection,
  useIdleTimeout,
  useIdleTimeoutSafe,
} from "./contexts/idle";
// RecceInstanceContext exports - feature toggles and session info
export type {
  InstanceInfoType,
  RecceFeatureMode,
  RecceFeatureToggles,
} from "./contexts/instance";
export {
  defaultFeatureToggles,
  defaultInstanceInfo,
  RecceInstanceInfoProvider,
  useRecceInstanceContext,
  useRecceInstanceInfo,
} from "./contexts/instance";
