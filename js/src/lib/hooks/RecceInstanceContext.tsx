import { createContext, useContext, useEffect, useState } from "react";
import { useRecceInstanceInfo } from "./useRecceInstanceInfo";

interface InstanceInfoType {
  readOnly: boolean;
}

const defaultValue: InstanceInfoType = {
  readOnly: false,
};

const InstanceInfo = createContext<InstanceInfoType>(defaultValue);

export function RecceInstanceInfoProvider({ children }: { children: React.ReactNode }) {
  const { data: instanceInfo, isLoading } = useRecceInstanceInfo();
  const [readOnly, setReadOnly] = useState<boolean>(false);

  useEffect(() => {
    if (!isLoading && instanceInfo) {
      setReadOnly(instanceInfo.read_only);
    }
  }, [instanceInfo, isLoading]);

  return <InstanceInfo.Provider value={{ readOnly }}>{children}</InstanceInfo.Provider>;
}

export const useRecceInstanceContext = () => useContext(InstanceInfo);
