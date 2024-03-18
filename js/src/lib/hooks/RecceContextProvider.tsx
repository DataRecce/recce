import React from "react";

import {
  RecceQueryContextProvider,
  RowCountStateContextProvider,
} from "./RecceQueryContext";
import { LineageGraphContextProvider } from "./LineageGraphContext";
import { RecceActionContextProvider } from "./RecceActionContext";

interface RecceContextProps {
  children: React.ReactNode;
}

export default function RecceContextProvider({ children }: RecceContextProps) {
  return (
    <>
      <RecceQueryContextProvider>
        <LineageGraphContextProvider>
          <RowCountStateContextProvider>
            <RecceActionContextProvider>{children}</RecceActionContextProvider>
          </RowCountStateContextProvider>
        </LineageGraphContextProvider>
      </RecceQueryContextProvider>
    </>
  );
}
