"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

import {
  defaultFeatureToggles,
  defaultInstanceInfo,
  type InstanceInfoType,
  type RecceFeatureToggles,
} from "./types";
import { useRecceInstanceInfo } from "./useRecceInstanceInfo";

const InstanceInfoContext =
  createContext<InstanceInfoType>(defaultInstanceInfo);
InstanceInfoContext.displayName = "RecceInstanceInfoContext";

/**
 * Provider that fetches and processes Recce instance information.
 *
 * This provider:
 * 1. Fetches instance info from the server using useRecceInstanceInfo
 * 2. Computes feature toggles based on server_mode
 * 3. Provides the processed data through context
 *
 * Feature toggles are computed based on:
 * - server_mode: "read-only" disables all modifications
 * - server_mode: "preview" disables database queries but allows metadata operations
 * - single_env: disables checklist updates and sharing
 * - cloud_instance: disables sharing
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <RecceProvider api={{ baseUrl: "/api" }}>
 *       <RecceInstanceInfoProvider>
 *         <MyComponent />
 *       </RecceInstanceInfoProvider>
 *     </RecceProvider>
 *   );
 * }
 * ```
 */
export function RecceInstanceInfoProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data: instanceInfo, isLoading } = useRecceInstanceInfo();
  const [featureToggles, setFeatureToggles] = useState<RecceFeatureToggles>(
    defaultFeatureToggles,
  );
  const [singleEnv, setSingleEnv] = useState<boolean>(false);
  const [authed, setAuthed] = useState<boolean>(false);
  const [lifetimeExpiredAt, setLifetimeExpiredAt] = useState<Date>();
  const [shareUrl, setShareUrl] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [prevInstanceInfo, setPrevInstanceInfo] = useState(instanceInfo);

  // Adjust state during render when instanceInfo changes
  if (!isLoading && instanceInfo && instanceInfo !== prevInstanceInfo) {
    setPrevInstanceInfo(instanceInfo);

    setSingleEnv(instanceInfo.single_env);
    setAuthed(instanceInfo.authed);
    setShareUrl(instanceInfo.share_url);
    setSessionId(instanceInfo.session_id);

    if (instanceInfo.lifetime_expired_at) {
      setLifetimeExpiredAt(new Date(instanceInfo.lifetime_expired_at));
      console.log("lifetime expired at", instanceInfo.lifetime_expired_at);
    }

    // Set feature toggles based on instanceInfo
    const toggles = { ...defaultFeatureToggles };
    if (instanceInfo.server_mode === "read-only") {
      toggles.mode = "read only";
      toggles.disableSaveToFile = true;
      toggles.disableExportStateFile = true;
      toggles.disableImportStateFile = true;
      toggles.disableUpdateChecklist = true;
      toggles.disableDatabaseQuery = true;
      toggles.disableViewActionDropdown = true;
      toggles.disableNodeActionDropdown = true;
      toggles.disableShare = true;
    } else if (instanceInfo.server_mode === "preview") {
      toggles.mode = "metadata only";
      toggles.disableSaveToFile = true;
      toggles.disableExportStateFile = true;
      toggles.disableImportStateFile = true;
      toggles.disableUpdateChecklist = false;
      toggles.disableDatabaseQuery = true;
      toggles.disableViewActionDropdown = false;
      toggles.disableNodeActionDropdown = false;
      toggles.disableShare = true;
    }
    if (instanceInfo.single_env) {
      toggles.disableUpdateChecklist = true;
      toggles.disableShare = true;
    }
    if (instanceInfo.cloud_instance) {
      toggles.disableShare = true;
    }
    setFeatureToggles(toggles);
  }

  return (
    <InstanceInfoContext.Provider
      value={{
        featureToggles,
        singleEnv,
        authed,
        lifetimeExpiredAt,
        shareUrl,
        sessionId,
      }}
    >
      {children}
    </InstanceInfoContext.Provider>
  );
}

/**
 * Hook to access the Recce instance context.
 *
 * Returns the current instance information including feature toggles,
 * authentication status, and session information.
 *
 * @returns InstanceInfoType with feature toggles and session info
 *
 * @example
 * ```tsx
 * function FeatureGate() {
 *   const { featureToggles } = useRecceInstanceContext();
 *
 *   if (featureToggles.disableDatabaseQuery) {
 *     return <div>Database queries are disabled</div>;
 *   }
 *
 *   return <QueryEditor />;
 * }
 * ```
 */
export function useRecceInstanceContext(): InstanceInfoType {
  return useContext(InstanceInfoContext);
}
