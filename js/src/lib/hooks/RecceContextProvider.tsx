import React from "react";

import { RecceQueryContextProvider, RowCountStateContextProvider } from "./RecceQueryContext";
import { LineageGraphContextProvider } from "./LineageGraphContext";
import { RecceActionContextProvider } from "./RecceActionContext";
import { RecceCheckContextProvider } from "./RecceCheckContext";
import { RecceInstanceInfoProvider } from "./RecceInstanceContext";

interface RecceContextProps {
  children: React.ReactNode;
}

export default function RecceContextProvider({ children }: RecceContextProps) {
  return (
    <>
      <RecceInstanceInfoProvider>
        <RecceQueryContextProvider>
          <LineageGraphContextProvider>
            <RowCountStateContextProvider>
              <RecceActionContextProvider>
                <RecceCheckContextProvider>{children}</RecceCheckContextProvider>
              </RecceActionContextProvider>
            </RowCountStateContextProvider>
          </LineageGraphContextProvider>
        </RecceQueryContextProvider>
      </RecceInstanceInfoProvider>
    </>
  );
}
