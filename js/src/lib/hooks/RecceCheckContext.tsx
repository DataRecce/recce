import React, { createContext, useContext } from "react";

export interface CheckContext {
  latestSelectedCheckId: string;
  setLatestSelectedCheckId: (selectCheckId: string) => void;
}

interface CheckContextProps {
  children: React.ReactNode;
}

const RecceCheckContext = createContext<CheckContext>({
  latestSelectedCheckId: "",
  setLatestSelectedCheckId: () => {
    return void 0;
  },
});

export function RecceCheckContextProvider({ children }: CheckContextProps) {
  const [selectCheckId, setSelectCheckId] = React.useState<string>("");
  return (
    <RecceCheckContext.Provider
      value={{
        setLatestSelectedCheckId: setSelectCheckId,
        latestSelectedCheckId: selectCheckId,
      }}
    >
      {children}
    </RecceCheckContext.Provider>
  );
}

export const useRecceCheckContext = () => useContext(RecceCheckContext);
