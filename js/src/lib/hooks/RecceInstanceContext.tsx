import { createContext, useContext, useEffect, useState } from "react";
import { useRecceInstanceInfo } from "./useRecceInstanceInfo";

interface InstanceInfoType {
  readOnly: boolean;
  authed: boolean;
  lifetimeExpiredAt?: Date;
}

const defaultValue: InstanceInfoType = {
  readOnly: false,
  authed: false,
  lifetimeExpiredAt: undefined,
};

const InstanceInfo = createContext<InstanceInfoType>(defaultValue);

export function RecceInstanceInfoProvider({ children }: { children: React.ReactNode }) {
  const { data: instanceInfo, isLoading } = useRecceInstanceInfo();
  const [readOnly, setReadOnly] = useState<boolean>(false);
  const [authed, setAuthed] = useState<boolean>(false);
  const [lifetimeExpiredAt, setLifetimeExpiredAt] = useState<Date>();

  useEffect(() => {
    if (!isLoading && instanceInfo) {
      setReadOnly(instanceInfo.read_only);
      setAuthed(instanceInfo.authed);
      if (instanceInfo.lifetime_expired_at) {
        setLifetimeExpiredAt(new Date(instanceInfo.lifetime_expired_at));
        console.log("lifetime expired at", instanceInfo.lifetime_expired_at);
      }
    }
  }, [instanceInfo, isLoading]);

  return (
    <InstanceInfo.Provider value={{ readOnly, authed, lifetimeExpiredAt }}>
      {children}
    </InstanceInfo.Provider>
  );
}

export const useRecceInstanceContext = () => useContext(InstanceInfo);
