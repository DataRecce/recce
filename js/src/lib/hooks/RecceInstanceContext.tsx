import { createContext, useContext, useEffect, useState } from "react";
import { useRecceInstanceInfo } from "./useRecceInstanceInfo";

interface RecceFeatureToggles {
  mode: "read only" | "preview mode" | null;
  disableSaveToFile: boolean;
  disableExportStateFile: boolean;
  disableImportStateFile: boolean;
  disableUpdateChecklist: boolean;
  disableDatabaseQuery: boolean;
  disableViewActionDropdown: boolean;
  disableNodeActionDropdown: boolean;
  disableShare: boolean;
}

const defaultFeatureToggles: RecceFeatureToggles = {
  mode: null,
  disableSaveToFile: false,
  disableExportStateFile: false,
  disableImportStateFile: false,
  disableUpdateChecklist: false,
  disableDatabaseQuery: false,
  disableViewActionDropdown: false,
  disableNodeActionDropdown: false,
  disableShare: false,
};

interface InstanceInfoType {
  singleEnv: boolean;
  authed: boolean;
  lifetimeExpiredAt?: Date;
  featureToggles: RecceFeatureToggles;
}

const defaultValue: InstanceInfoType = {
  singleEnv: false,
  authed: false,
  lifetimeExpiredAt: undefined,
  featureToggles: defaultFeatureToggles,
};

const InstanceInfo = createContext<InstanceInfoType>(defaultValue);

export function RecceInstanceInfoProvider({ children }: { children: React.ReactNode }) {
  const { data: instanceInfo, isLoading } = useRecceInstanceInfo();
  const [featureToggles, setFeatureToggles] = useState<RecceFeatureToggles>(defaultFeatureToggles);
  const [singleEnv, setSingleEnv] = useState<boolean>(false);
  const [authed, setAuthed] = useState<boolean>(false);
  const [lifetimeExpiredAt, setLifetimeExpiredAt] = useState<Date>();

  useEffect(() => {
    if (!isLoading && instanceInfo) {
      setSingleEnv(instanceInfo.single_env);
      setAuthed(instanceInfo.authed);
      if (instanceInfo.lifetime_expired_at) {
        setLifetimeExpiredAt(new Date(instanceInfo.lifetime_expired_at));
        console.log("lifetime expired at", instanceInfo.lifetime_expired_at);
      }

      // Set feature toggles based on instanceInfo
      const toggles = defaultFeatureToggles;
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
        toggles.mode = "preview mode";
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
      setFeatureToggles(toggles);
    }
  }, [instanceInfo, isLoading]);

  return (
    <InstanceInfo.Provider
      value={{
        featureToggles,
        singleEnv,
        authed,
        lifetimeExpiredAt,
      }}>
      {children}
    </InstanceInfo.Provider>
  );
}

export const useRecceInstanceContext = () => useContext(InstanceInfo);
