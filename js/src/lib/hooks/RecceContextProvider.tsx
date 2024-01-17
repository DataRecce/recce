import React from 'react';

import { RecceQueryContextProvider, RowCountStateContextProvider } from './RecceQueryContext';
import { LineageGraphsContextProvider } from './LineageGraphContext';

interface RecceContextProps {
  children: React.ReactNode;
}

export default function RecceContextProvider({ children }: RecceContextProps) {
  return (
    <>
      <RecceQueryContextProvider>
        <LineageGraphsContextProvider>
          <RowCountStateContextProvider>
            {children}
          </RowCountStateContextProvider>
        </LineageGraphsContextProvider>
      </RecceQueryContextProvider>
    </>
  );
}
