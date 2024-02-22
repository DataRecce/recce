import React from "react";

import {
  RecceQueryContextProvider,
  RowCountStateContextProvider,
} from "./RecceQueryContext";
import { LineageGraphsContextProvider } from "./LineageGraphContext";
import { RecceActionContextProvider } from "./RecceActionContext";

interface RecceContextProps {
  children: React.ReactNode;
}

export default function RecceContextProvider({ children }: RecceContextProps) {
  return (
    <>
      <RecceQueryContextProvider>
        <LineageGraphsContextProvider>
          <RowCountStateContextProvider>
            <RecceActionContextProvider>{children}</RecceActionContextProvider>
          </RowCountStateContextProvider>
        </LineageGraphsContextProvider>
      </RecceQueryContextProvider>
    </>
  );
}
