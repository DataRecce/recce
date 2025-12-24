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

/**
 * Main context provider for Recce application.
 *
 * For custom API configuration (e.g., recce-cloud), wrap this provider
 * with ApiConfigProvider:
 *
 * ```tsx
 * <ApiConfigProvider
 *   apiPrefix="/api/v2/sessions/abc123"
 *   authToken="eyJ..."
 * >
 *   <RecceContextProvider>
 *     {children}
 *   </RecceContextProvider>
 * </ApiConfigProvider>
 * ```
 *
 * When used without ApiConfigProvider (OSS mode), hooks will use
 * the default axios client with standard /api/* endpoints.
 */
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
