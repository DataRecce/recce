"use client";

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
