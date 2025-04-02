import { createContext, useContext, useEffect, useState } from "react";
import { useRecceInstanceInfo } from "./useRecceInstanceInfo";

interface ModeContextType {
  readOnly: boolean;
}

const defaultValue: ModeContextType = {
  readOnly: false,
};

const ModeContext = createContext<ModeContextType>(defaultValue);

export function RecceModeProvider({ children }: { children: React.ReactNode }) {
  const { data: instanceInfo, isLoading } = useRecceInstanceInfo();
  const [readOnly, setReadOnly] = useState<boolean>(false);

  useEffect(() => {
    if (!isLoading && instanceInfo) {
      setReadOnly(instanceInfo.read_only);
    }
  }, [instanceInfo, isLoading]);

  return <ModeContext.Provider value={{ readOnly }}>{children}</ModeContext.Provider>;
}

export const useRecceModeContext = () => useContext(ModeContext);
