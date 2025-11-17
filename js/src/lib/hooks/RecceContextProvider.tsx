import React from "react";
import { LineageGraphContextProvider } from "./LineageGraphContext";
import { RecceActionContextProvider } from "./RecceActionContext";
import { RecceCheckContextProvider } from "./RecceCheckContext";
import { RecceInstanceInfoProvider } from "./RecceInstanceContext";
import {
  RecceQueryContextProvider,
  RowCountStateContextProvider,
} from "./RecceQueryContext";
import { RecceShareStateContextProvider } from "./RecceShareStateContext";

interface RecceContextProps {
  children: React.ReactNode;
}

export default function RecceContextProvider({ children }: RecceContextProps) {
  return (
    <RecceInstanceInfoProvider>
      <RecceShareStateContextProvider>
        <RecceQueryContextProvider>
          <LineageGraphContextProvider>
            <RowCountStateContextProvider>
              <RecceActionContextProvider>
                <RecceCheckContextProvider>
                  {children}
                </RecceCheckContextProvider>
              </RecceActionContextProvider>
            </RowCountStateContextProvider>
          </LineageGraphContextProvider>
        </RecceQueryContextProvider>
      </RecceShareStateContextProvider>
    </RecceInstanceInfoProvider>
  );
}
