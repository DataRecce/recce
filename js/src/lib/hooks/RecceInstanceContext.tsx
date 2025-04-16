import { createContext, useContext, useEffect, useState } from "react";
import { useRecceInstanceInfo } from "./useRecceInstanceInfo";

interface InstanceInfoType {
  readOnly: boolean;
  authed: boolean;
}

const defaultValue: InstanceInfoType = {
  readOnly: false,
  authed: false,
};

const InstanceInfo = createContext<InstanceInfoType>(defaultValue);

export function RecceInstanceInfoProvider({ children }: { children: React.ReactNode }) {
  const { data: instanceInfo, isLoading } = useRecceInstanceInfo();
  const [readOnly, setReadOnly] = useState<boolean>(false);
  const [authed, setAuthed] = useState<boolean>(false);

  useEffect(() => {
    if (!isLoading && instanceInfo) {
      setReadOnly(instanceInfo.read_only);
      setAuthed(instanceInfo.authed);
    }
  }, [instanceInfo, isLoading]);

  return <InstanceInfo.Provider value={{ readOnly, authed }}>{children}</InstanceInfo.Provider>;
}

export const useRecceInstanceContext = () => useContext(InstanceInfo);
