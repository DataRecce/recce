import React from "react";

import { RecceQueryContextProvider, RowCountStateContextProvider } from "./RecceQueryContext";
import { LineageGraphContextProvider } from "./LineageGraphContext";
import { RecceActionContextProvider } from "./RecceActionContext";
import { RecceCheckContextProvider } from "./RecceCheckContext";
import { RecceModeProvider } from "./RecceModeContext";

interface RecceContextProps {
  children: React.ReactNode;
}

export default function RecceContextProvider({ children }: RecceContextProps) {
  return (
    <>
      <RecceModeProvider>
        <RecceQueryContextProvider>
          <LineageGraphContextProvider>
            <RowCountStateContextProvider>
              <RecceActionContextProvider>
                <RecceCheckContextProvider>{children}</RecceCheckContextProvider>
              </RecceActionContextProvider>
            </RowCountStateContextProvider>
          </LineageGraphContextProvider>
        </RecceQueryContextProvider>
      </RecceModeProvider>
    </>
  );
}
