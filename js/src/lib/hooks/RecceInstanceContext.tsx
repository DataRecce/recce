import { createContext, useContext, useEffect, useState } from "react";
import { useRecceInstanceInfo } from "./useRecceInstanceInfo";

interface RecceFeatureToggles {
  mode: "read only" | "review mode" | "full access";
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
  mode: "full access",
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
  readOnly: boolean;
  singleEnv: boolean;
  authed: boolean;
  lifetimeExpiredAt?: Date;
  featureToggles: RecceFeatureToggles;
}

const defaultValue: InstanceInfoType = {
  readOnly: false,
  singleEnv: false,
  authed: false,
  lifetimeExpiredAt: undefined,
  featureToggles: defaultFeatureToggles,
};

const InstanceInfo = createContext<InstanceInfoType>(defaultValue);

export function RecceInstanceInfoProvider({ children }: { children: React.ReactNode }) {
  const { data: instanceInfo, isLoading } = useRecceInstanceInfo();
  const [readOnly, setReadOnly] = useState<boolean>(false);
  const [featureToggles, setFeatureToggles] = useState<RecceFeatureToggles>(defaultFeatureToggles);
  const [singleEnv, setSingleEnv] = useState<boolean>(false);
  const [authed, setAuthed] = useState<boolean>(false);
  const [lifetimeExpiredAt, setLifetimeExpiredAt] = useState<Date>();

  useEffect(() => {
    if (!isLoading && instanceInfo) {
      setReadOnly(instanceInfo.read_only);
      setSingleEnv(instanceInfo.single_env);
      setAuthed(instanceInfo.authed);
      if (instanceInfo.lifetime_expired_at) {
        setLifetimeExpiredAt(new Date(instanceInfo.lifetime_expired_at));
        console.log("lifetime expired at", instanceInfo.lifetime_expired_at);
      }

      // Set feature toggles based on instanceInfo
      const toggles = defaultFeatureToggles;
      if (instanceInfo.read_only) {
        toggles.mode = "read only";
        toggles.disableSaveToFile = true;
        toggles.disableExportStateFile = true;
        toggles.disableImportStateFile = true;
        toggles.disableUpdateChecklist = true;
        toggles.disableDatabaseQuery = true;
        toggles.disableViewActionDropdown = true;
        toggles.disableNodeActionDropdown = true;
        toggles.disableShare = true;
      }
      if (instanceInfo.single_env) {
        toggles.disableUpdateChecklist = true;
        toggles.disableShare = true;
      }
    }
  }, [instanceInfo, isLoading]);

  return (
    <InstanceInfo.Provider
      value={{
        readOnly,
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
