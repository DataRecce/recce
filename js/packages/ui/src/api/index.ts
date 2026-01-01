"use client";

// Cache keys for TanStack Query
export { cacheKeys } from "./cacheKeys";

// Instance info API
export type { RecceInstanceInfo, ServerMode } from "./instanceInfo";
export { getRecceInstanceInfo } from "./instanceInfo";

// Keep-alive API for session management
export {
  getLastKeepAliveTime,
  resetKeepAliveState,
  sendKeepAlive,
  setKeepAliveCallback,
} from "./keepAlive";
